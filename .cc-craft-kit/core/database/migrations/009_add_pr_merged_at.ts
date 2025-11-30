import { Kysely } from 'kysely';

/**
 * マイグレーション: github_sync テーブルに PR マージ日時カラム追加
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // pr_merged_at カラム追加
  await db.schema.alterTable('github_sync').addColumn('pr_merged_at', 'text').execute();
}

/**
 * ロールバック
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  // pr_merged_at カラム削除
  await db.schema.alterTable('github_sync').dropColumn('pr_merged_at').execute();
}
