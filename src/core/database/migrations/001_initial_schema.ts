import { Kysely, sql } from 'kysely';

/**
 * 初期スキーママイグレーション
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Specs テーブル
  await db.schema
    .createTable('specs')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('phase', 'text', (col) => col.notNull().defaultTo('requirements'))
    .addColumn('github_issue_id', 'integer')
    .addColumn('github_project_id', 'text')
    .addColumn('github_milestone_id', 'integer')
    .addColumn('created_at', 'text', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn('updated_at', 'text', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // Specs インデックス
  await db.schema
    .createIndex('specs_phase_idx')
    .on('specs')
    .column('phase')
    .execute();

  await db.schema
    .createIndex('specs_github_issue_id_idx')
    .on('specs')
    .column('github_issue_id')
    .execute();

  // Tasks テーブル
  await db.schema
    .createTable('tasks')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('spec_id', 'text', (col) =>
      col.notNull().references('specs.id').onDelete('cascade')
    )
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('todo'))
    .addColumn('priority', 'integer', (col) => col.notNull().defaultTo(3))
    .addColumn('github_issue_id', 'integer')
    .addColumn('github_issue_number', 'integer')
    .addColumn('assignee', 'text')
    .addColumn('created_at', 'text', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn('updated_at', 'text', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // Tasks インデックス
  await db.schema
    .createIndex('tasks_spec_id_idx')
    .on('tasks')
    .column('spec_id')
    .execute();

  await db.schema
    .createIndex('tasks_status_idx')
    .on('tasks')
    .column('status')
    .execute();

  await db.schema
    .createIndex('tasks_github_issue_id_idx')
    .on('tasks')
    .column('github_issue_id')
    .execute();

  // Logs テーブル
  await db.schema
    .createTable('logs')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('task_id', 'text', (col) => col.references('tasks.id').onDelete('cascade'))
    .addColumn('spec_id', 'text', (col) => col.references('specs.id').onDelete('cascade'))
    .addColumn('action', 'text', (col) => col.notNull())
    .addColumn('level', 'text', (col) => col.notNull().defaultTo('info'))
    .addColumn('message', 'text', (col) => col.notNull())
    .addColumn('metadata', 'text')
    .addColumn('timestamp', 'text', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  // Logs インデックス
  await db.schema
    .createIndex('logs_task_id_idx')
    .on('logs')
    .column('task_id')
    .execute();

  await db.schema
    .createIndex('logs_spec_id_idx')
    .on('logs')
    .column('spec_id')
    .execute();

  await db.schema
    .createIndex('logs_timestamp_idx')
    .on('logs')
    .column('timestamp')
    .execute();

  // GitHubSync テーブル
  await db.schema
    .createTable('github_sync')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('entity_type', 'text', (col) => col.notNull())
    .addColumn('entity_id', 'text', (col) => col.notNull())
    .addColumn('github_id', 'text', (col) => col.notNull())
    .addColumn('github_number', 'integer')
    .addColumn('last_synced_at', 'text', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn('sync_status', 'text', (col) => col.notNull().defaultTo('pending'))
    .addColumn('error_message', 'text')
    .execute();

  // GitHubSync インデックス
  await db.schema
    .createIndex('github_sync_entity_idx')
    .on('github_sync')
    .columns(['entity_type', 'entity_id'])
    .execute();

  await db.schema
    .createIndex('github_sync_github_id_idx')
    .on('github_sync')
    .column('github_id')
    .execute();
}

/**
 * ロールバック
 */
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('github_sync').execute();
  await db.schema.dropTable('logs').execute();
  await db.schema.dropTable('tasks').execute();
  await db.schema.dropTable('specs').execute();
}
