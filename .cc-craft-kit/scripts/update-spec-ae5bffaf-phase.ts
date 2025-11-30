#!/usr/bin/env tsx
/**
 * 仕様書 ae5bffaf のフェーズを completed に更新
 */

import { getDatabase, closeDatabase } from '../core/database/connection.js';

async function main() {
  console.log('# Updating spec ae5bffaf phase to completed\n');

  const db = getDatabase();
  const specId = 'ae5bffaf-843f-41f1-b486-973db2e45928';

  // フェーズを completed に更新
  await db
    .updateTable('specs')
    .set({
      phase: 'completed',
      updated_at: '2025-11-18T04:15:29Z',
    })
    .where('id', '=', specId)
    .execute();

  console.log('✓ Updated phase to completed');

  // 確認
  const spec = await db
    .selectFrom('specs')
    .select(['id', 'name', 'phase', 'updated_at'])
    .where('id', '=', specId)
    .executeTakeFirst();

  console.log('\n## Current State:');
  console.log(`ID: ${spec?.id}`);
  console.log(`Name: ${spec?.name}`);
  console.log(`Phase: ${spec?.phase}`);
  console.log(`Updated: ${spec?.updated_at}`);

  await closeDatabase();

  console.log('\n✅ Phase updated successfully!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
