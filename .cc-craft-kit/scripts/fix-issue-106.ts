/**
 * Issue #106 を仕様書 030af17a に紐付けるスクリプト
 */

import '../core/config/env.js';
import { getDatabase } from '../core/database/connection.js';

async function main() {
  const db = getDatabase();

  const specId = '030af17a-fea5-46f4-a62b-2d4872a5fff6';
  const correctIssueNumber = 106;

  console.log(`Updating spec ${specId} to link with Issue #${correctIssueNumber}...`);

  // specs テーブルを更新
  await db
    .updateTable('specs')
    .set({
      github_issue_id: correctIssueNumber,
      updated_at: new Date().toISOString(),
    })
    .where('id', '=', specId)
    .execute();

  console.log('✓ Updated specs table');

  // github_sync テーブルを確認・更新
  const existingSync = await db
    .selectFrom('github_sync')
    .selectAll()
    .where('entity_id', '=', specId)
    .where('entity_type', '=', 'spec')
    .executeTakeFirst();

  if (existingSync) {
    console.log('✓ Existing sync record found, updating...');
    await db
      .updateTable('github_sync')
      .set({
        github_id: correctIssueNumber.toString(),
        github_number: correctIssueNumber,
        last_synced_at: new Date().toISOString(),
        sync_status: 'success',
        error_message: null,
      })
      .where('id', '=', existingSync.id)
      .execute();
    console.log('✓ Updated github_sync table');
  } else {
    console.log('✓ No existing sync record, creating new one...');
    await db
      .insertInto('github_sync')
      .values({
        entity_type: 'spec',
        entity_id: specId,
        github_id: correctIssueNumber.toString(),
        github_number: correctIssueNumber,
        last_synced_at: new Date().toISOString(),
        sync_status: 'success',
        error_message: null,
      })
      .execute();
    console.log('✓ Created github_sync record');
  }

  // 検証
  const updatedSpec = await db
    .selectFrom('specs')
    .selectAll()
    .where('id', '=', specId)
    .executeTakeFirst();

  console.log('');
  console.log('✅ Fix completed!');
  console.log('');
  console.log(`Spec ID: ${updatedSpec?.id}`);
  console.log(`Name: ${updatedSpec?.name}`);
  console.log(`GitHub Issue: #${updatedSpec?.github_issue_id}`);
}

main().catch(console.error);
