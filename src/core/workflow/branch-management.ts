/**
 * ブランチ管理機能
 *
 * フェーズ移行時のブランチ自動作成・切り替えを担当します。
 */

import { execSync } from 'node:child_process';
import { Kysely } from 'kysely';
import { Database } from '../database/schema.js';
import { EventBus, WorkflowEvent } from './event-bus.js';
import { getErrorHandler } from '../errors/error-handler.js';
import { isHotfixBranch } from '../utils/branch-name-generator.js';
import {
  createPullRequest,
  recordPullRequestToIssue,
} from '../../integrations/github/pull-request.js';
import { getGitHubClient } from '../../integrations/github/client.js';
import { getGitHubConfig } from '../config/github-config.js';

/**
 * Gitリポジトリの存在確認
 */
function isGitRepository(): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 現在のブランチ名を取得
 */
function getCurrentBranch(): string | null {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return branch;
  } catch {
    return null;
  }
}

/**
 * 指定されたブランチが保護ブランチかどうかを判定
 */
function isProtectedBranch(branchName: string): boolean {
  const config = getGitHubConfig();
  return config.protectedBranches.includes(branchName);
}

/**
 * PR作成失敗時のエラーメッセージを表示
 */
function printPullRequestError(error?: string): void {
  console.warn('\n⚠️  Failed to create pull request');

  if (error) {
    console.warn(`   Reason: ${error}`);
  }

  if (error?.includes('not initialized')) {
    console.warn('   Please run: /cft:github-init <owner> <repo>');
  } else if (error?.includes('Repository owner or name not found')) {
    console.warn('   Please set GITHUB_OWNER and GITHUB_REPO in .env');
  } else {
    console.warn('   Please create a PR manually');
  }
  console.warn('');
}

/**
 * completed フェーズ移行時のPR自動作成処理
 */
async function handlePullRequestCreationOnCompleted(
  event: WorkflowEvent<{ oldPhase: string; newPhase: string }>,
  db: Kysely<Database>
): Promise<void> {
  try {
    // Gitリポジトリ確認
    if (!isGitRepository()) {
      console.log('\nℹ Not a Git repository, skipping PR creation');
      return;
    }

    // implementation → completed の場合のみ処理
    if (event.data.oldPhase !== 'implementation' || event.data.newPhase !== 'completed') {
      return;
    }

    // 現在のブランチを取得
    const currentBranch = getCurrentBranch();
    if (!currentBranch) {
      console.warn('\n⚠️  Failed to get current branch, skipping PR creation');
      return;
    }

    // 保護ブランチの場合はPR作成をスキップ
    if (isProtectedBranch(currentBranch)) {
      console.warn(`\n⚠️  On protected branch '${currentBranch}', skipping PR creation`);
      console.warn('   Please create a PR manually\n');
      return;
    }

    // ベースブランチ決定（hotfix の場合は main、それ以外は設定値）
    const config = getGitHubConfig();
    const baseBranch = isHotfixBranch(currentBranch) ? 'main' : config.defaultBaseBranch;

    console.log(`\nℹ Creating pull request from '${currentBranch}' to '${baseBranch}'...`);

    // GitHub クライアント初期化状態を事前チェック
    try {
      getGitHubClient();
    } catch {
      console.warn('\n⚠️  GitHub client not initialized');
      console.warn('   Please run: /cft:github-init <owner> <repo>');
      console.warn('   Skipping automatic PR creation\n');
      return; // PR作成をスキップ
    }

    // PR作成
    const result = await createPullRequest(db, {
      specId: event.specId,
      branchName: currentBranch,
      baseBranch,
    });

    if (result.success && result.pullRequestUrl && result.pullRequestNumber) {
      console.log(`✓ Pull request created: ${result.pullRequestUrl}\n`);

      // Issue にPR URLを記録
      await recordPullRequestToIssue(db, event.specId, result.pullRequestUrl);

      // github_sync テーブルに PR 番号を記録
      const updateResult = await db
        .updateTable('github_sync')
        .set({
          pr_number: result.pullRequestNumber,
          pr_url: result.pullRequestUrl,
          updated_at: new Date().toISOString(),
        })
        .where('entity_id', '=', event.specId)
        .where('entity_type', '=', 'spec')
        .executeTakeFirst();

      // 更新件数が 0 の場合は警告
      if (!updateResult || updateResult.numUpdatedRows === 0n) {
        console.warn('\n⚠️  Failed to record PR info to github_sync table');
        console.warn(`   Spec ID: ${event.specId} does not have a github_sync record`);
        console.warn('   Please check if the GitHub Issue was created for this spec\n');
      }
    } else {
      printPullRequestError(result.error);
    }
  } catch (error) {
    // エラーが発生してもフェーズ変更は成功させる
    const errorHandler = getErrorHandler();
    const errorObj = error instanceof Error ? error : new Error(String(error));
    await errorHandler.handle(errorObj, {
      event: 'spec.phase_changed',
      specId: event.specId,
      action: 'pr_auto_create',
    });
    printPullRequestError();
  }
}

/**
 * ブランチ管理のイベントハンドラーを登録
 */
export function registerBranchManagementHandlers(eventBus: EventBus, db: Kysely<Database>): void {
  // spec.phase_changed → PR自動作成（implementation → completed）
  eventBus.on<{ oldPhase: string; newPhase: string }>(
    'spec.phase_changed',
    async (event: WorkflowEvent<{ oldPhase: string; newPhase: string }>) => {
      await handlePullRequestCreationOnCompleted(event, db);
    }
  );
}
