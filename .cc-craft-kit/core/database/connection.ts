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
let dbPath: string | null = null;

/**
 * グローバルデータベースインスタンス取得
 *
 * IMPORTANT: このメソッドは厳格なシングルトンパターンを実装しています。
 * 一度インスタンスが作成されると、異なる config を渡してもエラーになります。
 * これにより、複数のデータベースインスタンスによるデータ破損を防ぎます。
 *
 * @param config - データベース設定（初回呼び出し時のみ有効）
 * @throws Error - 既存のインスタンスと異なるパスが指定された場合
 */
export function getDatabase(config?: DatabaseConfig): Kysely<DatabaseSchema> {
  const requestedPath = config?.databasePath || process.env.DATABASE_PATH || DEFAULT_DB_PATH;

  // 既にインスタンスが存在する場合
  if (dbInstance && dbPath) {
    // 異なるパスが要求された場合はエラー
    if (requestedPath !== dbPath) {
      throw new Error(
        `Database instance already exists with path "${dbPath}". ` +
          `Cannot create new instance with path "${requestedPath}". ` +
          `This is a critical error to prevent database corruption. ` +
          `Please use closeDatabase() first if you need to switch databases.`
      );
    }
    return dbInstance;
  }

  // 初回作成
  dbPath = requestedPath;
  dbInstance = createDatabase(config);
  return dbInstance;
}

/**
 * データベース接続をクローズ
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
    dbPath = null;
  }
}

/**
 * 現在のデータベースパスを取得（デバッグ用）
 */
export function getCurrentDatabasePath(): string | null {
  return dbPath;
}
