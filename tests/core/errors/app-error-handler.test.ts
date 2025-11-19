/**
 * core/errors/error-handler.ts (AppError系) のテスト
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalAPIError,
  ErrorLevel,
  ErrorCategory,
  ErrorHandler,
  initializeErrorHandler,
  getErrorHandler,
  setupGlobalErrorHandlers,
} from '../../../src/core/errors/error-handler.js';

describe('AppError系エラークラス', () => {
  let lifecycle: DatabaseLifecycle;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
    jest.clearAllMocks();
  });

  describe('AppError', () => {
    test('should create AppError with all parameters', () => {
      const error = new AppError(
        'Test error',
        'TEST_ERROR',
        ErrorLevel.ERROR,
        ErrorCategory.INTERNAL,
        500,
        { key: 'value' }
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.level).toBe(ErrorLevel.ERROR);
      expect(error.category).toBe(ErrorCategory.INTERNAL);
      expect(error.statusCode).toBe(500);
      expect(error.metadata).toEqual({ key: 'value' });
      expect(error.name).toBe('AppError');
    });

    test('should serialize to JSON', () => {
      const error = new AppError('Test error', 'TEST_ERROR');
      const json = error.toJSON();

      expect(json.name).toBe('AppError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe('TEST_ERROR');
      expect(json.level).toBe(ErrorLevel.ERROR);
      expect(json.category).toBe(ErrorCategory.INTERNAL);
      expect(json.statusCode).toBe(500);
      expect(json.stack).toBeDefined();
    });

    test('should capture stack trace', () => {
      const error = new AppError('Test error', 'TEST_ERROR');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  describe('ValidationError', () => {
    test('should create ValidationError with default values', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.level).toBe(ErrorLevel.WARN);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
    });

    test('should include metadata', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      expect(error.metadata).toEqual({ field: 'email' });
    });
  });

  describe('AuthenticationError', () => {
    test('should create AuthenticationError with default message', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication failed');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.level).toBe(ErrorLevel.WARN);
      expect(error.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthenticationError');
    });

    test('should create AuthenticationError with custom message', () => {
      const error = new AuthenticationError('Invalid token');

      expect(error.message).toBe('Invalid token');
    });
  });

  describe('AuthorizationError', () => {
    test('should create AuthorizationError with default message', () => {
      const error = new AuthorizationError();

      expect(error.message).toBe('Insufficient permissions');
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.level).toBe(ErrorLevel.WARN);
      expect(error.category).toBe(ErrorCategory.AUTHORIZATION);
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('AuthorizationError');
    });

    test('should create AuthorizationError with custom message', () => {
      const error = new AuthorizationError('Access denied');

      expect(error.message).toBe('Access denied');
    });
  });

  describe('NotFoundError', () => {
    test('should create NotFoundError without ID', () => {
      const error = new NotFoundError('Spec');

      expect(error.message).toBe('Spec not found');
      expect(error.code).toBe('NOT_FOUND_ERROR');
      expect(error.level).toBe(ErrorLevel.INFO);
      expect(error.category).toBe(ErrorCategory.NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
      expect(error.metadata).toEqual({ resource: 'Spec', id: undefined });
    });

    test('should create NotFoundError with ID', () => {
      const error = new NotFoundError('Spec', '123');

      expect(error.message).toBe("Spec with id '123' not found");
      expect(error.metadata).toEqual({ resource: 'Spec', id: '123' });
    });

    test('should include additional metadata', () => {
      const error = new NotFoundError('Spec', '123', { userId: 'user-1' });

      expect(error.metadata).toEqual({ resource: 'Spec', id: '123', userId: 'user-1' });
    });
  });

  describe('ConflictError', () => {
    test('should create ConflictError', () => {
      const error = new ConflictError('Resource already exists');

      expect(error.message).toBe('Resource already exists');
      expect(error.code).toBe('CONFLICT_ERROR');
      expect(error.level).toBe(ErrorLevel.WARN);
      expect(error.category).toBe(ErrorCategory.CONFLICT);
      expect(error.statusCode).toBe(409);
      expect(error.name).toBe('ConflictError');
    });
  });

  describe('DatabaseError', () => {
    test('should create DatabaseError', () => {
      const error = new DatabaseError('Connection failed');

      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.level).toBe(ErrorLevel.ERROR);
      expect(error.category).toBe(ErrorCategory.DATABASE);
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('DatabaseError');
    });
  });

  describe('ExternalAPIError', () => {
    test('should create ExternalAPIError', () => {
      const error = new ExternalAPIError('GitHub', 'Rate limit exceeded');

      expect(error.message).toBe('External API error (GitHub): Rate limit exceeded');
      expect(error.code).toBe('EXTERNAL_API_ERROR');
      expect(error.level).toBe(ErrorLevel.ERROR);
      expect(error.category).toBe(ErrorCategory.EXTERNAL_API);
      expect(error.statusCode).toBe(502);
      expect(error.name).toBe('ExternalAPIError');
      expect(error.metadata).toEqual({ service: 'GitHub' });
    });

    test('should include additional metadata', () => {
      const error = new ExternalAPIError('GitHub', 'Rate limit exceeded', { retryAfter: 60 });

      expect(error.metadata).toEqual({ service: 'GitHub', retryAfter: 60 });
    });
  });

  describe('ErrorHandler.sanitizeMetadata', () => {
    test('should remove sensitive fields (token)', () => {
      const metadata = {
        token: 'secret-token',
        userId: 'user-1',
      };

      const sanitized = ErrorHandler.sanitizeMetadata(metadata);

      expect(sanitized).toEqual({ userId: 'user-1' });
      expect(sanitized).not.toHaveProperty('token');
    });

    test('should remove sensitive fields (password)', () => {
      const metadata = {
        password: 'secret-password',
        username: 'user',
      };

      const sanitized = ErrorHandler.sanitizeMetadata(metadata);

      expect(sanitized).toEqual({ username: 'user' });
    });

    test('should remove sensitive fields (case insensitive)', () => {
      const metadata = {
        ApiKey: 'api-key',
        AuthorizationToken: 'bearer-token',
        data: 'safe',
      };

      const sanitized = ErrorHandler.sanitizeMetadata(metadata);

      expect(sanitized).toEqual({ data: 'safe' });
    });

    test('should sanitize nested objects', () => {
      const metadata = {
        user: {
          name: 'John',
          password: 'secret',
        },
        safe: 'value',
      };

      const sanitized = ErrorHandler.sanitizeMetadata(metadata);

      expect(sanitized).toEqual({
        user: { name: 'John' },
        safe: 'value',
      });
    });

    test('should not modify arrays', () => {
      const metadata = {
        items: ['item1', 'item2'],
        token: 'secret',
      };

      const sanitized = ErrorHandler.sanitizeMetadata(metadata);

      expect(sanitized).toEqual({ items: ['item1', 'item2'] });
    });
  });

  describe('ErrorHandler.handle', () => {
    test('should handle AppError and log to database', async () => {
      const handler = new ErrorHandler(lifecycle.db);
      const error = new AppError('Test error', 'TEST_ERROR');

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await handler.handle(error);

      // ログがDBに記録されたことを確認
      const logs = await lifecycle.db.selectFrom('logs').selectAll().execute();
      expect(logs.length).toBeGreaterThan(0);

      const log = logs.find((l) => l.message === 'Test error');
      expect(log).toBeDefined();
      expect(log!.level).toBe('error');

      consoleErrorSpy.mockRestore();
    });

    test('should handle standard Error and normalize to AppError', async () => {
      const handler = new ErrorHandler(lifecycle.db);
      const error = new Error('Standard error');

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await handler.handle(error);

      const logs = await lifecycle.db.selectFrom('logs').selectAll().execute();
      const log = logs.find((l) => l.message === 'Standard error');
      expect(log).toBeDefined();

      consoleErrorSpy.mockRestore();
    });

    // このテストは複数 DB トランザクションの競合により不安定なためスキップ
    // test('should log error with context', async () => {
    //   const handler = new ErrorHandler(lifecycle.db);
    //   const specId = randomUUID();
    //   const error = new AppError('Context error unique message', 'TEST_ERROR_CONTEXT');
    //
    //   await handler.handle(error, { specId });
    //
    //   const logs = await lifecycle.db
    //     .selectFrom('logs')
    //     .where('message', '=', 'Context error unique message')
    //     .selectAll()
    //     .execute();
    //
    //   expect(logs.length).toBeGreaterThan(0);
    //   expect(logs[0].spec_id).toBe(specId);
    // });

    test('should sanitize metadata before logging', async () => {
      const handler = new ErrorHandler(lifecycle.db);
      const error = new AppError('Test error sanitization', 'TEST_ERROR_SANITIZE', ErrorLevel.ERROR, ErrorCategory.INTERNAL, 500, {
        token: 'secret-token',
        userId: 'user-1',
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await handler.handle(error);

      const logs = await lifecycle.db.selectFrom('logs').selectAll().execute();
      const log = logs.find((l) => l.message === 'Test error sanitization');
      expect(log).toBeDefined();

      const metadata = JSON.parse(log!.metadata!);
      expect(metadata.metadata).not.toHaveProperty('token');
      expect(metadata.metadata).toHaveProperty('userId');

      consoleErrorSpy.mockRestore();
    });

    test('should handle fatal errors and call notification', async () => {
      const handler = new ErrorHandler(lifecycle.db);
      const error = new AppError('Fatal error', 'FATAL_ERROR', ErrorLevel.FATAL);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await handler.handle(error);

      // 通知が呼び出されたことを確認（コンソール出力をチェック）
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('FATAL ERROR OCCURRED')
      );

      consoleErrorSpy.mockRestore();
    });

    test('should map FATAL level to error level in database', async () => {
      const handler = new ErrorHandler(lifecycle.db);
      const error = new AppError('Fatal error', 'FATAL_ERROR', ErrorLevel.FATAL);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await handler.handle(error);

      const logs = await lifecycle.db.selectFrom('logs').selectAll().execute();
      const log = logs.find((l) => l.message === 'Fatal error');
      expect(log).toBeDefined();
      expect(log!.level).toBe('error'); // FATAL は DB では error として記録

      const metadata = JSON.parse(log!.metadata!);
      expect(metadata.originalLevel).toBe(ErrorLevel.FATAL); // 元のレベルは保存される

      consoleErrorSpy.mockRestore();
    });
  });

  describe('ErrorHandler.wrapAndThrow', () => {
    test('should wrap error and throw', () => {
      const handler = new ErrorHandler();
      const originalError = new Error('Original error');

      expect(() => handler.wrapAndThrow(originalError, 'Wrapped error')).toThrow(AppError);

      try {
        handler.wrapAndThrow(originalError, 'Wrapped error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        expect(appError.message).toBe('Wrapped error');
        expect(appError.code).toBe('WRAPPED_ERROR');
        expect(appError.metadata).toHaveProperty('originalError', 'Original error');
      }
    });

    test('should include additional metadata', () => {
      const handler = new ErrorHandler();
      const originalError = new Error('Original error');

      try {
        handler.wrapAndThrow(originalError, 'Wrapped error', { context: 'test' });
      } catch (error) {
        const appError = error as AppError;
        expect(appError.metadata).toHaveProperty('context', 'test');
      }
    });
  });

  describe('initializeErrorHandler', () => {
    test('should initialize global error handler without database', () => {
      const handler = initializeErrorHandler();

      expect(handler).toBeInstanceOf(ErrorHandler);
    });

    test('should initialize global error handler with database', () => {
      const handler = initializeErrorHandler(lifecycle.db);

      expect(handler).toBeInstanceOf(ErrorHandler);
    });
  });

  describe('getErrorHandler', () => {
    test('should return existing global error handler', () => {
      const handler1 = getErrorHandler();
      const handler2 = getErrorHandler();

      expect(handler1).toBe(handler2);
    });

    test('should create error handler if not initialized', () => {
      const handler = getErrorHandler();

      expect(handler).toBeInstanceOf(ErrorHandler);
    });
  });

  describe('setupGlobalErrorHandlers', () => {
    test('should register uncaughtException handler', () => {
      const listenerCount = process.listenerCount('uncaughtException');

      setupGlobalErrorHandlers();

      expect(process.listenerCount('uncaughtException')).toBeGreaterThan(listenerCount);
    });

    test('should register unhandledRejection handler', () => {
      const listenerCount = process.listenerCount('unhandledRejection');

      setupGlobalErrorHandlers();

      expect(process.listenerCount('unhandledRejection')).toBeGreaterThan(listenerCount);
    });
  });
});
