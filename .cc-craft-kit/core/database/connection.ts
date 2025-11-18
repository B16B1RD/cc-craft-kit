import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { Database as DatabaseSchema } from './schema.js';
import path from 'path';
import fs from 'fs';

/**
 * データベース接続設定
 */
export interface DatabaseConfig {
  databasePath?: string;
  verbose?: boolean;
}

/**
 * デフォルト設定
 */
const DEFAULT_DB_PATH = path.join(process.cwd(), '.cc-craft-kit', 'cc-craft-kit.db');

/**
 * Kyselyデータベースインスタンスを作成
 */
export function createDatabase(config: DatabaseConfig = {}): Kysely<DatabaseSchema> {
  const dbPath = config.databasePath || process.env.DATABASE_PATH || DEFAULT_DB_PATH;

  // ディレクトリが存在しない場合は作成
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // SQLite接続作成
  const sqlite = new Database(dbPath, {
    verbose: config.verbose ? console.log : undefined,
  });

  // WALモード有効化(パフォーマンス向上)
  sqlite.pragma('journal_mode = WAL');
  // 外部キー制約有効化
  sqlite.pragma('foreign_keys = ON');

  // Kysely Dialect作成
  const dialect = new SqliteDialect({
    database: sqlite,
  });

  return new Kysely<DatabaseSchema>({
    dialect,
  });
}

/**
 * シングルトンデータベースインスタンス
 */
let dbInstance: Kysely<DatabaseSchema> | null = null;

/**
 * グローバルデータベースインスタンス取得
 */
export function getDatabase(config?: DatabaseConfig): Kysely<DatabaseSchema> {
  if (!dbInstance) {
    dbInstance = createDatabase(config);
  }
  return dbInstance;
}

/**
 * データベース接続をクローズ
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
  }
}
