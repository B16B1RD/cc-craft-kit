/**
 * マイグレーション007: github_sync テーブルに UNIQUE 制約を追加
 *
 * 目的: GitHub Issue の重複作成を防止するため、(entity_type, entity_id) の複合ユニーク制約を追加
 *
 * 変更内容:
 * - github_sync テーブルに UNIQUE 制約を追加: (entity_type, entity_id)
 * - 既存の重複レコードをクリーンアップ（最新のレコードのみ保持）
 */

import { Kysely, sql } from 'kysely';

/**
 * 重複レコードをクリーンアップ
 * 各 (entity_type, entity_id) の組み合わせで、最新のレコードのみを残して古いレコードを削除
 */
async function cleanupDuplicateRecords(db: Kysely<unknown>): Promise<void> {
  console.log('Cleaning up duplicate github_sync records...');

  // 重複レコードの検出と削除
  // 各 (entity_type, entity_id) グループで、id が最大（最新）のレコードのみを残す
  await sql`
    DELETE FROM github_sync
    WHERE id NOT IN (
      SELECT MAX(id)
      FROM github_sync
      GROUP BY entity_type, entity_id
    )
  `.execute(db);

  console.log('✓ Duplicate records cleaned up');
}

/**
 * マイグレーション実行
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  console.log('Running migration 007: add_unique_constraint_to_github_sync');

  // 1. 既存の重複レコードをクリーンアップ
  await cleanupDuplicateRecords(db);

  // 2. UNIQUE 制約を追加
  console.log('Adding UNIQUE constraint to github_sync table...');

  // SQLite では ALTER TABLE で UNIQUE 制約を追加できないため、
  // テーブルを再作成する必要がある
  await sql`
    -- 一時テーブルを作成（既存スキーマに UNIQUE 制約を追加）
    CREATE TABLE github_sync_new (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      github_id TEXT NOT NULL,
      github_number INTEGER,
      last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      github_node_id TEXT,
      pr_number INTEGER,
      pr_url TEXT,
      issue_number INTEGER,
      issue_url TEXT,
      updated_at TEXT,
      UNIQUE(entity_type, entity_id)
    )
  `.execute(db);

  // データを一時テーブルにコピー（全カラムを含む）
  await sql`
    INSERT INTO github_sync_new (
      id, entity_type, entity_id, github_id, github_number, github_node_id,
      last_synced_at, sync_status, error_message, pr_number, pr_url,
      issue_number, issue_url, updated_at
    )
    SELECT
      id, entity_type, entity_id, github_id, github_number, github_node_id,
      last_synced_at, sync_status, error_message, pr_number, pr_url,
      issue_number, issue_url, updated_at
    FROM github_sync
  `.execute(db);

  // 既存テーブルを削除
  await sql`DROP TABLE github_sync`.execute(db);

  // 一時テーブルをリネーム
  await sql`ALTER TABLE github_sync_new RENAME TO github_sync`.execute(db);

  // インデックスを再作成
  await sql`
    CREATE INDEX idx_github_sync_entity ON github_sync(entity_type, entity_id)
  `.execute(db);

  console.log('✓ UNIQUE constraint added successfully');
}

/**
 * マイグレーションロールバック
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  console.log('Rolling back migration 007: add_unique_constraint_to_github_sync');

  // UNIQUE 制約なしのテーブルを再作成
  await sql`
    -- 一時テーブルを作成（UNIQUE 制約なし）
    CREATE TABLE github_sync_old (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      github_id TEXT NOT NULL,
      github_number INTEGER,
      last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      github_node_id TEXT,
      pr_number INTEGER,
      pr_url TEXT,
      issue_number INTEGER,
      issue_url TEXT,
      updated_at TEXT
    )
  `.execute(db);

  // データを一時テーブルにコピー（全カラムを含む）
  await sql`
    INSERT INTO github_sync_old (
      id, entity_type, entity_id, github_id, github_number, github_node_id,
      last_synced_at, sync_status, error_message, pr_number, pr_url,
      issue_number, issue_url, updated_at
    )
    SELECT
      id, entity_type, entity_id, github_id, github_number, github_node_id,
      last_synced_at, sync_status, error_message, pr_number, pr_url,
      issue_number, issue_url, updated_at
    FROM github_sync
  `.execute(db);

  // 既存テーブルを削除
  await sql`DROP TABLE github_sync`.execute(db);

  // 一時テーブルをリネーム
  await sql`ALTER TABLE github_sync_old RENAME TO github_sync`.execute(db);

  // インデックスを再作成
  await sql`
    CREATE INDEX idx_github_sync_entity ON github_sync(entity_type, entity_id)
  `.execute(db);

  console.log('✓ UNIQUE constraint removed successfully');
}
