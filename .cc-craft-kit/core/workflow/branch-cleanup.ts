/**
 * ブランチ削除機能
 *
 * PR マージ後のローカルブランチとリモートブランチの削除を担当します。
 */

import { execSync } from 'node:child_process';
import { getGitHubConfig } from '../config/github-config.js';
import { BranchCleanupError } from '../errors/branch-cleanup-error.js';

/**
 * 指定されたブランチが保護ブランチかどうかを判定
 */
export function isProtectedBranch(branchName: string): boolean {
  const config = getGitHubConfig();
  return config.protectedBranches.includes(branchName);
}

/**
 * ローカルブランチを削除
 *
 * @param branchName - 削除するブランチ名
 * @throws {BranchCleanupError} 保護ブランチの削除を試行した場合
 */
export function deleteLocalBranch(branchName: string): void {
  // 保護ブランチチェック
  if (isProtectedBranch(branchName)) {
    throw new BranchCleanupError(`保護ブランチは削除できません: ${branchName}`);
  }

  try {
    // ローカルブランチ削除 (-D: 強制削除)
    execSync(`git branch -D ${branchName}`, {
      stdio: 'ignore',
    });
    console.log(`✓ ローカルブランチを削除しました: ${branchName}`);
  } catch (error) {
    // ブランチが存在しない場合は警告のみ（エラーにしない）
    if (
      (error instanceof Error && error.message.includes('not found')) ||
      (error instanceof Error && error.message.includes('does not exist'))
    ) {
      console.warn(`⚠️  ローカルブランチは既に削除済みです: ${branchName}`);
    } else {
      // その他のエラーは警告として表示し、処理を継続
      console.warn(`⚠️  ローカルブランチの削除に失敗しました: ${branchName}`);
      console.warn('   手動で削除してください');
    }
  }
}

/**
 * リモートブランチを削除
 *
 * @param branchName - 削除するブランチ名
 * @throws {BranchCleanupError} 保護ブランチの削除を試行した場合
 */
export function deleteRemoteBranch(branchName: string): void {
  // 保護ブランチチェック
  if (isProtectedBranch(branchName)) {
    throw new BranchCleanupError(`保護ブランチは削除できません: ${branchName}`);
  }

  try {
    // リモートブランチ削除
    execSync(`git push origin --delete ${branchName}`, {
      stdio: 'ignore',
    });
    console.log(`✓ リモートブランチを削除しました: ${branchName}`);
  } catch (error) {
    // ブランチが存在しない場合は警告のみ（エラーにしない）
    if (
      (error instanceof Error && error.message.includes('not found')) ||
      (error instanceof Error && error.message.includes('does not exist'))
    ) {
      console.warn(`⚠️  リモートブランチは既に削除済みです: ${branchName}`);
    } else {
      // その他のエラーは警告として表示し、処理を継続
      console.warn(`⚠️  リモートブランチの削除に失敗しました: ${branchName}`);
      console.warn('   手動で削除してください');
    }
  }
}
