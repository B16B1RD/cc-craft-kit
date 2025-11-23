/**
 * 仕様書削除コマンド
 */

import '../../core/config/env.js';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase, closeDatabase } from '../../core/database/connection.js';
import { getEventBusAsync } from '../../core/workflow/event-bus.js';
import {
  formatSuccess,
  formatHeading,
  formatKeyValue,
  formatInfo,
  formatError,
  formatWarning,
} from '../utils/output.js';
import {
  createProjectNotInitializedError,
  createValidationError,
  handleCLIError,
} from '../utils/error-handler.js';
import { validateRequired } from '../utils/validation.js';
import * as readline from 'node:readline/promises';
import { GitHubClient } from '../../integrations/github/client.js';
import { GitHubIssues } from '../../integrations/github/issues.js';

/**
 * 仕様書削除オプション
 */
export interface DeleteSpecOptions {
  color?: boolean;
  skipConfirmation?: boolean;
  closeGitHubIssue?: boolean;
}

/**
 * GitHub設定を取得
 */
function getGitHubConfig(ccCraftKitDir: string): { owner: string; repo: string } | null {
  const configPath = join(ccCraftKitDir, 'config.json');
  if (!existsSync(configPath)) {
    return null;
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  if (!config.github || !config.github.owner || !config.github.repo) {
    return null;
  }

  return {
    owner: config.github.owner,
    repo: config.github.repo,
  };
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
    // 1. GitHub Issue をクローズ (最初に実行、失敗時に状態変更なし)
    if (closeGitHubIssue && githubSync?.github_number) {
      console.log(formatInfo(`Closing GitHub Issue #${githubSync.github_number}...`, color));

      // GITHUB_TOKENチェック
      const githubToken = process.env.GITHUB_TOKEN;
      if (!githubToken || githubToken.trim() === '') {
        throw new Error('GITHUB_TOKEN is not set. Please set it in your .env file.');
      }

      // GitHub設定チェック
      const githubConfig = getGitHubConfig(ccCraftKitDir);
      if (!githubConfig) {
        throw new Error(
          'GitHub is not configured. Please run /cft:github-init <owner> <repo> first.'
        );
      }

      // GitHub APIクライアント作成
      const client = new GitHubClient({ token: githubToken });
      const issues = new GitHubIssues(client);

      try {
        await issues.close(githubConfig.owner, githubConfig.repo, githubSync.github_number);
        console.log(
          formatSuccess(`GitHub Issue #${githubSync.github_number} closed successfully!`, color)
        );
      } catch (githubError: unknown) {
        // GitHub API エラーハンドリング
        if (githubError instanceof Error) {
          const errorMessage = githubError.message.toLowerCase();

          // 404エラー（Issue が存在しない）の場合、警告表示後に削除続行
          if (errorMessage.includes('not found') || errorMessage.includes('404')) {
            console.log('');
            console.log(
              formatWarning(
                `GitHub Issue #${githubSync.github_number} was not found (may be already deleted).`,
                color
              )
            );
            console.log(formatWarning('Continuing with spec deletion...', color));
            console.log('');
          } else if (
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('401') ||
            errorMessage.includes('bad credentials')
          ) {
            // 401エラー（認証失敗）の場合、エラーメッセージ表示して削除スキップ
            throw new Error(
              `GitHub authentication failed: ${githubError.message}\nPlease check your GITHUB_TOKEN in .env file.`
            );
          } else if (
            errorMessage.includes('rate limit') ||
            errorMessage.includes('403') ||
            errorMessage.includes('forbidden')
          ) {
            // 403エラー（レート制限超過）の場合、エラーメッセージ表示して削除スキップ
            throw new Error(
              `GitHub API rate limit exceeded or access forbidden: ${githubError.message}\nPlease try again later.`
            );
          } else if (
            errorMessage.includes('server error') ||
            errorMessage.includes('500') ||
            errorMessage.includes('internal server')
          ) {
            // 500エラー（GitHub API 障害）の場合、エラーメッセージ表示して削除スキップ
            throw new Error(
              `GitHub API is experiencing issues: ${githubError.message}\nPlease try again later.`
            );
          } else {
            // その他のエラー
            throw new Error(`Failed to close GitHub Issue: ${githubError.message}`);
          }
        } else {
          throw new Error(`Failed to close GitHub Issue: ${String(githubError)}`);
        }
      }
    }

    // 2. データベースレコード削除（Issue クローズ成功後のみ実行）
    await db.deleteFrom('specs').where('id', '=', spec.id).execute();

    // 3. 仕様書ファイル削除（Issue クローズ成功後のみ実行）
    if (existsSync(specPath)) {
      unlinkSync(specPath);
    }

    // 4. spec.deleted イベント発火（すべて成功後のみ実行）
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
    // エラー時のロールバック（GitHub Issue クローズ失敗時、削除処理はスキップされる）
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
