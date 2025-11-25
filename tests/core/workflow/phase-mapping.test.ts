/**
 * phase-mapping.ts のテスト
 */
import { describe, test, expect } from '@jest/globals';
import {
  normalizePhase,
  getPhaseAliasesHelp,
  PHASE_ALIASES,
} from '../../../src/core/workflow/phase-mapping.js';

describe('normalizePhase', () => {
  describe('完全形の入力', () => {
    test('should return requirements as-is', () => {
      expect(normalizePhase('requirements')).toBe('requirements');
    });

    test('should return design as-is', () => {
      expect(normalizePhase('design')).toBe('design');
    });

    test('should return tasks as-is', () => {
      expect(normalizePhase('tasks')).toBe('tasks');
    });

    test('should return implementation as-is', () => {
      expect(normalizePhase('implementation')).toBe('implementation');
    });

    test('should return completed as-is', () => {
      expect(normalizePhase('completed')).toBe('completed');
    });
  });

  describe('省略形の入力 (requirements)', () => {
    test('should expand req to requirements', () => {
      expect(normalizePhase('req')).toBe('requirements');
    });

    test('should expand reqs to requirements', () => {
      expect(normalizePhase('reqs')).toBe('requirements');
    });
  });

  describe('省略形の入力 (design)', () => {
    test('should expand des to design', () => {
      expect(normalizePhase('des')).toBe('design');
    });
  });

  describe('省略形の入力 (tasks)', () => {
    test('should expand task to tasks', () => {
      expect(normalizePhase('task')).toBe('tasks');
    });
  });

  describe('省略形の入力 (implementation)', () => {
    test('should expand impl to implementation', () => {
      expect(normalizePhase('impl')).toBe('implementation');
    });

    test('should expand imp to implementation (backward compatibility)', () => {
      expect(normalizePhase('imp')).toBe('implementation');
    });
  });

  describe('省略形の入力 (completed)', () => {
    test('should expand comp to completed', () => {
      expect(normalizePhase('comp')).toBe('completed');
    });

    test('should expand done to completed', () => {
      expect(normalizePhase('done')).toBe('completed');
    });
  });

  describe('大文字小文字の処理', () => {
    test('should normalize uppercase input (REQ)', () => {
      expect(normalizePhase('REQ')).toBe('requirements');
    });

    test('should normalize uppercase input (IMPL)', () => {
      expect(normalizePhase('IMPL')).toBe('implementation');
    });

    test('should normalize mixed case input (Requirements)', () => {
      expect(normalizePhase('Requirements')).toBe('requirements');
    });

    test('should normalize mixed case input (CoMp)', () => {
      expect(normalizePhase('CoMp')).toBe('completed');
    });
  });

  describe('空白文字の処理', () => {
    test('should trim leading whitespace', () => {
      expect(normalizePhase('  req')).toBe('requirements');
    });

    test('should trim trailing whitespace', () => {
      expect(normalizePhase('req  ')).toBe('requirements');
    });

    test('should trim both leading and trailing whitespace', () => {
      expect(normalizePhase('  design  ')).toBe('design');
    });
  });

  describe('不明な入力', () => {
    test('should return unknown input as-is (lowercase)', () => {
      expect(normalizePhase('unknown')).toBe('unknown');
    });

    test('should return empty string as-is', () => {
      expect(normalizePhase('')).toBe('');
    });
  });
});

describe('getPhaseAliasesHelp', () => {
  test('should return help message with header', () => {
    const help = getPhaseAliasesHelp();
    expect(help).toContain('Available phase abbreviations:');
  });

  test('should include requirements aliases', () => {
    const help = getPhaseAliasesHelp();
    expect(help).toContain('→ requirements');
    expect(help).toContain('req');
    expect(help).toContain('reqs');
  });

  test('should include design aliases', () => {
    const help = getPhaseAliasesHelp();
    expect(help).toContain('→ design');
    expect(help).toContain('des');
  });

  test('should include tasks aliases', () => {
    const help = getPhaseAliasesHelp();
    expect(help).toContain('→ tasks');
    expect(help).toContain('task');
  });

  test('should include implementation aliases', () => {
    const help = getPhaseAliasesHelp();
    expect(help).toContain('→ implementation');
    expect(help).toContain('impl');
    expect(help).toContain('imp');
  });

  test('should include completed aliases', () => {
    const help = getPhaseAliasesHelp();
    expect(help).toContain('→ completed');
    expect(help).toContain('comp');
    expect(help).toContain('done');
  });

  test('should format help message with newlines', () => {
    const help = getPhaseAliasesHelp();
    const lines = help.split('\n');
    expect(lines.length).toBeGreaterThan(1);
  });
});

describe('PHASE_ALIASES', () => {
  test('should contain all expected aliases', () => {
    const expectedAliases = [
      'req',
      'reqs',
      'des',
      'task',
      'impl',
      'imp',
      'comp',
      'done',
    ];

    for (const alias of expectedAliases) {
      expect(PHASE_ALIASES).toHaveProperty(alias);
    }
  });

  test('should map to valid phase names', () => {
    const validPhases = [
      'requirements',
      'design',
      'tasks',
      'implementation',
      'completed',
    ];

    for (const phase of Object.values(PHASE_ALIASES)) {
      expect(validPhases).toContain(phase);
    }
  });
});
