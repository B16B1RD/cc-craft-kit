/**
 * テスト用データベースヘルパー
 */
import { Kysely } from 'kysely';
import { Database } from '../../src/core/database/schema.js';
import { createDatabase } from '../../src/core/database/connection.js';
import { migrateToLatest } from '../../src/core/database/migrator.js';
import fs from 'fs';
import path from 'path';

/**
 * テスト用データベース作成
 */
export async function createTestDatabase(): Promise<Kysely<Database>> {
  const testDbPath = path.join(process.cwd(), '.takumi', 'test.db');

  // 既存のテストDBを削除
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const db = createDatabase({ databasePath: testDbPath });
  await migrateToLatest(db);

  return db;
}

/**
 * テスト用データベースクリーンアップ
 */
export async function cleanupTestDatabase(db: Kysely<Database>): Promise<void> {
  await db.destroy();

  const testDbPath = path.join(process.cwd(), '.takumi', 'test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
}

/**
 * テーブル全削除
 */
export async function clearAllTables(db: Kysely<Database>): Promise<void> {
  await db.deleteFrom('github_sync').execute();
  await db.deleteFrom('logs').execute();
  await db.deleteFrom('tasks').execute();
  await db.deleteFrom('specs').execute();
}
