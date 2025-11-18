/**
 * CLIエラーハンドリング
 */

import { formatError, formatWarning, formatKeyValue } from './output.js';

/**
 * エラーコード定数
 */
export const ERROR_CODES = {
  // 一般エラー
  UNKNOWN_ERROR: 'E001',
  INVALID_ARGUMENT: 'E002',
  MISSING_ARGUMENT: 'E003',

  // ファイルシステムエラー
  FILE_NOT_FOUND: 'E101',
  FILE_READ_ERROR: 'E102',
  FILE_WRITE_ERROR: 'E103',
  DIRECTORY_NOT_FOUND: 'E104',

  // データベースエラー
  DATABASE_ERROR: 'E201',
  DATABASE_NOT_INITIALIZED: 'E202',
  RECORD_NOT_FOUND: 'E203',
  RECORD_ALREADY_EXISTS: 'E204',

  // プロジェクトエラー
  PROJECT_NOT_INITIALIZED: 'E301',
  PROJECT_ALREADY_INITIALIZED: 'E302',

  // 仕様書エラー
  SPEC_NOT_FOUND: 'E401',
  INVALID_SPEC_ID: 'E402',
  INVALID_PHASE: 'E403',

  // GitHubエラー
  GITHUB_NOT_CONFIGURED: 'E501',
  GITHUB_AUTH_FAILED: 'E502',
  GITHUB_REPO_NOT_FOUND: 'E503',
  GITHUB_ISSUE_NOT_FOUND: 'E504',
  GITHUB_API_ERROR: 'E505',
  GITHUB_RATE_LIMIT: 'E506',

  // 検証エラー
  VALIDATION_ERROR: 'E601',
} as const;

/**
 * CLIエラークラス
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestion?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CLIError';
    Error.captureStackTrace(this, CLIError);
  }

  /**
   * エラーメッセージをフォーマット
   */
  format(useColor = true): string {
    const lines: string[] = [];

    // エラーメッセージ
    lines.push(formatError(`[${this.code}] ${this.message}`, useColor));

    // 詳細情報
    if (this.details && Object.keys(this.details).length > 0) {
      lines.push('');
      lines.push('Details:');
      for (const [key, value] of Object.entries(this.details)) {
        lines.push(`  ${formatKeyValue(key, String(value), useColor)}`);
      }
    }

    // 提案
    if (this.suggestion) {
      lines.push('');
      lines.push(formatWarning(`Suggestion: ${this.suggestion}`, useColor));
    }

    return lines.join('\n');
  }
}

/**
 * エラーハンドリング
 */
export function handleCLIError(error: unknown, useColor = true): void {
  if (error instanceof CLIError) {
    console.error(error.format(useColor));
    process.exit(1);
  } else if (error instanceof Error) {
    console.error(formatError(`Unexpected error: ${error.message}`, useColor));
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  } else {
    console.error(formatError('Unknown error occurred', useColor));
    process.exit(1);
  }
}

/**
 * エラーファクトリー関数
 */

export function createInvalidArgumentError(argument: string, expected: string): CLIError {
  return new CLIError(
    `Invalid argument: ${argument}`,
    ERROR_CODES.INVALID_ARGUMENT,
    `Expected: ${expected}`,
    { argument, expected }
  );
}

export function createMissingArgumentError(argument: string): CLIError {
  return new CLIError(
    `Missing required argument: ${argument}`,
    ERROR_CODES.MISSING_ARGUMENT,
    `Please provide the ${argument} argument.`,
    { argument }
  );
}

export function createFileNotFoundError(filePath: string): CLIError {
  return new CLIError(
    `File not found: ${filePath}`,
    ERROR_CODES.FILE_NOT_FOUND,
    'Check the file path and try again.',
    { filePath }
  );
}

export function createDatabaseNotInitializedError(): CLIError {
  return new CLIError(
    'Database is not initialized',
    ERROR_CODES.DATABASE_NOT_INITIALIZED,
    'Run "takumi init" to initialize the project.',
    {}
  );
}

export function createProjectNotInitializedError(): CLIError {
  return new CLIError(
    'Project is not initialized',
    ERROR_CODES.PROJECT_NOT_INITIALIZED,
    'Run "takumi init <project-name>" to initialize a new project.',
    {}
  );
}

export function createProjectAlreadyInitializedError(): CLIError {
  return new CLIError(
    'Project is already initialized',
    ERROR_CODES.PROJECT_ALREADY_INITIALIZED,
    'A .cc-craft-kit directory already exists in this location.',
    {}
  );
}

export function createSpecNotFoundError(specId: string): CLIError {
  return new CLIError(
    `Spec not found: ${specId}`,
    ERROR_CODES.SPEC_NOT_FOUND,
    'Check the spec ID and try again. Use "takumi spec list" to see all specs.',
    { specId }
  );
}

export function createInvalidSpecIdError(specId: string): CLIError {
  return new CLIError(
    `Invalid spec ID: ${specId}`,
    ERROR_CODES.INVALID_SPEC_ID,
    'Spec ID must be a valid UUID.',
    { specId }
  );
}

export function createInvalidPhaseError(phase: string): CLIError {
  const validPhases = ['requirements', 'design', 'tasks', 'implementation', 'completed'];
  return new CLIError(
    `Invalid phase: ${phase}`,
    ERROR_CODES.INVALID_PHASE,
    `Valid phases are: ${validPhases.join(', ')}`,
    { phase, validPhases }
  );
}

export function createGitHubNotConfiguredError(): CLIError {
  return new CLIError(
    'GitHub is not configured',
    ERROR_CODES.GITHUB_NOT_CONFIGURED,
    'Run "takumi github init <owner> <repo>" to configure GitHub integration.',
    {}
  );
}

export function createGitHubAuthFailedError(): CLIError {
  return new CLIError(
    'GitHub authentication failed',
    ERROR_CODES.GITHUB_AUTH_FAILED,
    'Check your GITHUB_TOKEN environment variable or provide a valid token.',
    {}
  );
}

export function createGitHubRepoNotFoundError(owner: string, repo: string): CLIError {
  return new CLIError(
    `GitHub repository not found: ${owner}/${repo}`,
    ERROR_CODES.GITHUB_REPO_NOT_FOUND,
    'Check the repository owner and name.',
    { owner, repo }
  );
}

export function createValidationError(field: string, message: string): CLIError {
  return new CLIError(
    `Validation error: ${field} - ${message}`,
    ERROR_CODES.VALIDATION_ERROR,
    undefined,
    { field, message }
  );
}
