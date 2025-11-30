/**
 * ブランチ削除処理のエラー
 */

import { AppError, ErrorLevel, ErrorCategory } from './error-handler.js';
import type { ErrorMetadata } from '../types/common.js';

/**
 * ブランチクリーンアップエラー
 *
 * PR マージ後のブランチ削除処理で発生するエラー。
 */
export class BranchCleanupError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(
      message,
      'BRANCH_CLEANUP_ERROR',
      ErrorLevel.ERROR,
      ErrorCategory.VALIDATION,
      400,
      metadata
    );
    this.name = 'BranchCleanupError';
  }
}
