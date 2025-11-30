import { Kysely } from 'kysely';

/**
 * マイグレーション: github_sync テーブルに PR サポート追加
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // pr_number カラム追加
  await db.schema.alterTable('github_sync').addColumn('pr_number', 'integer').execute();

  // pr_url カラム追加
  await db.schema.alterTable('github_sync').addColumn('pr_url', 'text').execute();

  // issue_number カラム追加（後方互換性のため）
  await db.schema.alterTable('github_sync').addColumn('issue_number', 'integer').execute();

  // issue_url カラム追加（後方互換性のため）
  await db.schema.alterTable('github_sync').addColumn('issue_url', 'text').execute();

  // updated_at カラム追加（SQLite の制限により、デフォルト値なし）
  await db.schema.alterTable('github_sync').addColumn('updated_at', 'text').execute();
}

/**
 * ロールバック
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  // pr_number カラム削除
  await db.schema.alterTable('github_sync').dropColumn('pr_number').execute();

  // pr_url カラム削除
  await db.schema.alterTable('github_sync').dropColumn('pr_url').execute();

  // issue_number カラム削除
  await db.schema.alterTable('github_sync').dropColumn('issue_number').execute();

  // issue_url カラム削除
  await db.schema.alterTable('github_sync').dropColumn('issue_url').execute();

  // updated_at カラム削除
  await db.schema.alterTable('github_sync').dropColumn('updated_at').execute();
}
