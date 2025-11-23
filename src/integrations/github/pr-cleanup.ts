/**
 * GitHub プルリクエスト マージ後処理
 */

import { Kysely } from 'kysely';
import { Database } from '../../core/database/schema.js';
import { getGitHubClient, GitHubClient } from './client.js';
import {
  getSpecWithGitHubInfo,
  clearSpecBranchName,
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
  const client = getGitHubClient();
  const config = getGitHubConfig();

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

  // 2. GitHub 設定確認
  if (!config.owner || !config.repo) {
    return {
      success: false,
      error: 'GitHub が設定されていません。/cft:github-init <owner> <repo> を実行してください。',
    };
  }

  // 3. PR マージ状態を確認
  let pr;
  try {
    const { data } = await client.rest.pulls.get({
      owner: config.owner,
      repo: config.repo,
      pull_number: spec.pr_number,
    });
    pr = data;
  } catch (error) {
    return {
      success: false,
      error: `PR の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (!pr.merged) {
    return {
      success: false,
      error: `PR #${spec.pr_number} はまだマージされていません。GitHub でマージを完了してから再実行してください。`,
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
      // specs.branch_name をクリア
      await clearSpecBranchName(trx, spec.id);

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
