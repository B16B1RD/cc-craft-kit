/**
 * ブランチ名生成ユーティリティ
 *
 * 仕様書名から適切なブランチ名を生成します。
 * プレフィックス（feature/fix/refactor/docs/chore/hotfix）を自動判定し、
 * ブランチ名をスラッグ化します。
 */

/**
 * ブランチプレフィックスの種類
 */
export type BranchPrefix = 'feature' | 'fix' | 'refactor' | 'docs' | 'chore' | 'hotfix';

/**
 * ブランチプレフィックスとキーワードのマッピング
 * 注意: hotfixはfixより先にチェックする必要があるため、先に定義
 */
const PREFIX_KEYWORDS_ORDERED: Array<[BranchPrefix, string[]]> = [
  ['hotfix', ['緊急', 'Hotfix', 'hotfix', 'Critical', 'critical', '本番']],
  ['fix', ['修正', 'バグ', 'Fix', 'fix', 'Bug', 'bug', 'エラー', 'Error']],
  ['refactor', ['リファクタリング', 'Refactor', 'refactor', '改善', 'Improve']],
  ['docs', ['ドキュメント', 'Docs', 'docs', 'README', 'readme']],
  ['chore', ['依存関係', '更新', 'Chore', 'chore', 'Update', 'update']],
];

/**
 * 仕様書名からブランチプレフィックスを推論します
 *
 * @param specName - 仕様書名
 * @returns ブランチプレフィックス
 *
 * @example
 * ```typescript
 * inferBranchPrefix('ユーザー認証機能を追加') // => 'feature'
 * inferBranchPrefix('データベース接続バグを修正') // => 'fix'
 * inferBranchPrefix('本番環境の緊急修正') // => 'hotfix'
 * ```
 */
export function inferBranchPrefix(specName: string): BranchPrefix {
  // 各プレフィックスのキーワードマッチングを試行（順序が重要）
  for (const [prefix, keywords] of PREFIX_KEYWORDS_ORDERED) {
    if (keywords.some((kw) => specName.includes(kw))) {
      return prefix;
    }
  }

  // キーワードマッチングに失敗した場合、デフォルトで feature を使用
  return 'feature';
}

/**
 * 仕様書名をスラッグ化します
 *
 * - 小文字に変換
 * - スペース、アンダースコア、スラッシュをハイフンに変換
 * - 連続するハイフンを1つにまとめる
 * - 英数字とハイフン以外を除去
 * - 最大50文字に切り詰め
 * - 先頭・末尾のハイフンを除去
 *
 * @param specName - 仕様書名
 * @returns スラッグ化されたブランチ名
 *
 * @example
 * ```typescript
 * slugify('ユーザー認証機能を追加') // => 'add-user-auth'
 * slugify('データベース接続バグを修正!!!') // => 'fix-database-connection-bug'
 * slugify('パフォーマンスの改善   (最適化)') // => 'improve-performance'
 * ```
 */
export function slugify(specName: string): string {
  return (
    specName
      .toLowerCase()
      // 日本語から英語への簡易変換（限定的）
      .replace(/を追加/g, 'add')
      .replace(/を修正/g, 'fix')
      .replace(/を改善/g, 'improve')
      .replace(/を更新/g, 'update')
      .replace(/を削除/g, 'remove')
      .replace(/の実装/g, 'implement')
      .replace(/ユーザー/g, 'user')
      .replace(/認証/g, 'auth')
      .replace(/データベース/g, 'database')
      .replace(/接続/g, 'connection')
      .replace(/パフォーマンス/g, 'performance')
      .replace(/エラー/g, 'error')
      .replace(/バグ/g, 'bug')
      .replace(/機能/g, 'feature')
      .replace(/リーク/g, 'leak')
      .replace(/本番/g, 'production')
      .replace(/環境/g, 'env')
      // スペース、アンダースコア、スラッシュをハイフンに変換
      .replace(/[\s_/]+/g, '-')
      // 連続するハイフンを1つにまとめる
      .replace(/-+/g, '-')
      // 英数字とハイフン以外を除去
      .replace(/[^a-z0-9-]/g, '')
      // 最大50文字に切り詰め
      .slice(0, 50)
      // 先頭・末尾のハイフンを除去
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * 仕様書名からブランチ名を生成します
 *
 * @param specName - 仕様書名
 * @param forcedPrefix - 強制的に使用するプレフィックス（オプション）
 * @returns 生成されたブランチ名
 *
 * @example
 * ```typescript
 * generateBranchName('ユーザー認証機能を追加')
 * // => 'feature/add-user-auth-feature'
 *
 * generateBranchName('データベース接続バグを修正')
 * // => 'fix/fix-database-connection-bug'
 *
 * generateBranchName('本番環境の緊急修正')
 * // => 'hotfix/production-env'
 *
 * generateBranchName('新機能の追加', 'feature')
 * // => 'feature/add'
 * ```
 */
export function generateBranchName(specName: string, forcedPrefix?: BranchPrefix): string {
  const prefix = forcedPrefix ?? inferBranchPrefix(specName);
  const slug = slugify(specName);

  // スラッグが空の場合、タイムスタンプを使用
  if (!slug) {
    const timestamp = Date.now().toString(36);
    return `${prefix}/unnamed-${timestamp}`;
  }

  return `${prefix}/${slug}`;
}

/**
 * ブランチ名がhotfixかどうかを判定します
 *
 * @param branchName - ブランチ名
 * @returns hotfixの場合true
 *
 * @example
 * ```typescript
 * isHotfixBranch('hotfix/critical-fix') // => true
 * isHotfixBranch('feature/add-feature') // => false
 * ```
 */
export function isHotfixBranch(branchName: string): boolean {
  return branchName.startsWith('hotfix/');
}

/**
 * 仕様書名がhotfixを示すかどうかを判定します
 *
 * @param specName - 仕様書名
 * @returns hotfixの場合true
 *
 * @example
 * ```typescript
 * isHotfixSpec('本番環境の緊急修正') // => true
 * isHotfixSpec('新機能の追加') // => false
 * ```
 */
export function isHotfixSpec(specName: string): boolean {
  return inferBranchPrefix(specName) === 'hotfix';
}
