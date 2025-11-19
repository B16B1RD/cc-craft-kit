#!/usr/bin/env tsx
/**
 * 仕様書 ae5bffaf の不整合を修正
 */

import { getDatabase, closeDatabase } from '../core/database/connection.js';

async function main() {
  console.log('# Fixing spec ae5bffaf\n');

  const db = getDatabase();
  const specId = 'ae5bffaf-843f-41f1-b486-973db2e45928';

  // 1. 重複した同期レコードを削除（Issue #34 以外）
  console.log('## Step 1: Deleting duplicate sync records...');
  const result = await db
    .deleteFrom('github_sync')
    .where('entity_id', '=', specId)
    .where('github_id', '!=', '34')
    .execute();

  console.log(`✓ Deleted ${result[0].numDeletedRows ?? 0} duplicate records\n`);

  // 2. Issue #34 の github_number を修正
  console.log('## Step 2: Updating Issue #34 record...');
  await db
    .updateTable('github_sync')
    .set({
      github_number: 34,
      last_synced_at: new Date().toISOString(),
    })
    .where('entity_id', '=', specId)
    .where('github_id', '=', '34')
    .execute();
  console.log('✓ Updated Issue #34 record\n');

  // 3. 現在の状態を確認
  console.log('## Current State:');
  const syncs = await db
    .selectFrom('github_sync')
    .selectAll()
    .where('entity_id', '=', specId)
    .execute();

  for (const sync of syncs) {
    console.log(`Entity Type: ${sync.entity_type}`);
    console.log(`Entity ID: ${sync.entity_id}`);
    console.log(`GitHub ID: ${sync.github_id}`);
    console.log(`GitHub Number: #${sync.github_number}`);
    console.log(`Sync Status: ${sync.sync_status}`);
    console.log(`Last Synced: ${sync.last_synced_at}`);
    console.log('');
  }

  await closeDatabase();

  console.log('\n✅ Fixed successfully!');
  console.log('\nNext steps:');
  console.log('1. Close duplicate Issues #83, #130, #207 manually (they were created by mistake)');
  console.log('2. Verify Issue #34 is correctly linked');
  console.log(
    '3. If the spec is actually completed, update the phase in the database or spec file'
  );
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
