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
 * ブランチ名のバリデーション（コマンドインジェクション対策）
 */
function validateBranchName(branchName: string): boolean {
  const VALID_BRANCH_NAME_PATTERN = /^[a-zA-Z0-9/_-]+$/;
  return VALID_BRANCH_NAME_PATTERN.test(branchName);
}

/**
 * ブランチがリモートにプッシュされているかチェック
 */
async function checkRemoteBranchExists(branchName: string): Promise<boolean> {
  // ブランチ名のバリデーション
  if (!validateBranchName(branchName)) {
    throw new Error(`Invalid branch name: ${branchName}`);
  }

  try {
    execSync(`git ls-remote --heads origin ${branchName}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * PR作成失敗時のエラーメッセージを表示
 */
function printPullRequestError(error?: string): void {
  console.warn('\n⚠️  Failed to create pull request');

  if (error) {
    console.warn(`   Reason: ${error}`);
  }

  // エラーケース別にメッセージを分岐
  if (error?.includes('not initialized')) {
    console.warn('\n   対応策: GitHub クライアントを初期化してください');
    console.warn('   /cft:github-init <owner> <repo>');
  } else if (error?.includes('Repository owner or name not found')) {
    console.warn('\n   対応策: .env ファイルに GITHUB_OWNER と GITHUB_REPO を設定してください');
    console.warn('   例:');
    console.warn('     GITHUB_OWNER=your-username');
    console.warn('     GITHUB_REPO=your-repo-name');
  } else if (error?.includes('push') || error?.includes('Push')) {
    console.warn('\n   対応策: ブランチを手動でプッシュしてから、再度 PR 作成を試してください');
    console.warn('   git push -u origin <branch-name>');
  } else {
    console.warn('\n   対応策: 以下のコマンドで手動 PR 作成を試してください');
    console.warn('   gh pr create --title "タイトル" --body "説明"');
    console.warn('\n   または、GitHub Web UI から PR を作成してください');
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
    const defaultBaseBranch = isHotfixBranch(currentBranch) ? 'main' : config.defaultBaseBranch;

    // ブランチがリモートにプッシュされているかチェック
    const isRemoteBranchExists = await checkRemoteBranchExists(currentBranch);

    if (!isRemoteBranchExists) {
      // ブランチ名のバリデーション
      if (!validateBranchName(currentBranch)) {
        console.error(`\n❌ 不正なブランチ名です: ${currentBranch}`);
        console.error(
          `   ブランチ名は英数字、アンダースコア(_)、ハイフン(-)、スラッシュ(/)のみ使用できます\n`
        );
        return;
      }

      // 自動プッシュ
      console.log(`\n⚠️  ブランチがリモートにプッシュされていません。自動プッシュを実行します...`);

      try {
        execSync(`git push -u origin ${currentBranch}`, {
          stdio: 'inherit',
          env: {
            ...process.env,
            GIT_ASKPASS: 'echo',
            GIT_TERMINAL_PROMPT: '0',
          },
        });

        console.log(`\n✓ ブランチをリモートにプッシュしました: ${currentBranch}`);
      } catch {
        console.error(`\n❌ ブランチのプッシュに失敗しました`);
        console.error(`\n対応策: 以下のコマンドで手動プッシュしてください:`);
        console.error(`  git push -u origin ${currentBranch}\n`);
        return; // PR作成をスキップ
      }
    }

    console.log(`\nℹ Creating pull request from '${currentBranch}' to '${defaultBaseBranch}'...`);

    // PR作成
    const result = await createPullRequest(db, {
      specId: event.specId,
      branchName: currentBranch,
      defaultBaseBranch,
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
