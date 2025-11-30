#!/usr/bin/env node
/**
 * PR マージ後処理コマンド
 *
 * PR がマージされた後、ローカル・リモートブランチを削除し、データベースを更新します。
 */

import { getDatabase } from '../../core/database/connection.js';
import { cleanupMergedPullRequest } from '../../integrations/github/pr-cleanup.js';
import { handleCLIError } from '../utils/error-handler.js';
import { formatHeading, formatSuccess, formatError } from '../utils/output.js';

/**
 * メイン処理
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // 引数チェック
  if (args.length < 1) {
    console.error(formatError('引数エラー: 仕様書IDを指定してください'));
    console.error('使用方法: /cft:pr-cleanup <spec-id>');
    process.exit(1);
  }

  const specId = args[0];

  console.log(formatHeading('PR マージ後処理', 1));
  console.log(`\n仕様書ID: ${specId}\n`);

  const db = getDatabase();

  try {
    // PR マージ後処理を実行
    const result = await cleanupMergedPullRequest(db, specId);

    if (result.success) {
      console.log(formatSuccess('PR マージ後処理が完了しました!'));
      console.log(`\nPR番号: #${result.prNumber}`);
      console.log(`ブランチ: ${result.branchName}`);
      console.log(`マージ日時: ${result.mergedAt || '不明'}`);
      console.log('');
    } else {
      console.error(formatError(result.error || 'PR マージ後処理に失敗しました'));
      process.exit(1);
    }
  } catch (error) {
    await handleCLIError(error);
  }
}

// 実行
main();
