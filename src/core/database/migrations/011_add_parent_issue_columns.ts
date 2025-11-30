import { Kysely } from 'kysely';

/**
 * マイグレーション: github_sync テーブルに親 Issue 関連カラム追加
 *
 * Sub Issue と親 Issue の関連性を追跡するために使用する。
 * - parent_issue_number: 親 Issue の番号（#123 形式の数値部分）
 * - parent_spec_id: 親 Issue に紐づく仕様書の ID
 *
 * これにより、Sub Issue から親 Issue への逆引きが可能になり、
 * タスク完了時に親 Issue のチェックボックス同期や自動クローズが実現できる。
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // parent_issue_number カラム追加（親 Issue の番号）
  await db.schema.alterTable('github_sync').addColumn('parent_issue_number', 'integer').execute();

  // parent_spec_id カラム追加（親 Issue に紐づく仕様書 ID）
  await db.schema.alterTable('github_sync').addColumn('parent_spec_id', 'text').execute();
}

/**
 * ロールバック
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('github_sync').dropColumn('parent_issue_number').execute();
  await db.schema.alterTable('github_sync').dropColumn('parent_spec_id').execute();
}
