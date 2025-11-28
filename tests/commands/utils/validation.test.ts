/**
 * validation.ts のテスト
 */
import { describe, test, expect } from '@jest/globals';
import {
  validateSpecId,
  validatePhase,
  validateGitHubRepo,
  validateRequired,
  validateNumber,
  validateEnum,
  validateStringLength,
  validatePath,
  validateURL,
  validateEmail,
  isGitHubIssueNumber,
  parseGitHubIssueNumber,
  isSpecId,
  VALID_PHASES,
  Phase,
} from '../../../src/commands/utils/validation.js';

describe('validateSpecId', () => {
  test('should accept valid full UUID', () => {
    expect(() =>
      validateSpecId('9712573a-1234-4abc-8def-123456789012')
    ).not.toThrow();
  });

  test('should accept valid partial UUID (8 characters)', () => {
    expect(() => validateSpecId('9712573a')).not.toThrow();
  });

  test('should accept valid partial UUID (more than 8 characters)', () => {
    expect(() => validateSpecId('9712573a-1234')).not.toThrow();
  });

  test('should reject empty string', () => {
    expect(() => validateSpecId('')).toThrow();
  });

  test('should reject UUID shorter than 8 characters', () => {
    expect(() => validateSpecId('9712573')).toThrow();
  });

  test('should reject invalid full UUID (wrong version)', () => {
    expect(() =>
      validateSpecId('9712573a-1234-3abc-8def-123456789012')
    ).toThrow();
  });

  test('should reject invalid full UUID (wrong variant)', () => {
    expect(() =>
      validateSpecId('9712573a-1234-4abc-0def-123456789012')
    ).toThrow();
  });
});

describe('validatePhase', () => {
  test('should accept valid phase (requirements)', () => {
    expect(validatePhase('requirements')).toBe('requirements');
  });

  test('should accept valid phase (design)', () => {
    expect(validatePhase('design')).toBe('design');
  });

  test('should accept valid phase (tasks)', () => {
    expect(validatePhase('tasks')).toBe('tasks');
  });

  test('should accept valid phase (implementation)', () => {
    expect(validatePhase('implementation')).toBe('implementation');
  });

  test('should accept valid phase (completed)', () => {
    expect(validatePhase('completed')).toBe('completed');
  });

  test('should normalize abbreviated phase (req → requirements)', () => {
    expect(validatePhase('req')).toBe('requirements');
  });

  test('should normalize abbreviated phase (impl → implementation)', () => {
    expect(validatePhase('impl')).toBe('implementation');
  });

  test('should normalize abbreviated phase (comp → completed)', () => {
    expect(validatePhase('comp')).toBe('completed');
  });

  test('should reject invalid phase', () => {
    expect(() => validatePhase('invalid')).toThrow();
  });

  test('should reject empty string', () => {
    expect(() => validatePhase('')).toThrow();
  });
});

describe('validateGitHubRepo', () => {
  test('should accept valid owner and repo', () => {
    expect(() => validateGitHubRepo('owner', 'repo')).not.toThrow();
  });

  test('should accept owner with hyphens', () => {
    expect(() => validateGitHubRepo('my-org', 'repo')).not.toThrow();
  });

  test('should accept repo with dots and underscores', () => {
    expect(() => validateGitHubRepo('owner', 'my_repo.js')).not.toThrow();
  });

  test('should reject empty owner', () => {
    expect(() => validateGitHubRepo('', 'repo')).toThrow();
  });

  test('should reject whitespace-only owner', () => {
    expect(() => validateGitHubRepo('   ', 'repo')).toThrow();
  });

  test('should reject owner with invalid characters', () => {
    expect(() => validateGitHubRepo('my@org', 'repo')).toThrow();
  });

  test('should reject empty repo', () => {
    expect(() => validateGitHubRepo('owner', '')).toThrow();
  });

  test('should reject whitespace-only repo', () => {
    expect(() => validateGitHubRepo('owner', '   ')).toThrow();
  });

  test('should reject repo with invalid characters', () => {
    expect(() => validateGitHubRepo('owner', 'my@repo')).toThrow();
  });
});

describe('validateRequired', () => {
  test('should accept valid string', () => {
    expect(validateRequired('value', 'arg')).toBe('value');
  });

  test('should accept valid number', () => {
    expect(validateRequired(123, 'arg')).toBe(123);
  });

  test('should accept valid object', () => {
    const obj = { key: 'value' };
    expect(validateRequired(obj, 'arg')).toBe(obj);
  });

  test('should reject undefined', () => {
    expect(() => validateRequired(undefined, 'arg')).toThrow();
  });

  test('should reject null', () => {
    expect(() => validateRequired(null, 'arg')).toThrow();
  });

  test('should reject empty string', () => {
    expect(() => validateRequired('', 'arg')).toThrow();
  });

  test('should reject whitespace-only string', () => {
    expect(() => validateRequired('   ', 'arg')).toThrow();
  });
});

describe('validateNumber', () => {
  test('should accept valid integer', () => {
    expect(validateNumber('123', 'arg')).toBe(123);
  });

  test('should accept valid float', () => {
    expect(validateNumber('123.45', 'arg')).toBe(123.45);
  });

  test('should accept negative number', () => {
    expect(validateNumber('-123', 'arg')).toBe(-123);
  });

  test('should reject non-numeric string', () => {
    expect(() => validateNumber('abc', 'arg')).toThrow();
  });

  test('should enforce integer constraint', () => {
    expect(() => validateNumber('123.45', 'arg', { integer: true })).toThrow();
  });

  test('should accept integer when integer constraint is set', () => {
    expect(validateNumber('123', 'arg', { integer: true })).toBe(123);
  });

  test('should enforce minimum value', () => {
    expect(() => validateNumber('5', 'arg', { min: 10 })).toThrow();
  });

  test('should accept value equal to minimum', () => {
    expect(validateNumber('10', 'arg', { min: 10 })).toBe(10);
  });

  test('should enforce maximum value', () => {
    expect(() => validateNumber('15', 'arg', { max: 10 })).toThrow();
  });

  test('should accept value equal to maximum', () => {
    expect(validateNumber('10', 'arg', { max: 10 })).toBe(10);
  });

  test('should enforce both min and max', () => {
    expect(validateNumber('5', 'arg', { min: 1, max: 10 })).toBe(5);
    expect(() => validateNumber('0', 'arg', { min: 1, max: 10 })).toThrow();
    expect(() => validateNumber('11', 'arg', { min: 1, max: 10 })).toThrow();
  });
});

describe('validateEnum', () => {
  const validValues = ['option1', 'option2', 'option3'] as const;

  test('should accept valid enum value (option1)', () => {
    expect(validateEnum('option1', validValues, 'arg')).toBe('option1');
  });

  test('should accept valid enum value (option2)', () => {
    expect(validateEnum('option2', validValues, 'arg')).toBe('option2');
  });

  test('should accept valid enum value (option3)', () => {
    expect(validateEnum('option3', validValues, 'arg')).toBe('option3');
  });

  test('should reject invalid enum value', () => {
    expect(() => validateEnum('invalid', validValues, 'arg')).toThrow();
  });

  test('should reject empty string', () => {
    expect(() => validateEnum('', validValues, 'arg')).toThrow();
  });
});

describe('validateStringLength', () => {
  test('should accept string within length range', () => {
    expect(() =>
      validateStringLength('hello', 'arg', { min: 1, max: 10 })
    ).not.toThrow();
  });

  test('should accept string equal to minimum length', () => {
    expect(() =>
      validateStringLength('hello', 'arg', { min: 5 })
    ).not.toThrow();
  });

  test('should accept string equal to maximum length', () => {
    expect(() =>
      validateStringLength('hello', 'arg', { max: 5 })
    ).not.toThrow();
  });

  test('should reject string shorter than minimum', () => {
    expect(() =>
      validateStringLength('hi', 'arg', { min: 5 })
    ).toThrow();
  });

  test('should reject string longer than maximum', () => {
    expect(() =>
      validateStringLength('hello world', 'arg', { max: 5 })
    ).toThrow();
  });

  test('should accept string when no constraints', () => {
    expect(() => validateStringLength('any length', 'arg', {})).not.toThrow();
  });
});

describe('validatePath', () => {
  test('should accept valid path', () => {
    expect(() => validatePath('/path/to/file', 'arg')).not.toThrow();
  });

  test('should accept relative path without traversal', () => {
    expect(() => validatePath('path/to/file', 'arg')).not.toThrow();
  });

  test('should reject path with traversal (..)', () => {
    expect(() => validatePath('/path/../file', 'arg')).toThrow();
  });

  test('should reject path with traversal at start', () => {
    expect(() => validatePath('../file', 'arg')).toThrow();
  });

  test('should reject path with traversal at end', () => {
    expect(() => validatePath('/path/..', 'arg')).toThrow();
  });
});

describe('validateURL', () => {
  test('should accept valid HTTP URL', () => {
    expect(() => validateURL('http://example.com', 'arg')).not.toThrow();
  });

  test('should accept valid HTTPS URL', () => {
    expect(() => validateURL('https://example.com', 'arg')).not.toThrow();
  });

  test('should accept URL with path', () => {
    expect(() =>
      validateURL('https://example.com/path/to/resource', 'arg')
    ).not.toThrow();
  });

  test('should accept URL with query parameters', () => {
    expect(() =>
      validateURL('https://example.com?key=value', 'arg')
    ).not.toThrow();
  });

  test('should reject invalid URL (no protocol)', () => {
    expect(() => validateURL('example.com', 'arg')).toThrow();
  });

  test('should reject invalid URL (malformed)', () => {
    expect(() => validateURL('ht!tp://example.com', 'arg')).toThrow();
  });

  test('should reject empty string', () => {
    expect(() => validateURL('', 'arg')).toThrow();
  });
});

describe('validateEmail', () => {
  test('should accept valid email', () => {
    expect(() => validateEmail('user@example.com', 'arg')).not.toThrow();
  });

  test('should accept email with subdomain', () => {
    expect(() => validateEmail('user@mail.example.com', 'arg')).not.toThrow();
  });

  test('should accept email with dots in local part', () => {
    expect(() => validateEmail('user.name@example.com', 'arg')).not.toThrow();
  });

  test('should accept email with plus sign', () => {
    expect(() => validateEmail('user+tag@example.com', 'arg')).not.toThrow();
  });

  test('should reject email without @', () => {
    expect(() => validateEmail('userexample.com', 'arg')).toThrow();
  });

  test('should reject email without domain', () => {
    expect(() => validateEmail('user@', 'arg')).toThrow();
  });

  test('should reject email without local part', () => {
    expect(() => validateEmail('@example.com', 'arg')).toThrow();
  });

  test('should reject email without TLD', () => {
    expect(() => validateEmail('user@example', 'arg')).toThrow();
  });

  test('should reject email with spaces', () => {
    expect(() => validateEmail('user name@example.com', 'arg')).toThrow();
  });

  test('should reject empty string', () => {
    expect(() => validateEmail('', 'arg')).toThrow();
  });
});

describe('isGitHubIssueNumber', () => {
  test('should return true for "#42" format', () => {
    expect(isGitHubIssueNumber('#42')).toBe(true);
  });

  test('should return true for "42" format (without #)', () => {
    expect(isGitHubIssueNumber('42')).toBe(true);
  });

  test('should return true for single digit issue number', () => {
    expect(isGitHubIssueNumber('#1')).toBe(true);
    expect(isGitHubIssueNumber('1')).toBe(true);
  });

  test('should return true for 6 digit issue number (max)', () => {
    expect(isGitHubIssueNumber('#123456')).toBe(true);
    expect(isGitHubIssueNumber('123456')).toBe(true);
  });

  test('should return false for 7+ digit number', () => {
    expect(isGitHubIssueNumber('#1234567')).toBe(false);
    expect(isGitHubIssueNumber('1234567')).toBe(false);
  });

  test('should return false for spec ID format', () => {
    expect(isGitHubIssueNumber('f6621295')).toBe(false);
    expect(isGitHubIssueNumber('ca338052-941d-4a47-81da-f757558d629c')).toBe(false);
  });

  test('should return false for empty string', () => {
    expect(isGitHubIssueNumber('')).toBe(false);
  });

  test('should return false for whitespace-only string', () => {
    expect(isGitHubIssueNumber('   ')).toBe(false);
  });

  test('should return false for non-numeric string', () => {
    expect(isGitHubIssueNumber('#abc')).toBe(false);
    expect(isGitHubIssueNumber('abc')).toBe(false);
  });

  test('should return false for negative number', () => {
    expect(isGitHubIssueNumber('#-1')).toBe(false);
    expect(isGitHubIssueNumber('-1')).toBe(false);
  });

  test('should return false for decimal number', () => {
    expect(isGitHubIssueNumber('#42.5')).toBe(false);
    expect(isGitHubIssueNumber('42.5')).toBe(false);
  });
});

describe('parseGitHubIssueNumber', () => {
  test('should parse "#42" to 42', () => {
    expect(parseGitHubIssueNumber('#42')).toBe(42);
  });

  test('should parse "42" to 42', () => {
    expect(parseGitHubIssueNumber('42')).toBe(42);
  });

  test('should parse "#1" to 1', () => {
    expect(parseGitHubIssueNumber('#1')).toBe(1);
  });

  test('should parse "#123456" to 123456', () => {
    expect(parseGitHubIssueNumber('#123456')).toBe(123456);
  });

  test('should throw for "#0"', () => {
    expect(() => parseGitHubIssueNumber('#0')).toThrow();
  });

  test('should throw for "0"', () => {
    expect(() => parseGitHubIssueNumber('0')).toThrow();
  });

  test('should throw for empty string', () => {
    expect(() => parseGitHubIssueNumber('')).toThrow();
  });

  test('should throw for whitespace-only string', () => {
    expect(() => parseGitHubIssueNumber('   ')).toThrow();
  });

  test('should throw for non-numeric string', () => {
    expect(() => parseGitHubIssueNumber('#abc')).toThrow();
    expect(() => parseGitHubIssueNumber('abc')).toThrow();
  });

  test('should throw for negative number', () => {
    expect(() => parseGitHubIssueNumber('#-1')).toThrow();
  });
});

describe('isSpecId', () => {
  test('should return true for full UUID', () => {
    expect(isSpecId('ca338052-941d-4a47-81da-f757558d629c')).toBe(true);
  });

  test('should return true for partial UUID (8 characters)', () => {
    expect(isSpecId('f6621295')).toBe(true);
  });

  test('should return true for partial UUID (more than 8 characters)', () => {
    expect(isSpecId('ca338052-941d')).toBe(true);
  });

  test('should return false for string shorter than 8 characters', () => {
    expect(isSpecId('f66212')).toBe(false);
    expect(isSpecId('1234567')).toBe(false);
  });

  test('should return false for GitHub Issue number format', () => {
    expect(isSpecId('#42')).toBe(false);
    expect(isSpecId('42')).toBe(false);
  });

  test('should return false for empty string', () => {
    expect(isSpecId('')).toBe(false);
  });

  test('should return false for string with invalid characters', () => {
    expect(isSpecId('abcdefgh!')).toBe(false);
    expect(isSpecId('12345678@')).toBe(false);
  });

  test('should accept uppercase hex characters', () => {
    expect(isSpecId('CA338052')).toBe(true);
    expect(isSpecId('F6621295-ABCD')).toBe(true);
  });
});
