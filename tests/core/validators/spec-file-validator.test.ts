/**
 * spec-file-validator.ts のテスト
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseSpecFile,
  validateMetadata,
  validateSpecFile,
  fixSpecFileMetadata,
  parseDateTime,
} from '../../../src/core/validators/spec-file-validator.js';
import type { SpecMetadata } from '../../../src/core/validators/spec-file-validator.js';

describe('spec-file-validator', () => {
  const testDir = join(__dirname, '../../.tmp/spec-validator-test');
  const testFilePath = join(testDir, 'test-spec.md');

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('parseSpecFile', () => {
    test('should parse valid spec file', () => {
      const content = `# Test Spec

**仕様書 ID:** 12345678-1234-4abc-8def-123456789012
**フェーズ:** requirements
**作成日時:** 2025/01/01 10:00:00
**更新日時:** 2025/01/02 11:00:00

### 背景

This is a test specification.
`;

      const metadata = parseSpecFile(content);

      expect(metadata).not.toBeNull();
      expect(metadata!.id).toBe('12345678-1234-4abc-8def-123456789012');
      expect(metadata!.name).toBe('Test Spec');
      expect(metadata!.phase).toBe('requirements');
      expect(metadata!.createdAt).toBe('2025/01/01 10:00:00');
      expect(metadata!.updatedAt).toBe('2025/01/02 11:00:00');
      expect(metadata!.description).toBe('This is a test specification.');
    });

    test('should return null if title is missing', () => {
      const content = `
**仕様書 ID:** 12345678-1234-4abc-8def-123456789012
**フェーズ:** requirements
`;

      const metadata = parseSpecFile(content);

      expect(metadata).toBeNull();
    });

    test('should return null if ID is missing', () => {
      const content = `# Test Spec

**フェーズ:** requirements
**作成日時:** 2025/01/01 10:00:00
**更新日時:** 2025/01/02 11:00:00
`;

      const metadata = parseSpecFile(content);

      expect(metadata).toBeNull();
    });

    test('should use default description if background section is missing', () => {
      const content = `# Test Spec

**仕様書 ID:** 12345678-1234-4abc-8def-123456789012
**フェーズ:** requirements
**作成日時:** 2025/01/01 10:00:00
**更新日時:** 2025/01/02 11:00:00
`;

      const metadata = parseSpecFile(content);

      expect(metadata).not.toBeNull();
      expect(metadata!.description).toBe('Test Specの仕様書');
    });
  });

  describe('validateMetadata', () => {
    const validMetadata: SpecMetadata = {
      id: '12345678-1234-4abc-8def-123456789012',
      name: 'Test Spec',
      phase: 'requirements',
      createdAt: '2025/01/01 10:00:00',
      updatedAt: '2025/01/02 11:00:00',
      description: 'Test description',
    };

    test('should validate correct metadata', () => {
      const result = validateMetadata(validMetadata);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid UUID format', () => {
      const metadata = { ...validMetadata, id: 'invalid-uuid' };
      const result = validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid UUID format: invalid-uuid');
    });

    test('should reject invalid phase', () => {
      const metadata = { ...validMetadata, phase: 'invalid' as any };
      const result = validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid phase'))).toBe(true);
    });

    test('should reject invalid createdAt format', () => {
      const metadata = { ...validMetadata, createdAt: '2025-01-01' };
      const result = validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid createdAt format'))).toBe(true);
    });
  });

  describe('validateSpecFile', () => {
    test('should validate valid spec file', () => {
      const content = `# Test Spec

**仕様書 ID:** 12345678-1234-4abc-8def-123456789012
**フェーズ:** requirements
**作成日時:** 2025/01/01 10:00:00
**更新日時:** 2025/01/02 11:00:00
`;
      writeFileSync(testFilePath, content, 'utf-8');

      const result = validateSpecFile(testFilePath);

      expect(result.isValid).toBe(true);
    });

    test('should return error if file cannot be read', () => {
      const result = validateSpecFile(join(testDir, 'nonexistent.md'));

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Failed to read file'))).toBe(true);
    });
  });

  describe('fixSpecFileMetadata', () => {
    test('should fix spec ID format (no space)', () => {
      const content = `# Test Spec

**仕様書ID:** 12345678-1234-4abc-8def-123456789012
`;
      writeFileSync(testFilePath, content, 'utf-8');

      const fixed = fixSpecFileMetadata(testFilePath);

      expect(fixed).toBe(true);
      const result = readFileSync(testFilePath, 'utf-8');
      expect(result).toContain('**仕様書 ID:**');
    });

    test('should return false if no fixes needed', () => {
      const content = `# Test Spec

**仕様書 ID:** 12345678-1234-4abc-8def-123456789012
`;
      writeFileSync(testFilePath, content, 'utf-8');

      const fixed = fixSpecFileMetadata(testFilePath);

      expect(fixed).toBe(false);
    });
  });

  describe('parseDateTime', () => {
    test('should parse valid datetime string', () => {
      const result = parseDateTime('2025/01/01 10:30:45');

      expect(result).toBe('2025-01-01T10:30:45Z');
    });

    test('should return current ISO date for invalid format', () => {
      const result = parseDateTime('invalid date');

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});
