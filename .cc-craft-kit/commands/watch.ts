/**
 * 仕様書ファイル監視コマンド
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../core/database/connection.js';
import { SpecFileWatcher } from '../core/filesystem/watcher.js';
import { formatHeading, formatInfo, formatSuccess, formatError } from './utils/output.js';
import { createProjectNotInitializedError } from './utils/error-handler.js';

/**
 * 仕様書ファイル監視を開始
 */
export async function watchSpecFiles(
  options: { color: boolean; logLevel?: 'debug' | 'info' | 'warn' | 'error' } = {
    color: true,
    logLevel: 'info',
  }
): Promise<void> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    throw createProjectNotInitializedError();
  }

  console.log(formatHeading('File Watcher', 1, options.color));
  console.log('');
  console.log(formatInfo('Starting file watcher for spec files...', options.color));
  console.log('');

  // データベース取得
  const db = getDatabase();

  // ウォッチャー作成
  const watcher = new SpecFileWatcher(db, ccCraftKitDir, {
    debounceMs: 500,
    logLevel: options.logLevel,
  });

  // シグナルハンドラー設定
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log('');
    console.log(formatInfo(`Received ${signal}, shutting down...`, options.color));

    try {
      await watcher.stop();
      console.log(formatSuccess('File watcher stopped gracefully', options.color));
      process.exit(0);
    } catch (error) {
      console.error(
        formatError(
          `Error during shutdown: ${error instanceof Error ? error.message : String(error)}`,
          options.color
        )
      );
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // ウォッチャー開始
  try {
    await watcher.start();

    console.log(formatSuccess('File watcher started successfully!', options.color));
    console.log('');
    console.log(formatInfo('Watching for changes in .cc-craft-kit/specs/', options.color));
    console.log(formatInfo('File changes will automatically update GitHub Issues', options.color));
    console.log('');
    console.log(formatInfo('Press Ctrl+C to stop', options.color));
    console.log('');

    // プロセスを維持
    await new Promise(() => {
      // 無限待機
    });
  } catch (error) {
    console.error(
      formatError(
        `Failed to start file watcher: ${error instanceof Error ? error.message : String(error)}`,
        options.color
      )
    );
    process.exit(1);
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const logLevel =
    (args.find((arg) => arg.startsWith('--log-level='))?.split('=')[1] as
      | 'debug'
      | 'info'
      | 'warn'
      | 'error') || 'info';

  watchSpecFiles({ color: true, logLevel }).catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
