/**
 * データベース診断コマンド
 */

import '../../core/config/env.js';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase, closeDatabase } from '../../core/database/connection.js';
import { formatHeading, formatKeyValue, formatTable, OutputOptions } from '../utils/output.js';
import { createProjectNotInitializedError, handleCLIError } from '../utils/error-handler.js';

/**
 * データベース診断情報を表示
 */
export async function showDatabaseInfo(
  options: OutputOptions = { format: 'table', color: true }
): Promise<void> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    throw createProjectNotInitializedError();
  }

  console.log(formatHeading('Database Connection Info', 1, options.color));
  console.log('');

  // データベースファイルパス
  const dbPath = join(ccCraftKitDir, 'cc-craft-kit.db');
  console.log(formatKeyValue('Database Path', dbPath, options.color));

  // データベースファイルの存在確認
  if (!existsSync(dbPath)) {
    console.error('❌ Database file not found:', dbPath);
    console.error('Project may not be initialized or database file was deleted.');
    console.error('Run /cft:init to initialize the project.');
    process.exit(1);
  }

  // データベースファイルサイズ
  const dbStats = statSync(dbPath);
  const dbSizeMB = (dbStats.size / 1024 / 1024).toFixed(2);
  console.log(formatKeyValue('Database Size', `${dbSizeMB} MB`, options.color));

  // WAL ファイルの状態
  const walPath = `${dbPath}-wal`;
  if (existsSync(walPath)) {
    const walStats = statSync(walPath);
    const walSizeKB = (walStats.size / 1024).toFixed(2);
    console.log(formatKeyValue('WAL Mode', 'Enabled', options.color));
    console.log(formatKeyValue('WAL File', `${walPath} (${walSizeKB} KB)`, options.color));
  } else {
    console.log(formatKeyValue('WAL Mode', 'Enabled (no WAL file)', options.color));
  }

  console.log('');

  // データベース取得
  let db;
  try {
    db = getDatabase();
  } catch (error) {
    console.error(
      '❌ Failed to connect to database:',
      error instanceof Error ? error.message : String(error)
    );
    console.error('Database file may be corrupted.');
    console.error('Check the database file at:', dbPath);
    process.exit(1);
  }

  // 総仕様書数
  const totalSpecsResult = await db
    .selectFrom('specs')
    .select((eb) => eb.fn.count<number>('id').as('count'))
    .executeTakeFirst();

  const totalSpecs = Number(totalSpecsResult?.count) || 0;
  console.log(formatHeading('Specifications', 2, options.color));
  console.log(formatKeyValue('Total', totalSpecs, options.color));
  console.log('');

  // フェーズ別集計
  const specsByPhase = await db
    .selectFrom('specs')
    .select(['phase', (eb) => eb.fn.count<number>('id').as('count')])
    .groupBy('phase')
    .execute();

  if (specsByPhase.length > 0) {
    console.log(formatHeading('Specifications by Phase', 2, options.color));
    const phaseRows = specsByPhase.map((row) => [row.phase, String(row.count)]);
    console.log(formatTable(['Phase', 'Count'], phaseRows, options));
    console.log('');
  }

  // 最新の活動
  const latestActivity = await db
    .selectFrom('specs')
    .select(['created_at', 'updated_at'])
    .orderBy('updated_at', 'desc')
    .limit(1)
    .executeTakeFirst();

  if (latestActivity) {
    console.log(formatHeading('Recent Activity', 2, options.color));
    console.log(
      formatKeyValue(
        'Last created',
        new Date(latestActivity.created_at).toLocaleString(),
        options.color
      )
    );
    console.log(
      formatKeyValue(
        'Last updated',
        new Date(latestActivity.updated_at).toLocaleString(),
        options.color
      )
    );
    console.log('');
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  showDatabaseInfo()
    .catch((error) => handleCLIError(error))
    .finally(() => closeDatabase());
}
