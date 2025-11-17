/**
 * 入力検証ユーティリティ
 */

import {
  createInvalidSpecIdError,
  createInvalidPhaseError,
  createMissingArgumentError,
  createValidationError,
} from './error-handler.js';

/**
 * UUID v4 のパターン
 */
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 有効なフェーズ
 */
export const VALID_PHASES = [
  'requirements',
  'design',
  'tasks',
  'implementation',
  'completed',
] as const;

export type Phase = (typeof VALID_PHASES)[number];

/**
 * UUID 検証
 */
export function validateSpecId(specId: string): void {
  if (!specId) {
    throw createInvalidSpecIdError(specId);
  }

  // 部分一致を許可（最小8文字）
  if (specId.length < 8) {
    throw createInvalidSpecIdError(specId);
  }

  // 完全なUUIDの場合は厳密に検証
  if (specId.length === 36 && !UUID_V4_PATTERN.test(specId)) {
    throw createInvalidSpecIdError(specId);
  }
}

/**
 * フェーズ名検証
 */
export function validatePhase(phase: string): Phase {
  if (!VALID_PHASES.includes(phase as Phase)) {
    throw createInvalidPhaseError(phase);
  }
  return phase as Phase;
}

/**
 * GitHub リポジトリ形式検証
 */
export function validateGitHubRepo(owner: string, repo: string): void {
  // owner 検証
  if (!owner || owner.trim().length === 0) {
    throw createValidationError('owner', 'Repository owner cannot be empty');
  }

  if (!/^[a-zA-Z0-9-]+$/.test(owner)) {
    throw createValidationError(
      'owner',
      'Repository owner must contain only alphanumeric characters and hyphens'
    );
  }

  // repo 検証
  if (!repo || repo.trim().length === 0) {
    throw createValidationError('repo', 'Repository name cannot be empty');
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) {
    throw createValidationError(
      'repo',
      'Repository name must contain only alphanumeric characters, hyphens, dots, and underscores'
    );
  }
}

/**
 * 必須引数検証
 */
export function validateRequired<T>(value: T | undefined | null, argumentName: string): T {
  if (value === undefined || value === null) {
    throw createMissingArgumentError(argumentName);
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    throw createMissingArgumentError(argumentName);
  }

  return value;
}

/**
 * 数値検証
 */
export function validateNumber(
  value: string,
  argumentName: string,
  options: { min?: number; max?: number; integer?: boolean } = {}
): number {
  const num = Number(value);

  if (isNaN(num)) {
    throw createValidationError(argumentName, 'Must be a valid number');
  }

  if (options.integer && !Number.isInteger(num)) {
    throw createValidationError(argumentName, 'Must be an integer');
  }

  if (options.min !== undefined && num < options.min) {
    throw createValidationError(argumentName, `Must be at least ${options.min}`);
  }

  if (options.max !== undefined && num > options.max) {
    throw createValidationError(argumentName, `Must be at most ${options.max}`);
  }

  return num;
}

/**
 * 列挙値検証
 */
export function validateEnum<T extends string>(
  value: string,
  validValues: readonly T[],
  argumentName: string
): T {
  if (!validValues.includes(value as T)) {
    throw createValidationError(argumentName, `Must be one of: ${validValues.join(', ')}`);
  }
  return value as T;
}

/**
 * 文字列長検証
 */
export function validateStringLength(
  value: string,
  argumentName: string,
  options: { min?: number; max?: number }
): void {
  if (options.min !== undefined && value.length < options.min) {
    throw createValidationError(argumentName, `Must be at least ${options.min} characters long`);
  }

  if (options.max !== undefined && value.length > options.max) {
    throw createValidationError(argumentName, `Must be at most ${options.max} characters long`);
  }
}

/**
 * パス検証（安全性チェック）
 */
export function validatePath(path: string, argumentName: string): void {
  // パストラバーサル攻撃を防ぐ
  if (path.includes('..')) {
    throw createValidationError(argumentName, 'Path cannot contain ".." (path traversal)');
  }

  // 絶対パスかどうかをチェック（必要に応じて）
  // if (!path.startsWith('/')) {
  //   throw createValidationError(argumentName, 'Path must be absolute');
  // }
}

/**
 * URL 検証
 */
export function validateURL(url: string, argumentName: string): void {
  try {
    new URL(url);
  } catch {
    throw createValidationError(argumentName, 'Must be a valid URL');
  }
}

/**
 * メールアドレス検証
 */
export function validateEmail(email: string, argumentName: string): void {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw createValidationError(argumentName, 'Must be a valid email address');
  }
}
