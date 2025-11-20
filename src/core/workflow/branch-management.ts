/**
 * ブランチ管理機能
 *
 * フェーズ移行時のブランチ自動作成・切り替えを担当します。
 */

import { execSync, spawnSync } from 'node:child_process';
import { Kysely } from 'kysely';
import { Database } from '../database/schema.js';
import { EventBus, WorkflowEvent } from './event-bus.js';
import { getErrorHandler } from '../errors/error-handler.js';
import {
  generateBranchName,
  isHotfixSpec,
  isHotfixBranch,
} from '../utils/branch-name-generator.js';
import {
  createPullRequest,
  recordPullRequestToIssue,
} from '../../integrations/github/pull-request.js';

/**
 * フェーズ型定義
 */
type Phase = 'requirements' | 'design' | 'tasks' | 'implementation' | 'completed';

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
 * ベースブランチの取得（.env の BASE_BRANCH または develop）
 */
function getBaseBranch(): string {
  return process.env.BASE_BRANCH || 'develop';
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
 * ブランチが存在するかチェック
 */
function branchExists(branchName: string): boolean {
  try {
    execSync(`git rev-parse --verify ${branchName}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * ベースブランチから新しいブランチを作成
 */
function createBranchFromBase(
  branchName: string,
  baseBranch: string
): { success: boolean; error?: string } {
  try {
    // ベースブランチの存在確認
    if (!branchExists(baseBranch)) {
      return {
        success: false,
        error: `Base branch '${baseBranch}' does not exist`,
      };
    }

    // ベースブランチから新しいブランチを作成してチェックアウト
    const result = spawnSync('git', ['checkout', '-b', branchName, baseBranch], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.status !== 0) {
      return { success: false, error: result.stderr.toString() };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * 既存のブランチをチェックアウト
 */
function checkoutBranch(branchName: string): { success: boolean; error?: string } {
  try {
    const result = spawnSync('git', ['checkout', branchName], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.status !== 0) {
      return { success: false, error: result.stderr.toString() };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * tasks → implementation フェーズ移行時のブランチ自動作成処理
 */
async function handleBranchCreationOnImplementation(
  event: WorkflowEvent<{ oldPhase: string; newPhase: string }>,
  db: Kysely<Database>
): Promise<void> {
  try {
    // Gitリポジトリ確認
    if (!isGitRepository()) {
      const errorHandler = getErrorHandler();
      await errorHandler.handle(new Error('Not a Git repository'), {
        event: 'spec.phase_changed',
        specId: event.specId,
        oldPhase: event.data.oldPhase,
        newPhase: event.data.newPhase,
        action: 'branch_auto_create',
        message: 'Skipping branch creation',
      });
      return;
    }

    // tasks → implementation の場合のみ処理
    if (event.data.oldPhase !== 'tasks' || event.data.newPhase !== 'implementation') {
      return;
    }

    // 仕様書取得
    const spec = await db
      .selectFrom('specs')
      .where('id', '=', event.specId)
      .selectAll()
      .executeTakeFirst();

    if (!spec) {
      return;
    }

    // 現在のブランチを取得
    const currentBranch = getCurrentBranch();
    if (!currentBranch) {
      throw new Error('Failed to get current branch');
    }

    // 保護ブランチでない場合はスキップ
    if (!isProtectedBranch(currentBranch)) {
      console.log(`\nℹ Already on a working branch '${currentBranch}', skipping branch creation`);
      return;
    }

    // ブランチ名生成
    const branchName = generateBranchName(spec.name);

    // ベースブランチ決定（hotfix の場合は main、それ以外は BASE_BRANCH）
    const baseBranch = isHotfixSpec(spec.name) ? 'main' : getBaseBranch();

    // ブランチが既に存在する場合はチェックアウト
    if (branchExists(branchName)) {
      const checkoutResult = checkoutBranch(branchName);
      if (checkoutResult.success) {
        console.log(`\n✓ Switched to existing branch '${branchName}'`);
        return;
      } else {
        throw new Error(checkoutResult.error || 'Failed to checkout branch');
      }
    }

    // 新しいブランチを作成
    const createResult = createBranchFromBase(branchName, baseBranch);
    if (createResult.success) {
      console.log(`\n✓ Created and switched to new branch '${branchName}' from '${baseBranch}'`);
    } else {
      throw new Error(createResult.error || 'Failed to create branch');
    }
  } catch (error) {
    // エラーが発生した場合、フェーズをロールバック
    const errorHandler = getErrorHandler();
    const errorObj = error instanceof Error ? error : new Error(String(error));
    await errorHandler.handle(errorObj, {
      event: 'spec.phase_changed',
      specId: event.specId,
      action: 'branch_auto_create',
    });

    // フェーズをロールバック
    await db
      .updateTable('specs')
      .set({ phase: event.data.oldPhase as Phase })
      .where('id', '=', event.specId)
      .execute();

    console.error('\n❌ Branch creation failed, rolled back phase to', event.data.oldPhase);
    console.log('Please create a branch manually and retry the phase transition\n');

    // エラーを再スロー
    throw errorObj;
  }
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

  // spec.phase_changed → ブランチ自動作成（tasks → implementation）
  eventBus.on<{ oldPhase: string; newPhase: string }>(
    'spec.phase_changed',
    async (event: WorkflowEvent<{ oldPhase: string; newPhase: string }>) => {
      await handleBranchCreationOnImplementation(event, db);
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
