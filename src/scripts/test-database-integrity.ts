#!/usr/bin/env tsx
/**
 * データベース整合性 E2E テストスクリプト
 *
 * 10 回連続で仕様書作成・削除を実行し、
 * データベース不整合が発生しないことを確認します。
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import { getDatabase, closeDatabase } from '../core/database/connection.js';
import { checkDatabaseIntegrity } from '../core/validators/database-integrity-checker.js';
import { randomUUID } from 'crypto';

/**
 * 日時フォーマットヘルパー
 */
function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

async function main() {
  console.log('# Database Integrity E2E Test\n');

  const originalCwd = process.cwd();
  let testDir: string | null = null;

  try {
    // 一時ディレクトリを作成
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'cc-craft-kit-e2e-'));
    const ccCraftKitDir = path.join(testDir, '.cc-craft-kit');
    const specsDir = path.join(ccCraftKitDir, 'specs');
    const dbPath = path.join(ccCraftKitDir, 'cc-craft-kit.db');

    await fs.mkdir(specsDir, { recursive: true });

    // 作業ディレクトリを変更
    process.chdir(testDir);

    // データベース接続をクローズ（既存のインスタンスがあれば）
    await closeDatabase();

    // テーブル作成
    const db = getDatabase({ databasePath: dbPath });
    await db.schema
      .createTable('specs')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('description', 'text')
      .addColumn('phase', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .execute();

    console.log('✓ Test database initialized\n');

    const iterations = 10;
    const createdIds: string[] = [];

    console.log(`📝 Creating ${iterations} specs...\n`);

    // 10 回連続で作成
    for (let i = 0; i < iterations; i++) {
      const id = randomUUID();
      const now = new Date().toISOString();
      const name = `テスト仕様書 ${i + 1}`;

      await db
        .insertInto('specs')
        .values({
          id,
          name,
          description: `E2E テスト用の仕様書 ${i + 1}`,
          phase: 'requirements',
          created_at: now,
          updated_at: now,
        })
        .execute();

      const specPath = path.join(specsDir, `${id}.md`);
      const content = `# ${name}

**仕様書 ID:** ${id}
**フェーズ:** requirements
**作成日時:** ${formatDateTime(new Date(now))}
**更新日時:** ${formatDateTime(new Date(now))}

---

## 1. 背景と目的

### 背景

E2E テスト用の仕様書 ${i + 1}
`;

      await fs.writeFile(specPath, content, 'utf-8');
      createdIds.push(id);

      // 整合性チェック（作成後）
      const createCheck = await checkDatabaseIntegrity(db, specsDir);
      if (!createCheck.isValid) {
        throw new Error(`Integrity check failed after creating spec ${i + 1}`);
      }
      if ((createCheck.details.missingFiles?.length || 0) > 0) {
        throw new Error(`Missing files detected after creating spec ${i + 1}`);
      }
      if ((createCheck.details.missingDbRecords?.length || 0) > 0) {
        throw new Error(`Missing DB records detected after creating spec ${i + 1}`);
      }

      process.stdout.write(`✓ Created spec ${i + 1}/${iterations}\r`);
    }

    console.log('\n');

    // 中間整合性チェック
    const midCheck = await checkDatabaseIntegrity(db, specsDir);
    if (!midCheck.isValid) {
      throw new Error('Mid-point integrity check failed');
    }
    if (midCheck.stats.totalDbRecords !== iterations) {
      throw new Error(`Expected ${iterations} DB records, got ${midCheck.stats.totalDbRecords}`);
    }
    if (midCheck.stats.totalFiles !== iterations) {
      throw new Error(`Expected ${iterations} files, got ${midCheck.stats.totalFiles}`);
    }

    console.log(`✓ Mid-point check passed: ${iterations} specs created\n`);

    console.log(`🗑️  Deleting ${iterations} specs...\n`);

    // 10 回連続で削除
    for (let i = 0; i < iterations; i++) {
      const specId = createdIds[i];

      // DB レコード削除
      await db.deleteFrom('specs').where('id', '=', specId).execute();

      // ファイル削除
      const specPath = path.join(specsDir, `${specId}.md`);
      await fs.unlink(specPath);

      // 整合性チェック（削除後）
      const deleteCheck = await checkDatabaseIntegrity(db, specsDir);
      if (!deleteCheck.isValid) {
        throw new Error(`Integrity check failed after deleting spec ${i + 1}`);
      }
      if ((deleteCheck.details.missingFiles?.length || 0) > 0) {
        throw new Error(`Missing files detected after deleting spec ${i + 1}`);
      }
      if ((deleteCheck.details.missingDbRecords?.length || 0) > 0) {
        throw new Error(`Missing DB records detected after deleting spec ${i + 1}`);
      }

      process.stdout.write(`✓ Deleted spec ${i + 1}/${iterations}\r`);
    }

    console.log('\n');

    // 最終整合性チェック
    const finalCheck = await checkDatabaseIntegrity(db, specsDir);
    if (!finalCheck.isValid) {
      throw new Error('Final integrity check failed');
    }
    if (finalCheck.stats.totalDbRecords !== 0) {
      throw new Error(`Expected 0 DB records, got ${finalCheck.stats.totalDbRecords}`);
    }
    if (finalCheck.stats.totalFiles !== 0) {
      throw new Error(`Expected 0 files, got ${finalCheck.stats.totalFiles}`);
    }
    if ((finalCheck.details.missingFiles?.length || 0) > 0) {
      throw new Error('Orphaned records detected');
    }
    if ((finalCheck.details.missingDbRecords?.length || 0) > 0) {
      throw new Error('Missing DB records detected');
    }

    console.log('✅ All tests passed!\n');
    console.log('   Created: ' + iterations);
    console.log('   Deleted: ' + iterations);
    console.log('   Orphaned records: 0');
    console.log('   Database inconsistencies: 0\n');

    // クリーンアップ
    process.chdir(originalCwd);
    await closeDatabase();

    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : String(error));
    console.error('\nStack trace:', error);

    // クリーンアップ
    process.chdir(originalCwd);
    await closeDatabase();

    if (testDir) {
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch {
        // 無視
      }
    }

    process.exit(1);
  }
}

main();
