import { Kysely } from 'kysely';

/**
 * Sub Issue サポート追加マイグレーション
 * github_sync テーブルに Sub Issue 関連のカラムを追加
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // github_sync テーブルに github_node_id カラムを追加（GraphQL で使用）
  await db.schema.alterTable('github_sync').addColumn('github_node_id', 'text').execute();
}

/**
 * ロールバック
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('github_sync').dropColumn('github_node_id').execute();
}
