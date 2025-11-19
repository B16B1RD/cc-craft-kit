/**
 * Issue #151 とデータベースの同期を修正するスクリプト
 */

import { getDatabase } from '../core/database/connection.js';

async function main() {
  const db = getDatabase();
  const specId = '9712573a-3782-440f-b72a-d084241b7019';
  const issueNumber = 151;

  console.log('🔍 現在の github_sync レコードを確認中...');

  const syncRecords = await db
    .selectFrom('github_sync')
    .selectAll()
    .where('entity_id', '=', specId)
    .execute();

  console.log(`\n📊 現在の同期レコード: ${syncRecords.length} 件`);
  syncRecords.forEach((record) => {
    console.log(`  - ID: ${record.id}`);
    console.log(`    Entity Type: ${record.entity_type}`);
    console.log(`    Entity ID: ${record.entity_id}`);
    console.log(`    GitHub Type: ${record.github_type}`);
    console.log(`    GitHub ID: ${record.github_id}`);
    console.log(`    Synced At: ${record.synced_at}`);
    console.log('');
  });

  console.log('\n🔍 specs テーブルの状態を確認中...');

  const spec = await db.selectFrom('specs').selectAll().where('id', '=', specId).executeTakeFirst();

  if (spec) {
    console.log(`\n📄 仕様書情報:`);
    console.log(`  - ID: ${spec.id}`);
    console.log(`  - Name: ${spec.name}`);
    console.log(`  - Phase: ${spec.phase}`);
    console.log(`  - GitHub Issue ID: ${spec.github_issue_id || '(なし)'}`);
  } else {
    console.log('\n⚠️  仕様書が見つかりません');
    return;
  }

  // 修正を実行するかどうか確認
  console.log('\n\n🔧 以下の修正を実行します:');
  console.log(`  1. specs テーブルの github_issue_id を ${issueNumber} に設定`);
  console.log(`  2. github_sync テーブルの正しいレコードを維持し、不正なレコードを削除`);

  // specs テーブルを更新
  console.log('\n📝 specs テーブルを更新中...');
  await db
    .updateTable('specs')
    .set({
      github_issue_id: issueNumber,
      updated_at: new Date().toISOString(),
    })
    .where('id', '=', specId)
    .execute();

  console.log('✅ specs テーブルを更新しました');

  // 既存の github_sync レコードをすべて削除
  console.log('\n🗑️  既存の github_sync レコードを削除中...');
  const deleteResult = await db
    .deleteFrom('github_sync')
    .where('entity_id', '=', specId)
    .where('entity_type', '=', 'spec')
    .execute();

  console.log(
    `✅ ${deleteResult.length > 0 ? deleteResult[0].numDeletedRows : 0} 件のレコードを削除しました`
  );

  // 正しい github_sync レコードを追加
  console.log('\n📝 正しい github_sync レコードを追加中...');
  await db
    .insertInto('github_sync')
    .values({
      entity_type: 'spec',
      entity_id: specId,
      github_id: issueNumber.toString(),
      github_number: issueNumber,
      github_node_id: null,
      last_synced_at: new Date().toISOString(),
      sync_status: 'success',
      error_message: null,
    })
    .execute();
  console.log('✅ github_sync レコードを追加しました');

  // 修正後の状態を確認
  console.log('\n\n🔍 修正後の状態を確認中...');

  const updatedSpec = await db
    .selectFrom('specs')
    .selectAll()
    .where('id', '=', specId)
    .executeTakeFirst();

  console.log(`\n📄 修正後の仕様書情報:`);
  console.log(`  - ID: ${updatedSpec?.id}`);
  console.log(`  - Name: ${updatedSpec?.name}`);
  console.log(`  - Phase: ${updatedSpec?.phase}`);
  console.log(`  - GitHub Issue ID: ${updatedSpec?.github_issue_id || '(なし)'}`);

  const updatedSyncRecords = await db
    .selectFrom('github_sync')
    .selectAll()
    .where('entity_id', '=', specId)
    .execute();

  console.log(`\n📊 修正後の同期レコード: ${updatedSyncRecords.length} 件`);
  updatedSyncRecords.forEach((record) => {
    console.log(
      `  - GitHub ID: ${record.github_id}, GitHub Number: ${record.github_number}, Sync Status: ${record.sync_status}`
    );
  });

  console.log('\n✅ 修正が完了しました');
}

main().catch((error) => {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
});
