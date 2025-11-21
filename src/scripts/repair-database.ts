#!/usr/bin/env tsx
/**
 * データベース修復スクリプト
 *
 * ファイルシステム内の仕様書ファイルを読み込み、データベースに再登録します。
 * DatabaseIntegrityChecker を使用して整合性チェックを実施し、
 * SpecFileValidator を使用して不正なメタデータを自動修正します。
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { getDatabase, closeDatabase } from '../core/database/connection.js';
import {
  checkDatabaseIntegrity,
  formatIntegrityCheckResult,
} from '../core/validators/database-integrity-checker.js';
import {
  parseSpecFile,
  validateMetadata,
  fixSpecFileMetadata,
  parseDateTime,
} from '../core/validators/spec-file-validator.js';

/**
 * メイン処理
 */
async function main() {
  console.log('# Database Repair Tool\n');

  const specsDir = join(process.cwd(), '.cc-craft-kit', 'specs');
  const db = getDatabase();

  // ステップ1: 整合性チェック実行
  console.log('📋 Step 1: Running integrity check...\n');
  const integrityResult = await checkDatabaseIntegrity(db, specsDir);
  console.log(formatIntegrityCheckResult(integrityResult));

  // ステップ2: 不正なメタデータファイルの自動修正
  if (integrityResult.details.invalidFiles.length > 0) {
    console.log('\n🔧 Step 2: Attempting to fix invalid metadata files...\n');
    let fixedCount = 0;

    for (const { filePath } of integrityResult.details.invalidFiles) {
      const fixed = fixSpecFileMetadata(filePath);
      if (fixed) {
        fixedCount++;
      }
    }

    console.log(
      `\n✓ Fixed ${fixedCount} out of ${integrityResult.details.invalidFiles.length} invalid files\n`
    );

    // 再度整合性チェック実行
    console.log('📋 Re-running integrity check after fixes...\n');
    const recheckResult = await checkDatabaseIntegrity(db, specsDir);
    console.log(formatIntegrityCheckResult(recheckResult));
  }

  // ステップ3: データベース修復
  console.log('\n🔨 Step 3: Repairing database...\n');

  const existingSpecs = await db.selectFrom('specs').selectAll().execute();
  const files = await readdir(specsDir);
  const specFiles = files.filter((f) => f.endsWith('.md'));

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const file of specFiles) {
    const filePath = join(specsDir, file);

    try {
      const content = await readFile(filePath, 'utf-8');
      const metadata = parseSpecFile(content);

      if (!metadata) {
        console.log(`⚠️  [SKIP] ${file}: Failed to parse metadata`);
        skippedCount++;
        continue;
      }

      // メタデータの妥当性検証
      const validation = validateMetadata(metadata);
      if (!validation.isValid) {
        console.log(`⚠️  [SKIP] ${file}: Invalid metadata - ${validation.errors.join(', ')}`);
        skippedCount++;
        continue;
      }

      // データベースに既存レコードがあるかチェック
      const existing = existingSpecs.find((s) => s.id === metadata.id);

      if (existing) {
        // 既存レコードを更新
        await db
          .updateTable('specs')
          .set({
            name: metadata.name,
            phase: metadata.phase as
              | 'requirements'
              | 'design'
              | 'tasks'
              | 'implementation'
              | 'testing'
              | 'completed',
            updated_at: parseDateTime(metadata.updatedAt),
          })
          .where('id', '=', metadata.id)
          .execute();

        console.log(`✓  [UPDATE] ${metadata.name} (${metadata.id.substring(0, 8)}...)`);
        updatedCount++;
      } else {
        // 新規レコードを追加
        await db
          .insertInto('specs')
          .values({
            id: metadata.id,
            name: metadata.name,
            description: metadata.description,
            phase: metadata.phase as
              | 'requirements'
              | 'design'
              | 'tasks'
              | 'implementation'
              | 'testing'
              | 'completed',
            branch_name: 'develop', // TODO: 既存ファイルのブランチ名を推定するロジックを追加
            created_at: parseDateTime(metadata.createdAt),
            updated_at: parseDateTime(metadata.updatedAt),
          })
          .execute();

        console.log(`✓  [ADD] ${metadata.name} (${metadata.id.substring(0, 8)}...)`);
        addedCount++;
      }
    } catch (error) {
      console.error(`❌ [ERROR] ${file}:`, error instanceof Error ? error.message : String(error));
      errorCount++;
    }
  }

  console.log('\n📊 Repair Summary:');
  console.log(`   Added: ${addedCount}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total processed: ${specFiles.length}`);

  // ステップ3.5: 孤立レコードの削除
  console.log('\n🗑️  Step 3.5: Deleting orphaned records...\n');

  const recheckResult = await checkDatabaseIntegrity(db, specsDir);
  let deletedCount = 0;

  if (recheckResult.details.missingFiles.length > 0) {
    for (const { id, name } of recheckResult.details.missingFiles) {
      try {
        await db.deleteFrom('specs').where('id', '=', id).execute();
        console.log(`✓  [DELETE] Orphaned record: ${name} (${id.substring(0, 8)}...)`);
        deletedCount++;
      } catch (error) {
        console.error(
          `❌ [ERROR] Failed to delete orphaned record ${id}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
    console.log(`\n✓ Deleted ${deletedCount} orphaned record(s)\n`);
  } else {
    console.log('✓ No orphaned records found\n');
  }

  // ステップ4: 最終整合性チェック
  console.log('📋 Step 4: Final integrity check...\n');
  const finalIntegrityResult = await checkDatabaseIntegrity(db, specsDir);
  console.log(formatIntegrityCheckResult(finalIntegrityResult));

  if (finalIntegrityResult.isValid) {
    console.log('\n✅ Database repaired successfully!');
    console.log(`   Final spec count: ${finalIntegrityResult.stats.totalDbRecords}`);
    process.exit(0);
  } else {
    console.log('\n⚠️  Database repair completed with warnings/errors.');
    console.log('   Please review the integrity check results above.');
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    // データベース接続を確実にクローズ
    await closeDatabase();
  });
