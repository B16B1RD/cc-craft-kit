/**
 * データベース内のすべての仕様書の branch_name を main に更新するスクリプト
 */

import { getDatabase } from '../core/database/connection.js';
import type { Kysely } from 'kysely';
import type { Database } from '../core/database/schema.js';

/**
 * dry-run モード: 更新対象の仕様書を確認
 */
export async function verifySpecsBeforeUpdate(db?: Kysely<Database>): Promise<void> {
  const database = db ?? getDatabase();
  const specs = await database
    .selectFrom('specs')
    .select(['id', 'name', 'branch_name'])
    .where('branch_name', '!=', 'main')
    .execute();

  console.log(`更新対象の仕様書: ${specs.length} 件`);
  specs.forEach((spec) => {
    console.log(`  - ${spec.name} (${spec.branch_name ?? 'null'} → main)`);
  });
}

/**
 * すべての仕様書の branch_name を main に更新
 */
export async function updateAllSpecsToMain(db?: Kysely<Database>): Promise<void> {
  const database = db ?? getDatabase();

  // すべての仕様書の branch_name を main に更新
  const result = await database.updateTable('specs').set({ branch_name: 'main' }).execute();

  console.log(
    `✓ ${result.length > 0 ? result[0].numUpdatedRows : 0} 件の仕様書のブランチを main に更新しました`
  );
}

/**
 * 検証クエリ: すべての仕様書が main ブランチになっているか確認
 */
export async function verifyAllSpecsOnMain(db?: Kysely<Database>): Promise<boolean> {
  const database = db ?? getDatabase();
  const nonMainSpecs = await database
    .selectFrom('specs')
    .select('id')
    .where('branch_name', '!=', 'main')
    .execute();

  if (nonMainSpecs.length > 0) {
    console.error(`⚠ main 以外のブランチが ${nonMainSpecs.length} 件残っています`);
    return false;
  }

  console.log('✓ すべての仕様書が main ブランチになっています');
  return true;
}
