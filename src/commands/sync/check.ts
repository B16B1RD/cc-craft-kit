/**
 * 仕様書ファイルと JSON ストレージ間の整合性チェックコマンド
 */

import '../../core/config/env.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { IntegrityChecker, GitHubSyncChecker } from '../../core/sync/index.js';
import {
  formatHeading,
  formatKeyValue,
  formatTable,
  formatInfo,
  formatSuccess,
  formatWarning,
  formatError,
  OutputOptions,
} from '../utils/output.js';
import {
  createProjectNotInitializedError,
  exitGracefully,
  handleCLIError,
} from '../utils/error-handler.js';

/**
 * 整合性チェック実行
 */
export async function checkSync(
  options: OutputOptions = { format: 'table', color: true }
): Promise<void> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const specsDir = join(ccCraftKitDir, 'specs');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    throw createProjectNotInitializedError();
  }

  console.log(formatHeading('Spec File Sync Check', 1, options.color));
  console.log('');

  const checker = new IntegrityChecker();

  try {
    const report = await checker.check(specsDir);

    // サマリー表示
    console.log(formatHeading('Summary', 2, options.color));
    console.log(formatKeyValue('Total Files', report.totalFiles.toString(), options.color));
    console.log(
      formatKeyValue('Total DB Records', report.totalDbRecords.toString(), options.color)
    );
    console.log(formatKeyValue('Synced', report.synced.length.toString(), options.color));
    console.log(
      formatKeyValue('Files Only (DB未登録)', report.filesOnly.length.toString(), options.color)
    );
    console.log(
      formatKeyValue('DB Only (ファイル削除済み)', report.dbOnly.length.toString(), options.color)
    );
    console.log(
      formatKeyValue(
        'Mismatch (メタデータ不一致)',
        report.mismatch.length.toString(),
        options.color
      )
    );
    console.log(formatKeyValue('Sync Rate', `${report.syncRate}%`, options.color));
    console.log('');

    // ファイルのみ存在 (DB未登録)
    if (report.filesOnly.length > 0) {
      console.log(
        formatWarning(
          `⚠ ${report.filesOnly.length} files found but not in database`,
          options.color
        )
      );
      const filesOnlyRows = report.filesOnly.slice(0, 10).map((id) => [id.slice(0, 12) + '...']);
      console.log(formatTable(['Spec ID'], filesOnlyRows, options));
      if (report.filesOnly.length > 10) {
        console.log(formatInfo(`... and ${report.filesOnly.length - 10} more`, options.color));
      }
      console.log('');
    }

    // DBのみ存在 (ファイル削除済み)
    if (report.dbOnly.length > 0) {
      console.log(
        formatWarning(
          `⚠ ${report.dbOnly.length} database records found but files are missing`,
          options.color
        )
      );
      const dbOnlyRows = report.dbOnly.slice(0, 10).map((id) => [id.slice(0, 12) + '...']);
      console.log(formatTable(['Spec ID'], dbOnlyRows, options));
      if (report.dbOnly.length > 10) {
        console.log(formatInfo(`... and ${report.dbOnly.length - 10} more`, options.color));
      }
      console.log('');
    }

    // メタデータ不一致
    if (report.mismatch.length > 0) {
      console.log(
        formatWarning(`⚠ ${report.mismatch.length} specs have metadata mismatches`, options.color)
      );
      const mismatchRows = report.mismatch
        .slice(0, 5)
        .map((m) => [m.id.slice(0, 12) + '...', m.differences.slice(0, 2).join('; ')]);
      console.log(formatTable(['Spec ID', 'Differences'], mismatchRows, options));
      if (report.mismatch.length > 5) {
        console.log(formatInfo(`... and ${report.mismatch.length - 5} more`, options.color));
      }
      console.log('');
    }

    // 結果判定
    if (
      report.syncRate === 100 &&
      report.filesOnly.length === 0 &&
      report.dbOnly.length === 0 &&
      report.mismatch.length === 0
    ) {
      console.log(formatSuccess('✓ All specs are synced correctly!', options.color));
    } else {
      console.log(
        formatError('✗ Sync issues detected. Run /cft:sync-repair to fix.', options.color)
      );
    }
    console.log('');

    // 推奨アクション
    if (report.filesOnly.length > 0 || report.mismatch.length > 0) {
      console.log(formatHeading('Suggested Actions', 2, options.color));
      console.log('  • Fix sync issues: /cft:sync-repair');
      console.log('');
    }

    // GitHub同期状態のチェック
    console.log(formatHeading('GitHub Issue Sync Status', 2, options.color));
    const githubChecker = new GitHubSyncChecker();
    const githubReport = githubChecker.check();

    console.log(formatKeyValue('Synced to GitHub', githubReport.synced.toString(), options.color));
    console.log(
      formatKeyValue('Not Synced to GitHub', githubReport.notSynced.toString(), options.color)
    );
    console.log(
      formatKeyValue('Sync Errors', githubReport.syncErrors.length.toString(), options.color)
    );
    console.log(formatKeyValue('GitHub Sync Rate', `${githubReport.syncRate}%`, options.color));
    console.log('');

    if (githubReport.syncErrors.length > 0) {
      console.log(
        formatWarning(
          `⚠ ${githubReport.syncErrors.length} specs have GitHub sync errors`,
          options.color
        )
      );
      const errorRows = githubReport.syncErrors
        .slice(0, 5)
        .map((err) => [
          err.specId.slice(0, 12) + '...',
          err.specName.slice(0, 30),
          err.errorMessage.slice(0, 40),
        ]);
      console.log(formatTable(['Spec ID', 'Name', 'Error'], errorRows, options));
      if (githubReport.syncErrors.length > 5) {
        console.log(
          formatInfo(`... and ${githubReport.syncErrors.length - 5} more`, options.color)
        );
      }
      console.log('');
    }

    if (githubReport.notSynced > 0) {
      console.log(
        formatInfo(
          `ℹ ${githubReport.notSynced} specs not synced to GitHub. Use /cft:github-issue-create to sync.`,
          options.color
        )
      );
      console.log('');
    }
  } catch (error) {
    console.error(
      formatError(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        options.color
      )
    );
    throw error;
  }
}

/**
 * メインエントリーポイント
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  checkSync()
    .then(() => exitGracefully(0))
    .catch((error) => handleCLIError(error));
}
