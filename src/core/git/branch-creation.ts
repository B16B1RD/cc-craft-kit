/**
 * ブランチ作成ユーティリティ
 *
 * 仕様書作成時のブランチ自動作成ロジックを提供します。
 */

import { execFileSync } from 'node:child_process';
import { getCurrentBranch } from './branch-cache.js';

/**
 * カスタムブランチ名をサニタイズ
 *
 * @param name カスタムブランチ名
 * @returns サニタイズされたブランチ名
 * @throws Error サニタイゼーション後に空文字列になる場合
 */
function sanitizeBranchName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-') // Git 互換文字のみ許可（英数字、ハイフン、アンダースコア）
    .replace(/-+/g, '-') // 連続ハイフンを統合
    .replace(/^-|-$/g, ''); // 先頭・末尾のハイフンを削除

  // サニタイゼーション後の検証
  if (sanitized.length === 0) {
    throw new Error(
      'カスタムブランチ名が無効です。英数字、ハイフン、アンダースコアのみ使用できます。'
    );
  }

  return sanitized;
}

/**
 * ブランチ作成結果
 */
export interface BranchCreationResult {
  /** ブランチが作成されたかどうか */
  created: boolean;
  /** 作成されたブランチ名（作成されなかった場合は null） */
  branchName: string | null;
  /** 元のブランチ名 */
  originalBranch: string | null;
  /** ブランチが作成されなかった理由（作成された場合は undefined） */
  reason?: string;
}

/**
 * 仕様書用のブランチを作成
 *
 * @param specId 仕様書 ID
 * @param customBranchName カスタムブランチ名（省略可能）
 * @returns ブランチ作成結果
 * @throws Error ブランチ作成に失敗した場合
 *
 * @example
 * ```typescript
 * // カスタムブランチ名を使用
 * const result = createSpecBranch('12345678-1234-1234-1234-123456789abc', 'improve-branch-naming');
 * if (result.created) {
 *   console.log(`Created branch: ${result.branchName}`);
 * } else {
 *   console.log(`Skipped: ${result.reason}`);
 * }
 *
 * // デフォルトブランチ名を使用
 * const result2 = createSpecBranch('12345678-1234-1234-1234-123456789abc');
 * ```
 */
export function createSpecBranch(specId: string, customBranchName?: string): BranchCreationResult {
  // specId のバリデーション（UUID フォーマット検証）
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(specId)) {
    throw new Error(`Invalid spec ID format. Expected UUID, got: ${specId}`);
  }

  const shortSpecId = specId.substring(0, 8);

  // ブランチ名生成
  let branchName: string;
  if (customBranchName) {
    const sanitized = sanitizeBranchName(customBranchName);
    branchName = `spec/${shortSpecId}-${sanitized}`;
  } else {
    // フォールバック（従来形式）
    const sanitizedShortId = shortSpecId.replace(/[^0-9a-f]/gi, '');
    branchName = `spec/${sanitizedShortId}`;
  }

  // 1. Git リポジトリの存在確認
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
  } catch {
    return {
      created: false,
      branchName: null,
      originalBranch: null,
      reason: 'Git リポジトリが初期化されていません。git init を実行してください。',
    };
  }

  // 2. 現在のブランチ名を取得
  let originalBranch: string;
  try {
    originalBranch = getCurrentBranch();
  } catch (error) {
    throw new Error(
      `現在のブランチ名の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // 3. 保護ブランチチェック
  const protectedBranches = (process.env.PROTECTED_BRANCHES || 'main,develop')
    .split(',')
    .map((b) => b.trim());

  if (protectedBranches.includes(originalBranch)) {
    // 保護ブランチの場合、feature/ プレフィックス付きブランチを自動作成
    if (customBranchName) {
      const sanitized = sanitizeBranchName(customBranchName);
      branchName = `feature/spec-${shortSpecId}-${sanitized}`;
    } else {
      // カスタムブランチ名が未指定の場合
      branchName = `feature/spec-${shortSpecId}`;
    }
    // ブランチ作成処理へ進む（return しない）
  }

  // 4. ブランチ作成（切り替えなし）
  try {
    execFileSync('git', ['branch', branchName], { stdio: 'pipe' });
  } catch (error) {
    throw new Error(
      `ブランチ作成に失敗しました。既に同名のブランチが存在する可能性があります: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // 5. ブランチ作成の検証
  let branchExists: boolean;
  try {
    // git rev-parse でブランチの存在を確認
    execFileSync('git', ['rev-parse', '--verify', branchName], { stdio: 'ignore' });
    branchExists = true;
  } catch {
    branchExists = false;
  }

  if (!branchExists) {
    throw new Error(`ブランチ作成に失敗しました: ${branchName}`);
  }

  // 6. ブランチ作成成功（切り替えは行わない）
  return {
    created: true,
    branchName,
    originalBranch,
  };
}
