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
import { generateBranchName, isHotfixBranch } from '../utils/branch-name-generator.js';
import {
  createPullRequest,
  recordPullRequestToIssue,
} from '../../integrations/github/pull-request.js';

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
 * 保護ブランチのリストを取得
 */
function getProtectedBranches(): string[] {
  const branches = process.env.PROTECTED_BRANCHES;
  if (branches) {
    return branches.split(',').map((b) => b.trim());
  }

  // デフォルト: main, develop
  return ['main', 'develop'];
}

/**
 * 指定されたブランチが保護ブランチかどうかを判定
 */
function isProtectedBranch(branchName: string): boolean {
  const protectedBranches = getProtectedBranches();
  return protectedBranches.includes(branchName);
}

/**
 * 保護ブランチでの作業時の警告表示
 */
async function handleProtectedBranchWarning(
  event: WorkflowEvent<{ oldPhase: string; newPhase: string }>,
  db: Kysely<Database>
): Promise<void> {
  try {
    // Gitリポジトリ確認
    if (!isGitRepository()) {
      return;
    }

    // tasks → implementation の場合のみチェック
    if (event.data.oldPhase !== 'tasks' || event.data.newPhase !== 'implementation') {
      return;
    }

    // 現在のブランチを取得
    const currentBranch = getCurrentBranch();
    if (!currentBranch) {
      return;
    }

    // 保護ブランチの場合は警告表示
    if (isProtectedBranch(currentBranch)) {
      // 仕様書取得
      const spec = await db
        .selectFrom('specs')
        .where('id', '=', event.specId)
        .selectAll()
        .executeTakeFirst();

      if (spec) {
        const suggestedBranch = generateBranchName(spec.name);
        console.warn('\n⚠️  Warning: You are on a protected branch:', currentBranch);
        console.warn('   Suggested branch:', suggestedBranch);
        console.warn('   This branch will be automatically created.\n');
      }
    }
  } catch (error) {
    // 警告表示のエラーは無視
    const errorHandler = getErrorHandler();
    const errorObj = error instanceof Error ? error : new Error(String(error));
    await errorHandler.handle(errorObj, {
      event: 'spec.phase_changed',
      specId: event.specId,
      action: 'protected_branch_warning',
    });
  }
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

    // ベースブランチ決定（hotfix の場合は main、それ以外は GITHUB_DEFAULT_BASE_BRANCH）
    const baseBranch = isHotfixBranch(currentBranch)
      ? 'main'
      : process.env.GITHUB_DEFAULT_BASE_BRANCH || 'develop';

    console.log(`\nℹ Creating pull request from '${currentBranch}' to '${baseBranch}'...`);

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
      await db
        .updateTable('github_sync')
        .set({
          pr_number: result.pullRequestNumber,
          pr_url: result.pullRequestUrl,
          updated_at: new Date().toISOString(),
        })
        .where('entity_id', '=', event.specId)
        .where('entity_type', '=', 'spec')
        .execute();
    } else {
      console.warn('\n⚠️  Failed to create pull request:', result.error);
      console.warn('   Please create a PR manually\n');
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
    console.warn('\n⚠️  Failed to create pull request');
    console.warn('   Please create a PR manually\n');
  }
}

/**
 * ブランチ管理のイベントハンドラーを登録
 */
export function registerBranchManagementHandlers(eventBus: EventBus, db: Kysely<Database>): void {
  // spec.phase_changed → 保護ブランチ警告（tasks → implementation）
  eventBus.on<{ oldPhase: string; newPhase: string }>(
    'spec.phase_changed',
    async (event: WorkflowEvent<{ oldPhase: string; newPhase: string }>) => {
      await handleProtectedBranchWarning(event, db);
    }
  );

  // spec.phase_changed → PR自動作成（implementation → completed）
  eventBus.on<{ oldPhase: string; newPhase: string }>(
    'spec.phase_changed',
    async (event: WorkflowEvent<{ oldPhase: string; newPhase: string }>) => {
      await handlePullRequestCreationOnCompleted(event, db);
    }
  );
}
