import { Kysely, sql } from 'kysely';

/**
 * specs テーブルから GitHub 関連カラムを削除
 *
 * 削除対象カラム:
 * - github_issue_id
 * - github_project_id
 * - github_project_item_id
 * - github_milestone_id
 *
 * これらの情報は github_sync テーブルに一元化されます。
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // SQLite では ALTER TABLE DROP COLUMN がサポートされていないため、
  // テーブル再作成が必要

  // 0. 既存インデックスを削除
  await db.schema.dropIndex('specs_github_issue_id_idx').ifExists().execute();

  // 1. 新しいテーブルを作成
  await db.schema
    .createTable('specs_new')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('phase', 'text', (col) => col.notNull().defaultTo('requirements'))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // 2. データをコピー
  await sql`
    INSERT INTO specs_new (id, name, description, phase, created_at, updated_at)
    SELECT id, name, description, phase, created_at, updated_at FROM specs
  `.execute(db);

  // 3. 古いテーブルを削除
  await db.schema.dropTable('specs').execute();

  // 4. 新しいテーブルをリネーム
  await db.schema.alterTable('specs_new').renameTo('specs').execute();

  // 5. フェーズ検索用インデックスを作成
  await db.schema.createIndex('specs_phase_idx').on('specs').column('phase').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // ロールバック: github_issue_id カラムを復元
  // ⚠️ 警告: github_project_id, github_project_item_id, github_milestone_id は
  // github_sync テーブルに保存されていないため、NULL として復元されます

  // 0. 既存インデックスを削除
  await db.schema.dropIndex('specs_phase_idx').ifExists().execute();

  // 1. 新しいテーブルを作成（GitHub 関連カラムを含む）
  await db.schema
    .createTable('specs_new')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('phase', 'text', (col) => col.notNull().defaultTo('requirements'))
    .addColumn('github_issue_id', 'integer')
    .addColumn('github_project_id', 'text')
    .addColumn('github_project_item_id', 'text')
    .addColumn('github_milestone_id', 'integer')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // 2. データをコピー（github_issue_id は github_sync から復元）
  await sql`
    INSERT INTO specs_new (
      id, name, description, phase, created_at, updated_at,
      github_issue_id, github_project_id, github_project_item_id, github_milestone_id
    )
    SELECT
      s.id,
      s.name,
      s.description,
      s.phase,
      s.created_at,
      s.updated_at,
      gs.github_number as github_issue_id,
      NULL as github_project_id,
      NULL as github_project_item_id,
      NULL as github_milestone_id
    FROM specs s
    LEFT JOIN github_sync gs
      ON gs.entity_id = s.id AND gs.entity_type = 'spec'
  `.execute(db);

  // 3. 古いテーブルを削除
  await db.schema.dropTable('specs').execute();

  // 4. 新しいテーブルをリネーム
  await db.schema.alterTable('specs_new').renameTo('specs').execute();

  // 5. インデックスを復元
  await db.schema.createIndex('specs_phase_idx').on('specs').column('phase').execute();

  await db.schema
    .createIndex('specs_github_issue_id_idx')
    .on('specs')
    .column('github_issue_id')
    .execute();
}
