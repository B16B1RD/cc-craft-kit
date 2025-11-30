import { Kysely } from 'kysely';

/**
 * マイグレーション: github_sync テーブルにハッシュカラム追加
 *
 * チェックボックス同期と Issue 本文同期の競合検出に使用する。
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // checkbox_hash カラム追加（チェックボックス状態のハッシュ）
  await db.schema.alterTable('github_sync').addColumn('checkbox_hash', 'text').execute();

  // last_body_hash カラム追加（最後に同期した Issue 本文のハッシュ）
  await db.schema.alterTable('github_sync').addColumn('last_body_hash', 'text').execute();
}

/**
 * ロールバック
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('github_sync').dropColumn('checkbox_hash').execute();
  await db.schema.alterTable('github_sync').dropColumn('last_body_hash').execute();
}
