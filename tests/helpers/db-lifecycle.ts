/**
 * データベースライフサイクル管理ヘルパー
 *
 * テストで使用するデータベースの初期化とクリーンアップを提供します。
 */

import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, Migrator, FileMigrationProvider } from 'kysely';
import type { Database as DatabaseSchema } from '../../src/core/database/schema.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * テスト用マイグレーション実行
 *
 * process.cwd() を使用してマイグレーションファイルを読み込みます。
 * import.meta.url を使用しないため、Jest 環境で動作します。
 */
async function runTestMigrations(db: Kysely<DatabaseSchema>): Promise<void> {
  const migrationsPath = path.join(process.cwd(), 'src', 'core', 'database', 'migrations');

  const provider = new FileMigrationProvider({
    fs,
    path,
    migrationFolder: migrationsPath,
  });

  const migrator = new Migrator({
    db,
    provider,
  });

  const { error } = await migrator.migrateToLatest();

  if (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * テスト用データベースインスタンスを作成
 *
 * :memory: モードで新しいデータベースを作成し、マイグレーションを実行します。
 */
export async function createTestDatabase(): Promise<Kysely<DatabaseSchema>> {
  // :memory: モードで SQLite データベースを作成
  const sqlite = new Database(':memory:');

  // 外部キー制約を有効化
  sqlite.pragma('foreign_keys = ON');

  // Kysely Dialect 作成
  const dialect = new SqliteDialect({
    database: sqlite,
  });

  const db = new Kysely<DatabaseSchema>({
    dialect,
  });

  // マイグレーションを実行
  await runTestMigrations(db);

  return db;
}

/**
 * データベーステーブルを完全にクリーンアップ
 *
 * 外部キー制約を考慮した順序ですべてのテーブルをクリアします。
 */
export async function cleanupDatabase(db: Kysely<DatabaseSchema>): Promise<void> {
  // 外部キー制約を考慮した削除順序
  // 1. github_sync (specs へ外部キー参照)
  await db.deleteFrom('github_sync').execute();

  // 2. workflow_state (specs へ外部キー参照)
  await db.deleteFrom('workflow_state').execute();

  // 3. tasks (specs へ外部キー参照)
  await db.deleteFrom('tasks').execute();

  // 4. specs (親テーブル)
  await db.deleteFrom('specs').execute();

  // 5. logs (独立したテーブル)
  await db.deleteFrom('logs').execute();
}

/**
 * データベース接続をクローズ
 *
 * テスト終了時にデータベース接続を適切にクローズします。
 */
export async function closeTestDatabase(db: Kysely<DatabaseSchema>): Promise<void> {
  await db.destroy();
}

/**
 * データベースの完全なライフサイクル管理を提供するヘルパー
 *
 * beforeEach / afterEach で使用する便利な関数
 */
export interface DatabaseLifecycle {
  db: Kysely<DatabaseSchema>;
  cleanup: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * データベースライフサイクルをセットアップ
 *
 * テストファイルで以下のように使用:
 * ```typescript
 * let lifecycle: DatabaseLifecycle;
 *
 * beforeEach(async () => {
 *   lifecycle = await setupDatabaseLifecycle();
 * });
 *
 * afterEach(async () => {
 *   await lifecycle.cleanup();
 *   await lifecycle.close();
 * });
 * ```
 */
export async function setupDatabaseLifecycle(): Promise<DatabaseLifecycle> {
  const db = await createTestDatabase();

  return {
    db,
    cleanup: async () => await cleanupDatabase(db),
    close: async () => await closeTestDatabase(db),
  };
}

/**
 * テストデータベースの状態を検証
 *
 * テーブルのレコード数を返します（デバッグ用）
 */
export async function getDatabaseState(db: Kysely<DatabaseSchema>): Promise<{
  specs: number;
  tasks: number;
  logs: number;
  githubSync: number;
}> {
  const specs = await db.selectFrom('specs').select(db.fn.count('id').as('count')).executeTakeFirst();
  const tasks = await db.selectFrom('tasks').select(db.fn.count('id').as('count')).executeTakeFirst();
  const logs = await db.selectFrom('logs').select(db.fn.count('id').as('count')).executeTakeFirst();
  const githubSync = await db.selectFrom('github_sync').select(db.fn.count('id').as('count')).executeTakeFirst();

  return {
    specs: Number(specs?.count || 0),
    tasks: Number(tasks?.count || 0),
    logs: Number(logs?.count || 0),
    githubSync: Number(githubSync?.count || 0),
  };
}
