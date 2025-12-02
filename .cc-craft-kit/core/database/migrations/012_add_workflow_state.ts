import { Kysely, sql } from 'kysely';

/**
 * workflow_state テーブル追加マイグレーション
 *
 * セッション間でワークフロー状態を引き継ぐためのテーブルを作成します。
 * Claude Code セッションが終了・再開した際に、実行中のタスク状態を復元するために使用されます。
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // workflow_state テーブル
  await db.schema
    .createTable('workflow_state')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('spec_id', 'text', (col) =>
      col.notNull().references('specs.id').onDelete('cascade').unique()
    )
    .addColumn('current_task_number', 'integer', (col) => col.notNull())
    .addColumn('current_task_title', 'text', (col) => col.notNull())
    .addColumn('next_action', 'text', (col) => col.notNull().defaultTo('none'))
    .addColumn('github_issue_number', 'integer')
    .addColumn('saved_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // インデックス
  await db.schema
    .createIndex('workflow_state_spec_id_idx')
    .on('workflow_state')
    .column('spec_id')
    .execute();
}

/**
 * ロールバック
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('workflow_state').execute();
}
