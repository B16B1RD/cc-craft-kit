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
  // .takumiディレクトリ確認・作成
  const takumiDir = path.join(process.cwd(), '.takumi');
  if (!fs.existsSync(takumiDir)) {
    fs.mkdirSync(takumiDir, { recursive: true });
  }

  // ユニークなDBファイル名を生成
  const testDbPath = path.join(takumiDir, `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`);

  // 既存のテストDBを削除
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch {
      // 削除失敗は無視
    }
  }

  const db = createDatabase({ databasePath: testDbPath });
  await migrateToLatest(db);

  return db;
}

/**
 * テスト用データベースクリーンアップ
 */
export async function cleanupTestDatabase(db: Kysely<Database> | null): Promise<void> {
  if (!db) return;

  try {
    await db.destroy();
  } catch (error) {
    // destroy失敗は無視
  }

  // test-*.dbファイルをクリーンアップ
  const takumiDir = path.join(process.cwd(), '.takumi');
  if (fs.existsSync(takumiDir)) {
    const files = fs.readdirSync(takumiDir);
    files.filter(f => f.startsWith('test-') && f.endsWith('.db')).forEach(f => {
      const filepath = path.join(takumiDir, f);
      try {
        fs.unlinkSync(filepath);
      } catch {
        // 削除失敗は無視
      }
    });
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
