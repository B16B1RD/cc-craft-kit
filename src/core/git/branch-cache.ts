/**
 * Git ブランチ名のキャッシュ機構
 *
 * git rev-parse の実行コストを削減するため、プロセスごとにブランチ名をキャッシュします。
 */

import { execSync } from 'node:child_process';

/**
 * キャッシュされたブランチ名（プロセス単位）
 */
let cachedBranchName: string | null = null;

/**
 * 現在のブランチ名を取得
 *
 * @param options - オプション
 * @param options.cache - キャッシュを使用するか（デフォルト: true）
 * @returns ブランチ名（Git リポジトリ未初期化の場合は 'main'）
 *
 * @example
 * ```typescript
 * // キャッシュを使用（推奨）
 * const branch = getCurrentBranch();
 *
 * // キャッシュを無効化して最新のブランチ名を取得
 * const branch = getCurrentBranch({ cache: false });
 * ```
 */
export function getCurrentBranch(options: { cache: boolean } = { cache: true }): string {
  // キャッシュが有効で、キャッシュが存在する場合はキャッシュを返す
  if (options.cache && cachedBranchName !== null) {
    return cachedBranchName;
  }

  try {
    // git rev-parse で現在のブランチ名を取得
    const branchName = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'], // stderr を抑制
    }).trim();

    // キャッシュに保存
    cachedBranchName = branchName;
    return branchName;
  } catch (error) {
    // Git リポジトリ未初期化、またはエラーの場合はデフォルト値を返す
    const defaultBranch = 'main';
    cachedBranchName = defaultBranch;
    return defaultBranch;
  }
}

/**
 * ブランチ名のキャッシュをクリア
 *
 * ブランチ切り替え後など、最新のブランチ名を取得したい場合に使用します。
 *
 * @example
 * ```typescript
 * // ブランチ切り替え後にキャッシュをクリア
 * execSync('git checkout feature/new-branch');
 * clearBranchCache();
 *
 * // 次回の getCurrentBranch() で最新のブランチ名を取得
 * const branch = getCurrentBranch();
 * ```
 */
export function clearBranchCache(): void {
  cachedBranchName = null;
}
