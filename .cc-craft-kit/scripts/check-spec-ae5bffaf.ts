#!/usr/bin/env tsx
/**
 * 仕様書 ae5bffaf の不整合を調査
 */

import { getDatabase, closeDatabase } from '../core/database/connection.js';

async function main() {
  console.log('# Investigating spec ae5bffaf\n');

  const db = getDatabase();

  // 仕様書レコードを確認
  const specs = await db
    .selectFrom('specs')
    .selectAll()
    .where('id', 'like', 'ae5bffaf%')
    .execute();

  console.log('## Spec Records:');
  for (const spec of specs) {
    console.log(`ID: ${spec.id}`);
    console.log(`Name: ${spec.name}`);
    console.log(`Phase: ${spec.phase}`);
    console.log(`Created: ${spec.created_at}`);
    console.log(`Updated: ${spec.updated_at}`);
    console.log('');
  }

  // GitHub 同期レコードを確認
  const syncs = await db
    .selectFrom('github_sync')
    .selectAll()
    .where('entity_id', 'like', 'ae5bffaf%')
    .execute();

  console.log('## GitHub Sync Records:');
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
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
