import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // github_sync テーブルに PR サポート用カラムを追加
  await db.schema.alterTable('github_sync').addColumn('pr_number', 'integer').execute();

  await db.schema.alterTable('github_sync').addColumn('pr_url', 'text').execute();

  await db.schema.alterTable('github_sync').addColumn('issue_number', 'integer').execute();

  await db.schema.alterTable('github_sync').addColumn('issue_url', 'text').execute();

  await db.schema.alterTable('github_sync').addColumn('updated_at', 'text').execute();
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  // ロールバック: PR サポート用カラムを削除
  // SQLite では ALTER TABLE DROP COLUMN がサポートされないため、
  // テーブル再作成が必要だが、ここでは簡略化のため省略
  // 実際の運用では、テーブル再作成パターンを使用すること
}
