/**
 * GitHub プルリクエスト マージ後処理
 */

import { Kysely } from 'kysely';
import { Database } from '../../core/database/schema.js';
import { getGitHubClient, GitHubClient } from './client.js';
import {
  getSpecWithGitHubInfo,
  updateSpecBranchToBaseBranch,
  updatePrMergedStatus,
} from '../../core/database/helpers.js';
import {
  deleteLocalBranch,
  deleteRemoteBranch,
  isProtectedBranch,
} from '../../core/workflow/branch-cleanup.js';
import { getEventBusAsync } from '../../core/workflow/event-bus.js';
import { BranchCleanupError } from '../../core/errors/branch-cleanup-error.js';
import { getGitHubConfig } from '../../core/config/github-config.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * PR クリーンアップ結果
 */
export interface CleanupResult {
  success: boolean;
  prNumber?: number;
  branchName?: string;
  mergedAt?: string | null;
  error?: string;
}

/**
 * config.json から GitHub 設定を読み込む
 *
 * @returns GitHub 設定（owner, repo）または null
 */
function loadGitHubConfigFromFile(): { owner: string; repo: string } | null {
  const ccCraftKitDir = join(process.cwd(), '.cc-craft-kit');
  const configPath = join(ccCraftKitDir, 'config.json');

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (!config.github || !config.github.owner || !config.github.repo) {
      return null;
    }

    return {
      owner: config.github.owner,
      repo: config.github.repo,
    };
  } catch (error) {
    console.warn('⚠️  Warning: Failed to parse config.json. GitHub integration may not work.');
    if (process.env.DEBUG) {
      console.warn(error);
    }
    return null;
  }
}

/**
 * PR マージ状態を確認
 *
 * @param client - GitHub クライアント
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param prNumber - PR 番号
 * @returns PR がマージ済みの場合は true
 */
export async function checkPullRequestMerged(
  client: GitHubClient,
  owner: string,
  repo: string,
  prNumber: number
): Promise<boolean> {
  const { data: pr } = await client.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  return pr.merged;
}

/**
 * PR マージ後の後処理を実行
 *
 * 1. PR マージ状態を確認
 * 2. ローカルブランチ削除
 * 3. リモートブランチ削除
 * 4. データベース更新
 * 5. イベント発火
 *
 * @param db - Kysely データベースインスタンス
 * @param specId - 仕様書ID（前方一致検索）
 * @returns クリーンアップ結果
 */
export async function cleanupMergedPullRequest(
  db: Kysely<Database>,
  specId: string
): Promise<CleanupResult> {
  // GitHub クライアント取得（未初期化の場合は環境変数から初期化）
  let client: GitHubClient;
  try {
    client = getGitHubClient();
  } catch {
    // 未初期化の場合は環境変数から初期化を試みる
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return {
        success: false,
        error:
          'GitHub client not initialized. Run `/cft:github-init <owner> <repo>` or set GITHUB_TOKEN environment variable.',
      };
    }
    const { initGitHubClient } = await import('./client.js');
    client = initGitHubClient({ token });
  }

  // GitHub 設定取得（環境変数優先、config.json フォールバック）
  const envConfig = getGitHubConfig();
  const fileConfig = loadGitHubConfigFromFile();

  const owner = envConfig.owner || fileConfig?.owner;
  const repo = envConfig.repo || fileConfig?.repo;

  if (!owner || !repo) {
    return {
      success: false,
      error:
        'GitHub repository not configured. Run `/cft:github-init <owner> <repo>` or set GITHUB_OWNER and GITHUB_REPO environment variables.',
    };
  }

  // 1. 仕様書と GitHub 情報を取得
  const spec = await getSpecWithGitHubInfo(db, specId);
  if (!spec) {
    return {
      success: false,
      error: `仕様書が見つかりません: ${specId}`,
    };
  }

  if (!spec.pr_number) {
    return {
      success: false,
      error:
        'PR が作成されていません。先に /cft:spec-phase <spec-id> completed を実行してください。',
    };
  }

  // 2. PR マージ状態を確認
  let pr;
  try {
    const { data } = await client.rest.pulls.get({
      owner,
      repo,
      pull_number: spec.pr_number,
    });
    pr = data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to fetch PR #${spec.pr_number} from ${owner}/${repo}: ${errorMessage}. Check your GitHub token and repository settings.`,
    };
  }

  if (!pr.merged) {
    return {
      success: false,
      error: `PR #${spec.pr_number} is not merged yet. Merge the PR on GitHub first, then run this command again.`,
    };
  }

  if (!spec.branch_name) {
    return {
      success: false,
      error: 'ブランチ名が見つかりません',
    };
  }

  const branchName: string = spec.branch_name;

  // 3. 保護ブランチチェック
  if (isProtectedBranch(branchName)) {
    return {
      success: false,
      error: `保護ブランチは削除できません: ${branchName}`,
    };
  }

  // 4. ローカルブランチ削除
  try {
    deleteLocalBranch(branchName);
  } catch (error) {
    if (error instanceof BranchCleanupError) {
      return {
        success: false,
        error: error.message,
      };
    }
    // その他のエラーは警告として表示し、処理を継続
    console.warn(`⚠️  ローカルブランチの削除に失敗しました: ${branchName}`);
  }

  // 5. リモートブランチ削除
  try {
    deleteRemoteBranch(branchName);
  } catch (error) {
    if (error instanceof BranchCleanupError) {
      return {
        success: false,
        error: error.message,
      };
    }
    // その他のエラーは警告として表示し、処理を継続
    console.warn(`⚠️  リモートブランチの削除に失敗しました: ${branchName}`);
  }

  // 6. データベース更新
  try {
    await db.transaction().execute(async (trx) => {
      // specs.branch_name を PR のベースブランチに更新
      // PR マージ後、作業ブランチは削除されるため、仕様書ファイルはベースブランチに存在する
      const baseBranch = pr.base.ref;
      await updateSpecBranchToBaseBranch(trx, spec.id, baseBranch);

      // github_sync.pr_merged_at を記録
      await updatePrMergedStatus(trx, spec.id, pr.merged_at || new Date().toISOString());
    });
  } catch (error) {
    return {
      success: false,
      error: `データベース更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // 7. イベント発火
  try {
    const eventBus = await getEventBusAsync();
    await eventBus.emit({
      type: 'spec.pr_merged',
      timestamp: new Date().toISOString(),
      specId: spec.id,
      data: {
        prNumber: spec.pr_number,
        branchName,
        mergedAt: pr.merged_at,
      },
    });
  } catch (error) {
    // イベント発火失敗はログのみ（処理は成功扱い）
    console.warn(
      `⚠️  イベント発火に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return {
    success: true,
    prNumber: spec.pr_number,
    branchName,
    mergedAt: pr.merged_at,
  };
}
