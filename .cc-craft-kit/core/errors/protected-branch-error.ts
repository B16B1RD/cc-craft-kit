/**
 * 保護対象ブランチでの編集を防ぐためのエラー
 */

import { AppError, ErrorLevel, ErrorCategory } from './error-handler.js';
import type { ErrorMetadata } from '../types/common.js';

/**
 * 保護対象ブランチエラー
 *
 * 統合ブランチ（main, develop など）での直接編集を試みた場合にスローされる。
 */
export class ProtectedBranchError extends AppError {
  constructor(
    public readonly branch: string,
    public readonly protectedBranches: string[],
    public readonly suggestions: string[],
    metadata?: ErrorMetadata
  ) {
    const message = `
エラー: 統合ブランチ '${branch}' での直接編集は禁止されている。

適切な作業ブランチを作成すること:
${suggestions.map((s) => `  git checkout -b ${s}`).join('\n')}

統合ブランチ: ${protectedBranches.join(', ')}
    `.trim();

    super(
      message,
      'PROTECTED_BRANCH_ERROR',
      ErrorLevel.ERROR,
      ErrorCategory.VALIDATION,
      403,
      metadata
    );
    this.name = 'ProtectedBranchError';
  }

  /**
   * エラー情報を JSON 形式で取得
   */
  override toJSON() {
    return {
      ...super.toJSON(),
      branch: this.branch,
      protectedBranches: this.protectedBranches,
      suggestions: this.suggestions,
    };
  }
}
