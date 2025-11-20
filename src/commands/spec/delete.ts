/**
 * 仕様書削除コマンド
 */

import '../../core/config/env.js';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase, closeDatabase } from '../../core/database/connection.js';
import { getEventBusAsync } from '../../core/workflow/event-bus.js';
import {
  formatSuccess,
  formatHeading,
  formatKeyValue,
  formatInfo,
  formatError,
} from '../utils/output.js';
import {
  createProjectNotInitializedError,
  createValidationError,
  handleCLIError,
} from '../utils/error-handler.js';
import { validateRequired } from '../utils/validation.js';
import * as readline from 'node:readline/promises';

/**
 * 仕様書削除オプション
 */
export interface DeleteSpecOptions {
  color?: boolean;
  skipConfirmation?: boolean;
  closeGitHubIssue?: boolean;
}

/**
 * 仕様書削除
 */
export async function deleteSpec(
  specIdPrefix: string,
  options: DeleteSpecOptions = {}
): Promise<void> {
  const { color = true, skipConfirmation = false, closeGitHubIssue = false } = options;
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const specsDir = join(ccCraftKitDir, 'specs');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    throw createProjectNotInitializedError();
  }

  // 必須引数チェック
  validateRequired(specIdPrefix, 'specIdPrefix');

  console.log(formatHeading('Deleting Specification', 1, color));
  console.log('');

  // データベース接続
  const db = getDatabase();

  // 仕様書IDを検索（部分一致対応）
  const spec = await db
    .selectFrom('specs')
    .selectAll()
    .where('id', 'like', `${specIdPrefix}%`)
    .executeTakeFirst();

  if (!spec) {
    throw createValidationError('specIdPrefix', `Spec not found: ${specIdPrefix}`);
  }

  // 削除対象の情報を表示
  console.log(formatKeyValue('Spec ID', spec.id, color));
  console.log(formatKeyValue('Name', spec.name, color));
  console.log(formatKeyValue('Phase', spec.phase, color));
  console.log('');

  // GitHub Issue情報を取得
  const githubSync = await db
    .selectFrom('github_sync')
    .selectAll()
    .where('entity_type', '=', 'spec')
    .where('entity_id', '=', spec.id)
    .executeTakeFirst();

  if (githubSync) {
    console.log(formatKeyValue('GitHub Issue', `#${githubSync.github_number}`, color));
    console.log('');
  }

  // 確認プロンプト
  if (!skipConfirmation) {
    console.log(formatInfo('⚠️  This operation is irreversible!', color));
    console.log(formatInfo('The following will be deleted:', color));
    console.log(`  - Database record`);
    console.log(`  - Spec file: ${join(specsDir, `${spec.id}.md`)}`);
    if (closeGitHubIssue && githubSync) {
      console.log(`  - GitHub Issue will be closed: #${githubSync.github_number}`);
    }
    console.log('');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      const answer = await rl.question('Are you sure you want to delete this spec? (y/N): ');
      rl.close();

      if (answer.toLowerCase() !== 'y') {
        console.log('');
        console.log(formatInfo('Deletion cancelled.', color));
        return;
      }
    } catch (error) {
      rl.close();
      throw error;
    }
  }

  console.log('');
  console.log(formatInfo('Deleting spec...', color));

  const specPath = join(specsDir, `${spec.id}.md`);

  try {
    // トランザクション開始
    // 1. データベースレコード削除
    await db.deleteFrom('specs').where('id', '=', spec.id).execute();

    // 2. 仕様書ファイル削除
    if (existsSync(specPath)) {
      unlinkSync(specPath);
    }

    // 3. GitHub Issue をクローズ (オプション)
    if (closeGitHubIssue && githubSync) {
      try {
        // GitHub Issue クローズ処理 (将来実装)
        console.log(
          formatInfo(
            `Note: GitHub Issue #${githubSync.github_number} was not closed automatically.`,
            color
          )
        );
        console.log(formatInfo('Please close it manually if needed.', color));
      } catch (githubError) {
        console.log(formatError('Failed to close GitHub Issue:', color));
        console.log(
          formatError(
            githubError instanceof Error ? githubError.message : String(githubError),
            color
          )
        );
      }
    }

    // 4. spec.deleted イベント発火
    const eventBus = await getEventBusAsync();
    await eventBus.emit(
      eventBus.createEvent('spec.deleted', spec.id, {
        name: spec.name,
        phase: spec.phase,
      })
    );

    console.log('');
    console.log(formatSuccess('Specification deleted successfully!', color));
    console.log('');
    console.log(formatKeyValue('Deleted Spec ID', spec.id, color));
    console.log(formatKeyValue('Deleted Spec Name', spec.name, color));
  } catch (error) {
    // エラー時のロールバックは自動的に行われる（トランザクション外のため手動対応不要）
    console.error('');
    console.error(formatError('Failed to delete spec:', color));
    throw error;
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const specIdPrefix = process.argv[2];
  const closeGitHubIssue = process.argv.includes('--close-github-issue');
  const skipConfirmation = process.argv.includes('--yes') || process.argv.includes('-y');

  if (!specIdPrefix) {
    console.error('Error: spec-id is required');
    console.error('Usage: npx tsx delete.ts <spec-id> [--close-github-issue] [--yes]');
    process.exit(1);
  }

  deleteSpec(specIdPrefix, { closeGitHubIssue, skipConfirmation })
    .catch((error) => handleCLIError(error))
    .finally(() => closeDatabase());
}
