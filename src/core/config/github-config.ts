/**
 * GitHub 統合設定管理
 *
 * 環境変数から GitHub 関連の設定を読み込み、型安全にアクセスできるようにします。
 */

/**
 * GitHub 設定インターフェース
 */
export interface GitHubConfig {
  /** リポジトリオーナー名 */
  owner: string | null;
  /** リポジトリ名 */
  repo: string | null;
  /** デフォルトのベースブランチ(PR作成時のマージ先) */
  defaultBaseBranch: string;
  /** 保護ブランチのリスト */
  protectedBranches: string[];
}

/**
 * GitHub 設定を取得
 *
 * 環境変数から GitHub 関連の設定を読み込みます。
 * 設定されていない場合はデフォルト値を使用します。
 *
 * @returns GitHub 設定オブジェクト
 */
export function getGitHubConfig(): GitHubConfig {
  return {
    owner: process.env.GITHUB_OWNER?.trim() || null,
    repo: process.env.GITHUB_REPO?.trim() || null,
    defaultBaseBranch: process.env.GITHUB_DEFAULT_BASE_BRANCH?.trim() || 'develop',
    protectedBranches: process.env.PROTECTED_BRANCHES?.split(',')
      .map((b) => b.trim())
      .filter(Boolean) || ['main', 'develop'],
  };
}
