import { Kysely, sql } from 'kysely';
import { execSync } from 'node:child_process';

/**
 * specs テーブルに branch_name カラムを追加
 *
 * 追加するカラム:
 * - branch_name: 仕様書が作成されたブランチ名
 *
 * インデックス:
 * - idx_specs_branch_name: ブランチ名での高速検索用
 * - idx_specs_phase_branch: フェーズとブランチの複合検索用
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. 現在のブランチ名を取得
  let currentBranch = 'develop';
  try {
    currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    console.warn('Git ブランチ名の取得に失敗しました。デフォルト値 "develop" を使用します。');
  }

  // 2. カラム追加（デフォルト値を設定）
  await db.schema
    .alterTable('specs')
    .addColumn('branch_name', 'text', (col) => col.notNull().defaultTo(currentBranch))
    .execute();

  // 3. 既存レコードのブランチ名を現在のブランチ名で更新
  await sql`UPDATE specs SET branch_name = ${currentBranch}`.execute(db);

  // 4. インデックス作成
  await db.schema.createIndex('idx_specs_branch_name').on('specs').column('branch_name').execute();

  await db.schema
    .createIndex('idx_specs_phase_branch')
    .on('specs')
    .columns(['phase', 'branch_name'])
    .execute();

  console.log(`✓ Migration completed: added branch_name column to specs table`);
  console.log(`ℹ All existing specs have been assigned to branch '${currentBranch}'`);
  console.log(`ℹ If you need to reassign specs to different branches, use the database directly`);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // ロールバック: branch_name カラムとインデックスを削除

  // 1. インデックス削除
  await db.schema.dropIndex('idx_specs_phase_branch').ifExists().execute();
  await db.schema.dropIndex('idx_specs_branch_name').ifExists().execute();

  // 2. SQLite では ALTER TABLE DROP COLUMN がサポートされていないため、
  //    テーブル再作成が必要
  await db.schema
    .createTable('specs_new')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('phase', 'text', (col) => col.notNull().defaultTo('requirements'))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // 3. データをコピー（branch_name を除く）
  await sql`
    INSERT INTO specs_new (id, name, description, phase, created_at, updated_at)
    SELECT id, name, description, phase, created_at, updated_at FROM specs
  `.execute(db);

  // 4. 古いテーブルを削除
  await db.schema.dropTable('specs').execute();

  // 5. 新しいテーブルをリネーム
  await db.schema.alterTable('specs_new').renameTo('specs').execute();

  // 6. フェーズ検索用インデックスを復元
  await db.schema.createIndex('specs_phase_idx').on('specs').column('phase').execute();

  console.log(`✓ Rollback completed: removed branch_name column from specs table`);
}
