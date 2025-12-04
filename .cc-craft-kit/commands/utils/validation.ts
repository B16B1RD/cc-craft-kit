/**
 * 入力検証ユーティリティ
 */

import {
  createInvalidSpecIdError,
  createInvalidPhaseError,
  createMissingArgumentError,
  createValidationError,
} from './error-handler.js';
import { normalizePhase } from '../../core/workflow/phase-mapping.js';

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
  'review',
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
 *
 * 省略形が入力された場合は自動的に完全形に変換します。
 * 例: req → requirements, impl → implementation
 */
export function validatePhase(phase: string): Phase {
  // 省略形を正規化
  const normalized = normalizePhase(phase);

  // 正規化後のフェーズが有効か検証
  if (!VALID_PHASES.includes(normalized as Phase)) {
    throw createInvalidPhaseError(phase);
  }

  return normalized as Phase;
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

/**
 * GitHub Issue 番号形式の判定
 *
 * "#42" または "42" 形式の入力が GitHub Issue 番号かを判定します。
 * 1-6桁の数値を GitHub Issue 番号として認識します。
 *
 * @param input - 判定対象の文字列
 * @returns GitHub Issue 番号形式の場合 true
 */
export function isGitHubIssueNumber(input: string): boolean {
  if (!input || input.trim().length === 0) {
    return false;
  }

  const stripped = input.startsWith('#') ? input.slice(1) : input;

  // 1-6桁の数値（GitHub Issue 番号として妥当な範囲）
  return /^\d{1,6}$/.test(stripped);
}

/**
 * GitHub Issue 番号のパース
 *
 * "#42" または "42" 形式の入力から数値を抽出します。
 *
 * @param input - パース対象の文字列
 * @returns パースされた数値
 * @throws 無効な形式の場合
 */
export function parseGitHubIssueNumber(input: string): number {
  if (!input || input.trim().length === 0) {
    throw createValidationError('issue-number', `Invalid GitHub Issue number: "${input}"`);
  }

  const stripped = input.startsWith('#') ? input.slice(1) : input;
  const num = parseInt(stripped, 10);

  if (isNaN(num) || num < 1) {
    throw createValidationError('issue-number', `Invalid GitHub Issue number: "${input}"`);
  }

  return num;
}

/**
 * 仕様書 ID 形式の判定
 *
 * 8文字以上で UUID パターン（英小文字 + 数字 + ハイフン）にマッチするかを判定します。
 *
 * @param input - 判定対象の文字列
 * @returns 仕様書 ID 形式の場合 true
 */
export function isSpecId(input: string): boolean {
  if (!input || input.length < 8) {
    return false;
  }

  // 英小文字、数字、ハイフンで構成される8文字以上
  return /^[a-f0-9-]{8,}$/i.test(input);
}
