/**
 * Phase Mapping テスト
 */
import {
  normalizePhase,
  getPhaseAliasesHelp,
  PHASE_ALIASES,
} from '../../../src/core/workflow/phase-mapping.js';

describe('Phase Mapping', () => {
  describe('normalizePhase', () => {
    describe('省略形の正規化', () => {
      test('req → requirements', () => {
        expect(normalizePhase('req')).toBe('requirements');
      });

      test('reqs → requirements', () => {
        expect(normalizePhase('reqs')).toBe('requirements');
      });

      test('des → design', () => {
        expect(normalizePhase('des')).toBe('design');
      });

      test('task → tasks', () => {
        expect(normalizePhase('task')).toBe('tasks');
      });

      test('impl → implementation', () => {
        expect(normalizePhase('impl')).toBe('implementation');
      });

      test('imp → implementation (後方互換性)', () => {
        expect(normalizePhase('imp')).toBe('implementation');
      });

      test('test → testing', () => {
        expect(normalizePhase('test')).toBe('testing');
      });

      test('comp → completed', () => {
        expect(normalizePhase('comp')).toBe('completed');
      });

      test('done → completed', () => {
        expect(normalizePhase('done')).toBe('completed');
      });
    });

    describe('完全形の正規化', () => {
      test('requirements はそのまま', () => {
        expect(normalizePhase('requirements')).toBe('requirements');
      });

      test('design はそのまま', () => {
        expect(normalizePhase('design')).toBe('design');
      });

      test('tasks はそのまま', () => {
        expect(normalizePhase('tasks')).toBe('tasks');
      });

      test('implementation はそのまま', () => {
        expect(normalizePhase('implementation')).toBe('implementation');
      });

      test('testing はそのまま', () => {
        expect(normalizePhase('testing')).toBe('testing');
      });

      test('completed はそのまま', () => {
        expect(normalizePhase('completed')).toBe('completed');
      });
    });

    describe('大文字・小文字の正規化', () => {
      test('REQ → requirements', () => {
        expect(normalizePhase('REQ')).toBe('requirements');
      });

      test('IMPL → implementation', () => {
        expect(normalizePhase('IMPL')).toBe('implementation');
      });

      test('REQUIREMENTS → requirements', () => {
        expect(normalizePhase('REQUIREMENTS')).toBe('requirements');
      });

      test('Design → design', () => {
        expect(normalizePhase('Design')).toBe('design');
      });
    });

    describe('空白のトリミング', () => {
      test('  req  → requirements', () => {
        expect(normalizePhase('  req  ')).toBe('requirements');
      });

      test('  requirements  → requirements', () => {
        expect(normalizePhase('  requirements  ')).toBe('requirements');
      });

      test('\\timpl\\t → implementation', () => {
        expect(normalizePhase('\timpl\t')).toBe('implementation');
      });
    });

    describe('不正な入力', () => {
      test('未知の省略形はそのまま返す', () => {
        expect(normalizePhase('invalid')).toBe('invalid');
      });

      test('空文字はそのまま返す', () => {
        expect(normalizePhase('')).toBe('');
      });

      test('スペースのみはそのまま返す', () => {
        expect(normalizePhase('   ')).toBe('');
      });
    });
  });

  describe('PHASE_ALIASES', () => {
    test('すべての省略形が定義されている', () => {
      expect(PHASE_ALIASES.req).toBe('requirements');
      expect(PHASE_ALIASES.reqs).toBe('requirements');
      expect(PHASE_ALIASES.des).toBe('design');
      expect(PHASE_ALIASES.task).toBe('tasks');
      expect(PHASE_ALIASES.impl).toBe('implementation');
      expect(PHASE_ALIASES.imp).toBe('implementation');
      expect(PHASE_ALIASES.test).toBe('testing');
      expect(PHASE_ALIASES.comp).toBe('completed');
      expect(PHASE_ALIASES.done).toBe('completed');
    });

    test('省略形の数が正しい', () => {
      const aliasCount = Object.keys(PHASE_ALIASES).length;
      expect(aliasCount).toBe(9); // req, reqs, des, task, impl, imp, test, comp, done
    });
  });

  describe('getPhaseAliasesHelp', () => {
    test('ヘルプメッセージが生成される', () => {
      const help = getPhaseAliasesHelp();
      expect(help).toContain('Available phase abbreviations:');
      expect(help).toContain('→ requirements');
      expect(help).toContain('→ design');
      expect(help).toContain('→ tasks');
      expect(help).toContain('→ implementation');
      expect(help).toContain('→ testing');
      expect(help).toContain('→ completed');
    });

    test('すべての省略形が含まれる', () => {
      const help = getPhaseAliasesHelp();
      expect(help).toContain('req');
      expect(help).toContain('reqs');
      expect(help).toContain('des');
      expect(help).toContain('task');
      expect(help).toContain('impl');
      expect(help).toContain('imp');
      expect(help).toContain('test');
      expect(help).toContain('comp');
      expect(help).toContain('done');
    });

    test('各フェーズが1行ずつ表示される', () => {
      const help = getPhaseAliasesHelp();
      const lines = help.split('\n');
      // ヘッダー行 + 6フェーズ行 = 7行
      expect(lines.length).toBeGreaterThanOrEqual(7);
    });
  });
});
