import { Kysely } from 'kysely';

/**
 * GitHub Project Item ID カラム追加マイグレーション
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // specs テーブルに github_project_item_id カラムを追加
  await db.schema.alterTable('specs').addColumn('github_project_item_id', 'text').execute();
}

/**
 * ロールバック
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('specs').dropColumn('github_project_item_id').execute();
}
