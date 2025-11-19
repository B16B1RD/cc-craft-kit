/**
 * error-handler.ts のテスト
 */
import { describe, test, expect } from '@jest/globals';
import {
  CLIError,
  ERROR_CODES,
  createInvalidArgumentError,
  createMissingArgumentError,
  createFileNotFoundError,
  createDatabaseNotInitializedError,
  createProjectNotInitializedError,
  createProjectAlreadyInitializedError,
  createSpecNotFoundError,
  createInvalidSpecIdError,
  createInvalidPhaseError,
  createGitHubNotConfiguredError,
  createGitHubAuthFailedError,
  createGitHubRepoNotFoundError,
  createValidationError,
} from '../../../src/commands/utils/error-handler.js';

describe('CLIError', () => {
  test('should create error with message and code', () => {
    const error = new CLIError('Test error', 'E001');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('E001');
    expect(error.name).toBe('CLIError');
  });

  test('should create error with suggestion', () => {
    const error = new CLIError('Test error', 'E001', 'Try this suggestion');
    expect(error.suggestion).toBe('Try this suggestion');
  });

  test('should create error with details', () => {
    const error = new CLIError('Test error', 'E001', undefined, { key: 'value' });
    expect(error.details).toEqual({ key: 'value' });
  });

  test('should format error without color', () => {
    const error = new CLIError('Test error', 'E001');
    const formatted = error.format(false);
    expect(formatted).toContain('[E001]');
    expect(formatted).toContain('Test error');
  });

  test('should format error with suggestion', () => {
    const error = new CLIError('Test error', 'E001', 'Try this');
    const formatted = error.format(false);
    expect(formatted).toContain('Suggestion: Try this');
  });

  test('should format error with details', () => {
    const error = new CLIError('Test error', 'E001', undefined, { field: 'value' });
    const formatted = error.format(false);
    expect(formatted).toContain('Details:');
    expect(formatted).toContain('field');
    expect(formatted).toContain('value');
  });
});

describe('createInvalidArgumentError', () => {
  test('should create invalid argument error', () => {
    const error = createInvalidArgumentError('arg1', 'string');
    expect(error.code).toBe(ERROR_CODES.INVALID_ARGUMENT);
    expect(error.message).toContain('arg1');
    expect(error.suggestion).toContain('string');
    expect(error.details).toEqual({ argument: 'arg1', expected: 'string' });
  });
});

describe('createMissingArgumentError', () => {
  test('should create missing argument error', () => {
    const error = createMissingArgumentError('requiredArg');
    expect(error.code).toBe(ERROR_CODES.MISSING_ARGUMENT);
    expect(error.message).toContain('requiredArg');
    expect(error.suggestion).toContain('requiredArg');
    expect(error.details).toEqual({ argument: 'requiredArg' });
  });
});

describe('createFileNotFoundError', () => {
  test('should create file not found error', () => {
    const error = createFileNotFoundError('/path/to/file');
    expect(error.code).toBe(ERROR_CODES.FILE_NOT_FOUND);
    expect(error.message).toContain('/path/to/file');
    expect(error.details).toEqual({ filePath: '/path/to/file' });
  });
});

describe('createDatabaseNotInitializedError', () => {
  test('should create database not initialized error', () => {
    const error = createDatabaseNotInitializedError();
    expect(error.code).toBe(ERROR_CODES.DATABASE_NOT_INITIALIZED);
    expect(error.message).toContain('not initialized');
    expect(error.suggestion).toContain('/cft:init');
  });
});

describe('createProjectNotInitializedError', () => {
  test('should create project not initialized error', () => {
    const error = createProjectNotInitializedError();
    expect(error.code).toBe(ERROR_CODES.PROJECT_NOT_INITIALIZED);
    expect(error.message).toContain('not initialized');
    expect(error.suggestion).toContain('/cft:init');
  });
});

describe('createProjectAlreadyInitializedError', () => {
  test('should create project already initialized error', () => {
    const error = createProjectAlreadyInitializedError();
    expect(error.code).toBe(ERROR_CODES.PROJECT_ALREADY_INITIALIZED);
    expect(error.message).toContain('already initialized');
    expect(error.suggestion).toContain('.cc-craft-kit');
  });
});

describe('createSpecNotFoundError', () => {
  test('should create spec not found error', () => {
    const error = createSpecNotFoundError('spec-123');
    expect(error.code).toBe(ERROR_CODES.SPEC_NOT_FOUND);
    expect(error.message).toContain('spec-123');
    expect(error.suggestion).toContain('/cft:spec-list');
    expect(error.details).toEqual({ specId: 'spec-123' });
  });
});

describe('createInvalidSpecIdError', () => {
  test('should create invalid spec ID error', () => {
    const error = createInvalidSpecIdError('invalid-id');
    expect(error.code).toBe(ERROR_CODES.INVALID_SPEC_ID);
    expect(error.message).toContain('invalid-id');
    expect(error.suggestion).toContain('UUID');
    expect(error.details).toEqual({ specId: 'invalid-id' });
  });
});

describe('createInvalidPhaseError', () => {
  test('should create invalid phase error', () => {
    const error = createInvalidPhaseError('invalid-phase');
    expect(error.code).toBe(ERROR_CODES.INVALID_PHASE);
    expect(error.message).toContain('invalid-phase');
    expect(error.suggestion).toContain('requirements');
    expect(error.details).toHaveProperty('phase', 'invalid-phase');
    expect(error.details).toHaveProperty('validPhases');
  });
});

describe('createGitHubNotConfiguredError', () => {
  test('should create GitHub not configured error', () => {
    const error = createGitHubNotConfiguredError();
    expect(error.code).toBe(ERROR_CODES.GITHUB_NOT_CONFIGURED);
    expect(error.message).toContain('not configured');
    expect(error.suggestion).toContain('/cft:github-init');
  });
});

describe('createGitHubAuthFailedError', () => {
  test('should create GitHub auth failed error', () => {
    const error = createGitHubAuthFailedError();
    expect(error.code).toBe(ERROR_CODES.GITHUB_AUTH_FAILED);
    expect(error.message).toContain('authentication failed');
    expect(error.suggestion).toContain('GITHUB_TOKEN');
  });
});

describe('createGitHubRepoNotFoundError', () => {
  test('should create GitHub repo not found error', () => {
    const error = createGitHubRepoNotFoundError('owner', 'repo');
    expect(error.code).toBe(ERROR_CODES.GITHUB_REPO_NOT_FOUND);
    expect(error.message).toContain('owner/repo');
    expect(error.details).toEqual({ owner: 'owner', repo: 'repo' });
  });
});

describe('createValidationError', () => {
  test('should create validation error', () => {
    const error = createValidationError('field', 'must be a string');
    expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(error.message).toContain('field');
    expect(error.message).toContain('must be a string');
    expect(error.details).toEqual({ field: 'field', message: 'must be a string' });
  });
});
