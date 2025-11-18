/**
 * ErrorHandler のサニタイズ機能テスト
 */

import { describe, it, expect } from '@jest/globals';
import { ErrorHandler } from '../../../src/core/errors/error-handler.js';

describe('ErrorHandler.sanitizeMetadata', () => {
  it('should remove fields with sensitive keywords (token)', () => {
    const metadata = {
      userId: '123',
      githubToken: 'ghp_secret123',
      apiToken: 'secret',
      normalField: 'value',
    };

    const sanitized = ErrorHandler.sanitizeMetadata(metadata);

    expect(sanitized).toEqual({
      userId: '123',
      normalField: 'value',
    });
    expect(sanitized).not.toHaveProperty('githubToken');
    expect(sanitized).not.toHaveProperty('apiToken');
  });

  it('should remove fields with sensitive keywords (password)', () => {
    const metadata = {
      username: 'user1',
      password: 'secret123',
      userPassword: 'another_secret',
      normalField: 'value',
    };

    const sanitized = ErrorHandler.sanitizeMetadata(metadata);

    expect(sanitized).toEqual({
      username: 'user1',
      normalField: 'value',
    });
    expect(sanitized).not.toHaveProperty('password');
    expect(sanitized).not.toHaveProperty('userPassword');
  });

  it('should remove fields with sensitive keywords (apikey)', () => {
    const metadata = {
      service: 'github',
      apiKey: 'key123',
      apikey: 'key456',
      normalField: 'value',
    };

    const sanitized = ErrorHandler.sanitizeMetadata(metadata);

    expect(sanitized).toEqual({
      service: 'github',
      normalField: 'value',
    });
    expect(sanitized).not.toHaveProperty('apiKey');
    expect(sanitized).not.toHaveProperty('apikey');
  });

  it('should remove fields with sensitive keywords (secret)', () => {
    const metadata = {
      config: 'production',
      clientSecret: 'secret123',
      secretKey: 'key456',
      normalField: 'value',
    };

    const sanitized = ErrorHandler.sanitizeMetadata(metadata);

    expect(sanitized).toEqual({
      config: 'production',
      normalField: 'value',
    });
    expect(sanitized).not.toHaveProperty('clientSecret');
    expect(sanitized).not.toHaveProperty('secretKey');
  });

  it('should remove fields with sensitive keywords (authorization)', () => {
    const metadata = {
      userId: '123',
      authorization: 'Bearer token123',
      authorizationHeader: 'Basic xxx',
      normalField: 'value',
    };

    const sanitized = ErrorHandler.sanitizeMetadata(metadata);

    expect(sanitized).toEqual({
      userId: '123',
      normalField: 'value',
    });
    expect(sanitized).not.toHaveProperty('authorization');
    expect(sanitized).not.toHaveProperty('authorizationHeader');
  });

  it('should handle case-insensitive keyword matching', () => {
    const metadata = {
      GITHUB_TOKEN: 'secret',
      Password: 'secret',
      ApiKey: 'secret',
      normalField: 'value',
    };

    const sanitized = ErrorHandler.sanitizeMetadata(metadata);

    expect(sanitized).toEqual({
      normalField: 'value',
    });
    expect(sanitized).not.toHaveProperty('GITHUB_TOKEN');
    expect(sanitized).not.toHaveProperty('Password');
    expect(sanitized).not.toHaveProperty('ApiKey');
  });

  it('should recursively sanitize nested objects', () => {
    const metadata = {
      userId: '123',
      credentials: {
        username: 'user1',
        password: 'secret123',
        apiToken: 'token456',
      },
      config: {
        service: 'github',
        auth: {
          token: 'ghp_secret',
          apiKey: 'key123',
        },
      },
      normalField: 'value',
    };

    const sanitized = ErrorHandler.sanitizeMetadata(metadata);

    expect(sanitized).toEqual({
      userId: '123',
      credentials: {
        username: 'user1',
      },
      config: {
        service: 'github',
        auth: {},
      },
      normalField: 'value',
    });
  });

  it('should preserve normal metadata fields', () => {
    const metadata = {
      userId: '123',
      event: 'spec.created',
      specId: 'abc-123',
      action: 'create_issue',
      timestamp: '2025-01-01T00:00:00Z',
    };

    const sanitized = ErrorHandler.sanitizeMetadata(metadata);

    expect(sanitized).toEqual(metadata);
  });

  it('should handle empty objects', () => {
    const metadata = {};

    const sanitized = ErrorHandler.sanitizeMetadata(metadata);

    expect(sanitized).toEqual({});
  });

  it('should handle objects with only sensitive fields', () => {
    const metadata = {
      token: 'secret',
      password: 'secret',
      apiKey: 'secret',
    };

    const sanitized = ErrorHandler.sanitizeMetadata(metadata);

    expect(sanitized).toEqual({});
  });

  it('should not modify the original object', () => {
    const metadata = {
      userId: '123',
      token: 'secret',
      normalField: 'value',
    };

    const original = { ...metadata };
    const sanitized = ErrorHandler.sanitizeMetadata(metadata);

    // 元のオブジェクトは変更されていないことを確認
    expect(metadata).toEqual(original);
    expect(sanitized).not.toEqual(metadata);
  });

  it('should handle arrays (not recursively sanitized)', () => {
    const metadata = {
      userId: '123',
      items: ['item1', 'item2'],
      credentials: {
        token: 'secret',
        roles: ['admin', 'user'],
      },
    };

    const sanitized = ErrorHandler.sanitizeMetadata(metadata);

    expect(sanitized).toEqual({
      userId: '123',
      items: ['item1', 'item2'],
      credentials: {
        roles: ['admin', 'user'],
      },
    });
  });
});
