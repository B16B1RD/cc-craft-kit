/**
 * 統一エラーハンドリングシステム
 */

import { Kysely } from 'kysely';
import { Database } from '../database/schema.js';
import type { ErrorMetadata } from '../types/common.js';

/**
 * エラーレベル
 */
export enum ErrorLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * エラーカテゴリ
 */
export enum ErrorCategory {
  DATABASE = 'database',
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  INTERNAL = 'internal',
  EXTERNAL_API = 'external_api',
}

/**
 * アプリケーションエラー基底クラス
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly level: ErrorLevel = ErrorLevel.ERROR,
    public readonly category: ErrorCategory = ErrorCategory.INTERNAL,
    public readonly statusCode: number = 500,
    public readonly metadata?: ErrorMetadata
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      level: this.level,
      category: this.category,
      statusCode: this.statusCode,
      metadata: this.metadata,
      stack: this.stack,
    };
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message, 'VALIDATION_ERROR', ErrorLevel.WARN, ErrorCategory.VALIDATION, 400, metadata);
    this.name = 'ValidationError';
  }
}

/**
 * 認証エラー
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', metadata?: ErrorMetadata) {
    super(
      message,
      'AUTHENTICATION_ERROR',
      ErrorLevel.WARN,
      ErrorCategory.AUTHENTICATION,
      401,
      metadata
    );
    this.name = 'AuthenticationError';
  }
}

/**
 * 認可エラー
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', metadata?: ErrorMetadata) {
    super(
      message,
      'AUTHORIZATION_ERROR',
      ErrorLevel.WARN,
      ErrorCategory.AUTHORIZATION,
      403,
      metadata
    );
    this.name = 'AuthorizationError';
  }
}

/**
 * リソース未検出エラー
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string, metadata?: ErrorMetadata) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND_ERROR', ErrorLevel.INFO, ErrorCategory.NOT_FOUND, 404, {
      resource,
      id,
      ...metadata,
    });
    this.name = 'NotFoundError';
  }
}

/**
 * 競合エラー
 */
export class ConflictError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message, 'CONFLICT_ERROR', ErrorLevel.WARN, ErrorCategory.CONFLICT, 409, metadata);
    this.name = 'ConflictError';
  }
}

/**
 * データベースエラー
 */
export class DatabaseError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message, 'DATABASE_ERROR', ErrorLevel.ERROR, ErrorCategory.DATABASE, 500, metadata);
    this.name = 'DatabaseError';
  }
}

/**
 * 外部APIエラー
 */
export class ExternalAPIError extends AppError {
  constructor(service: string, message: string, metadata?: ErrorMetadata) {
    super(
      `External API error (${service}): ${message}`,
      'EXTERNAL_API_ERROR',
      ErrorLevel.ERROR,
      ErrorCategory.EXTERNAL_API,
      502,
      { service, ...metadata }
    );
    this.name = 'ExternalAPIError';
  }
}

/**
 * エラーハンドラー
 */
export class ErrorHandler {
  constructor(private db?: Kysely<Database>) {}

  /**
   * センシティブ情報を含むフィールドを除外
   */
  static sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...metadata };

    // センシティブキーワードを含むフィールドを削除
    const sensitiveKeys = ['token', 'password', 'apikey', 'secret', 'authorization'];

    Object.keys(sanitized).forEach((key) => {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        delete sanitized[key];
      }
    });

    // ネストされたオブジェクトも再帰的にサニタイズ
    Object.keys(sanitized).forEach((key) => {
      const value = sanitized[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = ErrorHandler.sanitizeMetadata(value as Record<string, unknown>);
      }
    });

    return sanitized;
  }

  /**
   * エラーを処理
   */
  async handle(error: Error, context?: ErrorMetadata): Promise<void> {
    const appError = this.normalizeError(error);

    // ログに記録
    await this.logError(appError, context);

    // コンソール出力
    this.printError(appError, context);

    // 重大なエラーの場合は通知
    if (appError.level === ErrorLevel.FATAL) {
      await this.notifyFatalError(appError, context);
    }
  }

  /**
   * エラーを正規化
   */
  private normalizeError(error: Error): AppError {
    if (error instanceof AppError) {
      return error;
    }

    // 標準Errorを AppErrorに変換
    return new AppError(
      error.message,
      'UNKNOWN_ERROR',
      ErrorLevel.ERROR,
      ErrorCategory.INTERNAL,
      500,
      { originalName: error.name, stack: error.stack }
    );
  }

  /**
   * エラーをログに記録
   */
  private async logError(error: AppError, context?: ErrorMetadata): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      // DBのログレベルはdebug/info/warn/errorのみ対応
      // fatalレベルはerrorとして記録
      const dbLevel: 'debug' | 'info' | 'warn' | 'error' =
        error.level === ErrorLevel.FATAL
          ? 'error'
          : (error.level as 'debug' | 'info' | 'warn' | 'error');

      // メタデータをサニタイズ
      const sanitizedMetadata = error.metadata
        ? ErrorHandler.sanitizeMetadata(error.metadata as Record<string, unknown>)
        : undefined;
      const sanitizedContext = context
        ? ErrorHandler.sanitizeMetadata(context as Record<string, unknown>)
        : undefined;

      await this.db
        .insertInto('logs')
        .values({
          id: `error-${Date.now()}-${Math.random()}`,
          task_id: (context?.taskId as string | undefined) || null,
          spec_id: (context?.specId as string | undefined) || null,
          action: 'error',
          level: dbLevel,
          message: error.message,
          metadata: JSON.stringify({
            code: error.code,
            category: error.category,
            statusCode: error.statusCode,
            originalLevel: error.level, // 元のレベルも保存
            metadata: sanitizedMetadata,
            context: sanitizedContext,
            stack: error.stack,
          }),
          timestamp: new Date().toISOString(),
        })
        .execute();
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError);
    }
  }

  /**
   * エラーをコンソールに出力
   */
  private printError(error: AppError, context?: ErrorMetadata): void {
    const level = error.level.toUpperCase();
    const prefix = this.getErrorPrefix(error.level);

    console.error(`\n${prefix} [${level}] ${error.code}: ${error.message}`);

    if (error.metadata) {
      console.error('Metadata:', JSON.stringify(error.metadata, null, 2));
    }

    if (context) {
      console.error('Context:', JSON.stringify(context, null, 2));
    }

    if (error.stack && error.level !== ErrorLevel.INFO) {
      console.error('Stack trace:');
      console.error(error.stack);
    }

    console.error(''); // 空行
  }

  /**
   * エラープレフィックスを取得
   */
  private getErrorPrefix(level: ErrorLevel): string {
    switch (level) {
      case ErrorLevel.FATAL:
        return '🔥';
      case ErrorLevel.ERROR:
        return '❌';
      case ErrorLevel.WARN:
        return '⚠️ ';
      case ErrorLevel.INFO:
        return 'ℹ️ ';
      case ErrorLevel.DEBUG:
        return '🐛';
      default:
        return '❓';
    }
  }

  /**
   * 致命的エラーを通知
   */
  private async notifyFatalError(error: AppError, context?: ErrorMetadata): Promise<void> {
    // TODO: Slack/Email通知などを実装
    console.error('🔥 FATAL ERROR OCCURRED - Notification would be sent here');
    console.error('Error:', error.toJSON());
    console.error('Context:', context);
  }

  /**
   * エラーをラップして再スロー
   */
  wrapAndThrow(error: Error, message: string, metadata?: ErrorMetadata): never {
    const wrapped = new AppError(
      message,
      'WRAPPED_ERROR',
      ErrorLevel.ERROR,
      ErrorCategory.INTERNAL,
      500,
      {
        originalError: error.message,
        originalStack: error.stack,
        ...metadata,
      }
    );

    throw wrapped;
  }
}

/**
 * グローバルエラーハンドラー
 */
let globalErrorHandler: ErrorHandler | null = null;

/**
 * グローバルエラーハンドラーを初期化
 */
export function initializeErrorHandler(db?: Kysely<Database>): ErrorHandler {
  globalErrorHandler = new ErrorHandler(db);
  return globalErrorHandler;
}

/**
 * グローバルエラーハンドラーを取得
 */
export function getErrorHandler(): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler();
  }
  return globalErrorHandler;
}

/**
 * 未処理エラーハンドラーを設定
 */
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    getErrorHandler().handle(error, { type: 'uncaughtException' });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    const error = reason instanceof Error ? reason : new Error(String(reason));
    getErrorHandler().handle(error, { type: 'unhandledRejection' });
  });
}
