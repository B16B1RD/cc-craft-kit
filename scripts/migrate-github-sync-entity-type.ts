/**
 * GitHub Sync テーブルの entity_type 修正マイグレーション
 *
 * 背景:
 * 仕様書とGitHub Issueの同期記録を github_sync テーブルに保存する際、
 * entity_type に 'issue' を設定していたが、正しくは 'spec' であるべき。
 *
 * このスクリプトは既存の不正なレコードを一括修正します。
 */

import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../.takumi/core/database/connection.js';

async function main() {
  const cwd = process.cwd();
  const takumiDir = join(cwd, '.takumi');
  const dbPath = join(takumiDir, 'takumi.db');

  console.log('=== GitHub Sync Entity Type Migration ===\n');

  // データベース存在確認
  if (!existsSync(dbPath)) {
    console.error('Error: Database not found at', dbPath);
    process.exit(1);
  }

  // バックアップ作成
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '-' +
    new Date().toTimeString().split(' ')[0].replace(/:/g, '');
  const backupPath = `${dbPath}.backup-${timestamp}`;

  console.log('1. Creating database backup...');
  try {
    copyFileSync(dbPath, backupPath);
    console.log(`   ✓ Backup created: ${backupPath}\n`);
  } catch (error) {
    console.error('   ✗ Failed to create backup:', error);
    process.exit(1);
  }

  // データベース接続
  const db = getDatabase();

  try {
    // 現在の不整合状態を確認
    console.log('2. Checking current inconsistency...');

    const specsWithIssues = await db
      .selectFrom('specs')
      .select(['id', 'name', 'github_issue_id'])
      .where('github_issue_id', 'is not', null)
      .execute();

    console.log(`   Found ${specsWithIssues.length} specs with GitHub Issue IDs\n`);

    let inconsistentCount = 0;
    for (const spec of specsWithIssues) {
      const syncRecord = await db
        .selectFrom('github_sync')
        .select(['entity_type'])
        .where('entity_type', '=', 'spec')
        .where('entity_id', '=', spec.id)
        .executeTakeFirst();

      if (!syncRecord) {
        inconsistentCount++;
      }
    }

    console.log(`   Inconsistent records: ${inconsistentCount}\n`);

    if (inconsistentCount === 0) {
      console.log('✓ No inconsistencies found. Migration not needed.\n');
      await db.destroy();
      return;
    }

    // 仕様書IDリストを取得
    console.log('3. Collecting spec IDs...');
    const specs = await db.selectFrom('specs').select('id').execute();
    const specIdList = specs.map((s) => s.id);
    console.log(`   Found ${specIdList.length} spec IDs\n`);

    // entity_type を 'spec' に一括更新
    console.log('4. Updating entity_type from "issue" to "spec"...');

    const result = await db
      .updateTable('github_sync')
      .set({
        entity_type: 'spec',
        last_synced_at: new Date().toISOString(),
      })
      .where('entity_type', '=', 'issue')
      .where('entity_id', 'in', specIdList)
      .execute();

    console.log(`   ✓ Updated ${result.length} records\n`);

    // 不整合チェック（ゼロ件を期待）
    console.log('5. Verifying migration...');

    let postMigrationInconsistentCount = 0;
    for (const spec of specsWithIssues) {
      const syncRecord = await db
        .selectFrom('github_sync')
        .select(['entity_type'])
        .where('entity_type', '=', 'spec')
        .where('entity_id', '=', spec.id)
        .executeTakeFirst();

      if (!syncRecord) {
        postMigrationInconsistentCount++;
        console.log(
          `   ⚠️  Spec ${spec.id.substring(0, 8)} (${spec.name}) still has no sync record`
        );
      }
    }

    if (postMigrationInconsistentCount === 0) {
      console.log('   ✓ All records are now consistent!\n');
    } else {
      console.log(`   ⚠️  ${postMigrationInconsistentCount} inconsistencies remain\n`);
    }

    console.log('=== Migration Summary ===');
    console.log(`Backup: ${backupPath}`);
    console.log(`Updated: ${result.length} records`);
    console.log(`Remaining inconsistencies: ${postMigrationInconsistentCount}`);
    console.log('');

    if (postMigrationInconsistentCount > 0) {
      console.log('⚠️  Warning: Migration incomplete. Check logs above.');
      console.log(`You can restore from backup: cp ${backupPath} ${dbPath}`);
    } else {
      console.log('✓ Migration completed successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Run: npx tsx scripts/check-sync-status.ts');
      console.log('  2. Verify no inconsistencies remain');
      console.log('  3. Test creating a new spec to verify entity_type is "spec"');
    }

    await db.destroy();
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    console.error(`\nYou can restore from backup with:`);
    console.error(`  cp ${backupPath} ${dbPath}`);
    await db.destroy();
    process.exit(1);
  }
}

main();
