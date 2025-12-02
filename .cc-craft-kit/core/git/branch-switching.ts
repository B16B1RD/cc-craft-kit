/**
 * ブランチ切り替えユーティリティ
 *
 * /cft:spec-phase コマンド実行時の自動ブランチ切り替えロジックを提供します。
 */

import { execSync } from 'node:child_process';
import { getCurrentBranch, clearBranchCache } from './branch-cache.js';
import { checkGitStatus } from '../workflow/git-integration.js';

/**
 * ブランチ切り替え結果
 */
export interface BranchSwitchResult {
  /** ブランチが切り替わったか */
  switched: boolean;
  /** 切り替え前のブランチ */
  currentBranch: string;
  /** 切り替え先のブランチ */
  targetBranch: string;
  /** 切り替え前のブランチ（switched=true の場合のみ） */
  previousBranch?: string;
  /** スキップされた理由（switched=false の場合） */
  reason?: string;
}

/**
 * ブランチ切り替えエラー
 */
export class BranchSwitchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BranchSwitchError';
  }
}

/**
 * ブランチ名のバリデーション
 * 英数字、ハイフン、スラッシュ、アンダースコアのみ許可
 *
 * @param branchName - バリデーション対象のブランチ名
 * @throws BranchSwitchError - ブランチ名が不正な場合
 */
function validateBranchName(branchName: string): void {
  const validPattern = /^[a-zA-Z0-9/_-]+$/;
  if (!validPattern.test(branchName)) {
    throw new BranchSwitchError(`無効なブランチ名: ${branchName}`);
  }

  // 予約語チェック
  const reservedNames = ['HEAD', 'refs/heads/', 'refs/tags/'];
  if (reservedNames.some((reserved) => branchName.includes(reserved))) {
    throw new BranchSwitchError(`予約語を含むブランチ名は使用できません: ${branchName}`);
  }
}

/**
 * 保護ブランチかどうかを判定
 *
 * @param branchName - 判定対象のブランチ名
 * @returns 保護ブランチの場合 true
 */
function isProtectedBranch(branchName: string): boolean {
  const protectedBranches = (process.env.PROTECTED_BRANCHES || 'main,develop')
    .split(',')
    .map((b) => b.trim());
  return protectedBranches.includes(branchName);
}

/**
 * ブランチが存在するかチェック
 *
 * @param branchName - チェック対象のブランチ名
 * @returns ブランチが存在する場合 true
 */
function branchExists(branchName: string): boolean {
  try {
    execSync(`git rev-parse --verify ${branchName}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * ブランチ切り替え前の自動コミット
 *
 * @param targetBranch - 切り替え先のブランチ名
 * @throws BranchSwitchError - 自動コミットに失敗した場合
 */
function autoCommitBeforeSwitch(targetBranch: string): void {
  try {
    execSync('git add .', { stdio: 'pipe' });

    const commitMessage = `chore: auto-commit before switching to branch ${targetBranch}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>`;

    execSync(`git commit -m "${commitMessage}"`, { stdio: 'pipe' });
  } catch (error) {
    throw new BranchSwitchError(
      `自動コミットに失敗しました: ${error instanceof Error ? error.message : String(error)}\n` +
        `手動でコミットしてください: git add . && git commit -m "chore: auto-commit"`
    );
  }
}

/**
 * 指定されたブランチに切り替える
 *
 * @param targetBranch - 切り替え先のブランチ名
 * @returns ブランチ切り替え結果
 * @throws BranchSwitchError - ブランチ切り替えに失敗した場合
 *
 * @example
 * ```typescript
 * try {
 *   const result = switchBranch('feature/spec-12345678');
 *   if (result.switched) {
 *     console.log(`Switched to branch: ${result.targetBranch}`);
 *   } else {
 *     console.log(`Skipped: ${result.reason}`);
 *   }
 * } catch (error) {
 *   if (error instanceof BranchSwitchError) {
 *     console.error(error.message);
 *   }
 * }
 * ```
 */
export function switchBranch(targetBranch: string): BranchSwitchResult {
  // 1. ブランチ名のバリデーション
  validateBranchName(targetBranch);

  // 2. 保護ブランチチェック
  if (isProtectedBranch(targetBranch)) {
    throw new BranchSwitchError(`保護ブランチ ${targetBranch} への切り替えは禁止されています`);
  }

  // 3. ブランチ存在確認
  if (!branchExists(targetBranch)) {
    throw new BranchSwitchError(`ブランチ ${targetBranch} が見つかりません`);
  }

  // 4. 現在のブランチを取得
  const currentBranch = getCurrentBranch();

  // 5. 同じブランチの場合はスキップ
  if (currentBranch === targetBranch) {
    return {
      switched: false,
      currentBranch,
      targetBranch,
      reason: 'Already on target branch',
    };
  }

  // 6. 未コミット変更をチェック
  const gitStatus = checkGitStatus();
  if (gitStatus.hasChanges) {
    // 自動コミット実行
    autoCommitBeforeSwitch(targetBranch);
  }

  // 7. ブランチ切り替え実行
  try {
    execSync(`git checkout ${targetBranch}`, { stdio: 'pipe' });
  } catch (error) {
    throw new BranchSwitchError(
      `ブランチ切り替えに失敗しました: ${error instanceof Error ? error.message : String(error)}\n` +
        `手動で切り替えてください: git checkout ${targetBranch}`
    );
  }

  // 8. 切り替え成功を検証
  const newBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  if (newBranch !== targetBranch) {
    throw new BranchSwitchError(
      `ブランチ切り替え後の検証に失敗しました。期待: ${targetBranch}, 実際: ${newBranch}`
    );
  }

  // 9. ブランチキャッシュをクリア
  clearBranchCache();

  return {
    switched: true,
    currentBranch,
    targetBranch,
    previousBranch: currentBranch,
  };
}
