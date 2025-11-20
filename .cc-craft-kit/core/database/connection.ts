import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import type { Database as DatabaseSchema } from './schema.js';
import path from 'path';
import fs from 'fs';
import {
  checkDatabaseIntegrity,
  formatIntegrityCheckResult,
} from '../validators/database-integrity-checker.js';

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

  // WALモード有効化(パフォーマンス向上、複数プロセスからの同時アクセスをサポート)
  sqlite.pragma('journal_mode = WAL');
  // 外部キー制約有効化
  sqlite.pragma('foreign_keys = ON');

  // 複数プロセスからの同時書き込み対策
  // busy_timeout: データベースがロックされている場合、最大5秒待機してリトライ
  sqlite.pragma('busy_timeout = 5000');

  // WAL自動チェックポイント: WALファイルが1000ページに達したら自動的にチェックポイント実行
  sqlite.pragma('wal_autocheckpoint = 1000');

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
 * 整合性チェック実行フラグ（初回のみ実行）
 */
let integrityCheckDone = false;

/**
 * データベース整合性チェック（非ブロッキング）
 *
 * バックグラウンドで整合性チェックを実行し、警告があれば表示します。
 * データベース破損やファイル不整合が検出された場合のみエラーメッセージを出力します。
 */
async function runIntegrityCheck(db: Kysely<DatabaseSchema>): Promise<void> {
  if (integrityCheckDone) {
    return; // 既にチェック済み
  }

  integrityCheckDone = true;

  try {
    const specsDir = path.join(process.cwd(), '.cc-craft-kit', 'specs');

    // ディレクトリが存在しない場合はスキップ
    if (!fs.existsSync(specsDir)) {
      return;
    }

    const result = await checkDatabaseIntegrity(db, specsDir);

    // エラーがある場合は警告表示
    if (!result.isValid) {
      console.warn('\n⚠️  Database integrity check failed:');
      console.warn(formatIntegrityCheckResult(result));
      console.warn(
        '\nRun `npx tsx .cc-craft-kit/scripts/repair-database.ts` to repair the database.\n'
      );
    }

    // 警告のみの場合は簡潔に表示
    if (result.isValid && result.warnings.length > 0) {
      console.warn('\n⚠️  Database integrity warnings:');
      for (const warning of result.warnings) {
        console.warn(`  - ${warning}`);
      }
      console.warn(
        '\nRun `npx tsx .cc-craft-kit/scripts/repair-database.ts` to fix these issues.\n'
      );
    }
  } catch (error) {
    // 整合性チェック自体の失敗は警告のみ（データベース操作は継続）
    console.warn(
      '⚠️  Integrity check failed:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

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

  // バックグラウンドで整合性チェック実行（非ブロッキング）
  runIntegrityCheck(dbInstance).catch((error) => {
    console.warn('Background integrity check error:', error);
  });

  return dbInstance;
}

/**
 * データベース接続をクローズ
 *
 * クローズ前に WAL チェックポイントを実行して、
 * WAL ファイルの内容をメインデータベースファイルにフラッシュします。
 * これにより、異常終了時のデータ損失を防ぎます。
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    try {
      // WAL チェックポイント実行（TRUNCATE モードで WAL ファイルをリセット）
      await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(dbInstance);
    } catch (error) {
      console.warn(
        'Warning: WAL checkpoint failed:',
        error instanceof Error ? error.message : String(error)
      );
    }

    await dbInstance.destroy();
    dbInstance = null;
    dbPath = null;
    integrityCheckDone = false; // 次回接続時に再度チェック
  }
}

/**
 * 現在のデータベースパスを取得（デバッグ用）
 */
export function getCurrentDatabasePath(): string | null {
  return dbPath;
}

/**
 * プロセス終了時のシグナルハンドラー
 *
 * SIGINT (Ctrl+C) および SIGTERM シグナル受信時に、
 * データベース接続を安全にクローズします。
 */
let signalHandlersRegistered = false;

function registerSignalHandlers(): void {
  if (signalHandlersRegistered) {
    return; // 既に登録済み
  }

  signalHandlersRegistered = true;

  // SIGINT (Ctrl+C) ハンドラー
  process.on('SIGINT', async () => {
    console.log('\n\nReceived SIGINT, closing database...');
    await closeDatabase();
    process.exit(0);
  });

  // SIGTERM ハンドラー
  process.on('SIGTERM', async () => {
    console.log('\n\nReceived SIGTERM, closing database...');
    await closeDatabase();
    process.exit(0);
  });

  // uncaughtException ハンドラー（未キャッチの例外）
  process.on('uncaughtException', async (error) => {
    console.error('\n\nUncaught exception:', error);
    await closeDatabase();
    process.exit(1);
  });

  // unhandledRejection ハンドラー（未処理の Promise 拒否）
  process.on('unhandledRejection', async (reason) => {
    console.error('\n\nUnhandled rejection:', reason);
    await closeDatabase();
    process.exit(1);
  });
}

// モジュールロード時にシグナルハンドラーを自動登録
registerSignalHandlers();
