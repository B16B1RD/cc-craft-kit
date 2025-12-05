/**
 * 仕様書削除 - Execute 層
 *
 * 仕様書の削除を実行します。
 * プロンプトから呼び出され、JSON 出力のみを行います。
 * UI 処理は一切含みません。
 */

import '../../core/config/env.js';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getSpec,
  deleteSpec,
  getGitHubSyncBySpecId,
  deleteGitHubSync,
} from '../../core/storage/index.js';
import { getEventBusAsync } from '../../core/workflow/event-bus.js';
import { GitHubClient } from '../../integrations/github/client.js';
import { GitHubIssues } from '../../integrations/github/issues.js';

/**
 * Execute 層の出力型定義
 */
export interface DeleteExecuteOutput {
  success: boolean;
  deletedSpecId?: string;
  deletedSpecName?: string;
  deletedPhase?: string;
  githubIssueNumber?: number | null;
  githubIssueStatus?: 'closed' | 'warning' | 'skipped';
  error?: string;
  errorCode?: 'NOT_FOUND' | 'AUTH_FAILED' | 'RATE_LIMIT' | 'API_ERROR' | 'DB_ERROR' | 'FILE_ERROR';
}

/**
 * GitHub 設定を取得
 */
function getGitHubConfig(ccCraftKitDir: string): { owner: string; repo: string } | null {
  const configPath = join(ccCraftKitDir, 'config.json');
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (!config.github?.owner || !config.github?.repo) {
      return null;
    }
    return { owner: config.github.owner, repo: config.github.repo };
  } catch {
    return null;
  }
}

/**
 * GitHub Issue をクローズ
 */
async function closeGitHubIssue(
  ccCraftKitDir: string,
  issueNumber: number
): Promise<{ status: 'closed' | 'warning'; error?: string }> {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken || githubToken.trim() === '') {
    return { status: 'warning', error: 'GITHUB_TOKEN が設定されていません' };
  }

  const githubConfig = getGitHubConfig(ccCraftKitDir);
  if (!githubConfig) {
    return { status: 'warning', error: 'GitHub 設定が見つかりません' };
  }

  const client = new GitHubClient({ token: githubToken });
  const issues = new GitHubIssues(client);

  try {
    await issues.close(githubConfig.owner, githubConfig.repo, issueNumber);
    return { status: 'closed' };
  } catch (error: unknown) {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();

      // 404: Issue が見つからない（警告のみ、削除続行）
      if (msg.includes('not found') || msg.includes('404')) {
        return { status: 'warning', error: `Issue #${issueNumber} が見つかりません` };
      }

      // 401: 認証失敗（中断）
      if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('bad credentials')) {
        throw new Error(`AUTH_FAILED:GitHub 認証に失敗しました。GITHUB_TOKEN を確認してください。`);
      }

      // 403: レート制限（中断）
      if (msg.includes('rate limit') || msg.includes('403') || msg.includes('forbidden')) {
        throw new Error(
          `RATE_LIMIT:GitHub API のレート制限に達しました。しばらく待ってから再試行してください。`
        );
      }

      // 500: API 障害（中断）
      if (msg.includes('server error') || msg.includes('500') || msg.includes('internal server')) {
        throw new Error(
          `API_ERROR:GitHub API に障害が発生しています。しばらく待ってから再試行してください。`
        );
      }
    }

    throw new Error(
      `API_ERROR:GitHub Issue のクローズに失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 仕様書削除を実行
 */
export async function executeDelete(
  specId: string,
  options: { closeGitHubIssue?: boolean } = {}
): Promise<DeleteExecuteOutput> {
  const { closeGitHubIssue: shouldCloseIssue = true } = options;
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const specsDir = join(ccCraftKitDir, 'specs');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    return {
      success: false,
      error: 'プロジェクトが初期化されていません。',
      errorCode: 'NOT_FOUND',
    };
  }

  // 仕様書取得
  const spec = getSpec(specId);

  if (!spec) {
    return {
      success: false,
      error: `仕様書が見つかりません: ${specId}`,
      errorCode: 'NOT_FOUND',
    };
  }

  // GitHub Issue 番号を取得
  const githubSync = getGitHubSyncBySpecId(specId);
  const issueNumber = githubSync?.github_number ?? null;
  let githubIssueStatus: 'closed' | 'warning' | 'skipped' = 'skipped';

  // 1. GitHub Issue クローズ（オプション）
  if (shouldCloseIssue && issueNumber) {
    try {
      const result = await closeGitHubIssue(ccCraftKitDir, issueNumber);
      githubIssueStatus = result.status;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const [errorCode, errorMessage] = message.includes(':')
        ? message.split(':', 2)
        : ['API_ERROR', message];

      return {
        success: false,
        error: errorMessage,
        errorCode: errorCode as DeleteExecuteOutput['errorCode'],
        githubIssueNumber: issueNumber,
      };
    }
  }

  try {
    // 2. JSON ストレージからレコード削除
    deleteSpec(specId);

    // github_sync レコードも削除
    if (githubSync) {
      deleteGitHubSync('spec', specId);
    }

    // 3. ファイル削除
    const specPath = join(specsDir, `${specId}.md`);
    if (existsSync(specPath)) {
      unlinkSync(specPath);
    }

    // 4. イベント発火
    const eventBus = await getEventBusAsync();
    await eventBus.emit(
      eventBus.createEvent('spec.deleted', specId, {
        name: spec.name,
        phase: spec.phase,
      })
    );

    return {
      success: true,
      deletedSpecId: specId,
      deletedSpecName: spec.name,
      deletedPhase: spec.phase,
      githubIssueNumber: issueNumber,
      githubIssueStatus,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `削除処理に失敗しました: ${message}`,
      errorCode: 'FILE_ERROR',
    };
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const specId = args[0];

  if (!specId) {
    const errorOutput: DeleteExecuteOutput = {
      success: false,
      error: 'Usage: npx tsx delete-execute.ts <spec-id> [--close-github-issue=true/false]',
    };
    console.log(JSON.stringify(errorOutput, null, 2));
    process.exit(1);
  }

  // オプション解析
  const closeGitHubIssueArg = args.find((arg) => arg.startsWith('--close-github-issue'));
  let closeGitHubIssue = true; // デフォルト: true
  if (closeGitHubIssueArg) {
    closeGitHubIssue = !closeGitHubIssueArg.includes('false');
  }

  executeDelete(specId, { closeGitHubIssue })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      const errorOutput: DeleteExecuteOutput = {
        success: false,
        error: message,
      };
      console.log(JSON.stringify(errorOutput, null, 2));
      process.exit(1);
    });
}
