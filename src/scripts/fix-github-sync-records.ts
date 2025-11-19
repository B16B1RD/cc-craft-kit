#!/usr/bin/env tsx
/**
 * GitHub 同期レコードの不整合を検出・修正
 *
 * github_number が null のレコードを検出し、github_id から修正します。
 */

import { getDatabase, closeDatabase } from '../core/database/connection.js';

async function main() {
  console.log('# Fixing GitHub Sync Records\n');

  const db = getDatabase();

  // 1. github_number が null のレコードを検出
  console.log('## Step 1: Detecting invalid records...\n');
  const invalidRecords = await db
    .selectFrom('github_sync')
    .selectAll()
    .where('github_number', 'is', null)
    .where('entity_type', 'in', ['spec', 'issue'])
    .execute();

  console.log(`Found ${invalidRecords.length} records with null github_number\n`);

  if (invalidRecords.length === 0) {
    console.log('✅ No invalid records found!');
    await closeDatabase();
    return;
  }

  // 2. 各レコードを修正
  console.log('## Step 2: Fixing records...\n');
  let fixedCount = 0;

  for (const record of invalidRecords) {
    // github_id を数値に変換
    const githubNumber = parseInt(record.github_id, 10);

    if (isNaN(githubNumber)) {
      console.log(
        `⚠️  Skipping record ${record.id}: github_id "${record.github_id}" is not a number`
      );
      continue;
    }

    // github_number を更新
    await db
      .updateTable('github_sync')
      .set({
        github_number: githubNumber,
        last_synced_at: new Date().toISOString(),
      })
      .where('id', '=', record.id)
      .execute();

    console.log(
      `✓ Fixed ${record.entity_type} ${record.entity_id.substring(0, 8)}... (Issue #${githubNumber})`
    );
    fixedCount++;
  }

  // 3. 重複レコードを検出
  console.log('\n## Step 3: Detecting duplicate records...\n');

  const duplicates = await db
    .selectFrom('github_sync')
    .select(['entity_id', 'entity_type'])
    .select((eb) => eb.fn.count<number>('id').as('count'))
    .where('entity_type', 'in', ['spec', 'issue'])
    .groupBy(['entity_id', 'entity_type'])
    .having((eb) => eb.fn.count('id'), '>', 1)
    .execute();

  console.log(`Found ${duplicates.length} entities with duplicate sync records\n`);

  if (duplicates.length > 0) {
    console.log('⚠️  Duplicate records found:');
    for (const dup of duplicates) {
      console.log(
        `  - ${dup.entity_type} ${dup.entity_id.substring(0, 8)}... (${dup.count} records)`
      );

      // 重複レコードの詳細を表示
      const records = await db
        .selectFrom('github_sync')
        .selectAll()
        .where('entity_id', '=', dup.entity_id)
        .where('entity_type', '=', dup.entity_type)
        .orderBy('last_synced_at', 'asc')
        .execute();

      for (const record of records) {
        console.log(`    - Issue #${record.github_number} (synced: ${record.last_synced_at})`);
      }

      // 最も新しいレコード（github_number が設定されているもの）を保持
      const validRecords = records.filter((r) => r.github_number !== null);
      const toKeep = validRecords.length > 0 ? validRecords[validRecords.length - 1] : records[0];
      const toDelete = records.filter((r) => r.id !== toKeep.id);

      for (const record of toDelete) {
        await db.deleteFrom('github_sync').where('id', '=', record.id).execute();
        console.log(`    ✓ Deleted duplicate Issue #${record.github_number ?? 'null'}`);
      }

      console.log(`    ✓ Kept Issue #${toKeep.github_number} (most recent valid record)\n`);
    }
  }

  await closeDatabase();

  console.log('\n📊 Summary:');
  console.log(`  Fixed records: ${fixedCount}`);
  console.log(`  Duplicate entities resolved: ${duplicates.length}`);
  console.log('\n✅ All records fixed successfully!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
