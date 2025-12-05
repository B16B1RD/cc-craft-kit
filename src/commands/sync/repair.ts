/**
 * 仕様書ファイルと JSON ストレージ間の同期修復コマンド
 */

import '../../core/config/env.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { IntegrityChecker, SyncService } from '../../core/sync/index.js';
import {
  formatHeading,
  formatKeyValue,
  formatSuccess,
  formatWarning,
  formatError,
  formatInfo,
  OutputOptions,
} from '../utils/output.js';
import {
  createProjectNotInitializedError,
  exitGracefully,
  handleCLIError,
} from '../utils/error-handler.js';

/**
 * 同期修復実行
 */
export async function repairSync(
  options: OutputOptions = { format: 'table', color: true }
): Promise<void> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const specsDir = join(ccCraftKitDir, 'specs');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    throw createProjectNotInitializedError();
  }

  console.log(formatHeading('Spec File Sync Repair', 1, options.color));
  console.log('');

  const checker = new IntegrityChecker();
  const syncService = new SyncService();

  try {
    // 1. 整合性チェック
    console.log(formatInfo('Checking integrity...', options.color));
    const report = await checker.check(specsDir);

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
    console.log('');

    // 修復が不要な場合
    if (
      report.filesOnly.length === 0 &&
      report.dbOnly.length === 0 &&
      report.mismatch.length === 0
    ) {
      console.log(formatSuccess('✓ No sync issues detected. Nothing to repair.', options.color));
      console.log('');
      return;
    }

    // 2. ファイルのみ存在 → データベースにインポート
    if (report.filesOnly.length > 0) {
      console.log(
        formatInfo(
          `Importing ${report.filesOnly.length} specs from files to database...`,
          options.color
        )
      );
      const importResult = await syncService.importFromFiles(report.filesOnly, specsDir);

      console.log(formatKeyValue('Imported', importResult.imported.toString(), options.color));
      console.log(formatKeyValue('Skipped', importResult.skipped.toString(), options.color));
      console.log(formatKeyValue('Failed', importResult.failed.toString(), options.color));

      if (importResult.errors.length > 0) {
        console.log(formatWarning('Import errors:', options.color));
        importResult.errors.slice(0, 5).forEach((err) => {
          console.log(`  - ${err.file}: ${err.error}`);
        });
        if (importResult.errors.length > 5) {
          console.log(formatInfo(`... and ${importResult.errors.length - 5} more`, options.color));
        }
      }
      console.log('');
    }

    // 3. DBのみ存在 → 警告表示（ファイル削除済みの可能性）
    if (report.dbOnly.length > 0) {
      console.log(
        formatWarning(
          `⚠ ${report.dbOnly.length} database records found but files are missing`,
          options.color
        )
      );
      console.log(
        formatInfo(
          'These specs may have been manually deleted. Consider removing them from the database.',
          options.color
        )
      );
      console.log('');
    }

    // 4. メタデータ不一致 → ファイル優先で更新
    if (report.mismatch.length > 0) {
      console.log(
        formatInfo(
          `Updating ${report.mismatch.length} specs with metadata mismatches (file data takes precedence)...`,
          options.color
        )
      );
      const mismatchIds = report.mismatch.map((m) => m.id);
      const updateResult = await syncService.importFromFiles(mismatchIds, specsDir);

      console.log(formatKeyValue('Updated', updateResult.imported.toString(), options.color));
      console.log(formatKeyValue('Skipped', updateResult.skipped.toString(), options.color));
      console.log(formatKeyValue('Failed', updateResult.failed.toString(), options.color));
      console.log('');
    }

    // 5. 修復完了レポート
    console.log(formatHeading('Repair Summary', 2, options.color));
    console.log(formatSuccess('✓ Sync repair completed!', options.color));
    console.log('');

    // 再度整合性チェック
    console.log(formatInfo('Re-checking integrity...', options.color));
    const finalReport = await checker.check(specsDir);
    console.log(formatKeyValue('Sync Rate', `${finalReport.syncRate}%`, options.color));
    console.log(formatKeyValue('Synced', finalReport.synced.length.toString(), options.color));
    console.log('');

    if (finalReport.syncRate === 100) {
      console.log(formatSuccess('✓ All specs are now synced correctly!', options.color));
    } else {
      console.log(
        formatWarning(
          `⚠ Sync rate: ${finalReport.syncRate}% (some issues may remain)`,
          options.color
        )
      );
      console.log(formatInfo('Run /cft:sync-check for details', options.color));
    }
    console.log('');
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
  repairSync()
    .then(() => exitGracefully(0))
    .catch((error) => handleCLIError(error));
}
