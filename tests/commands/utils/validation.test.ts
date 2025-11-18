/**
 * Validation ユーティリティテスト
 */
import { validatePhase, VALID_PHASES } from '../../../src/commands/utils/validation.js';

describe('Validation Utils', () => {
  describe('validatePhase', () => {
    describe('完全形のフェーズ検証', () => {
      test('requirements は有効', () => {
        expect(validatePhase('requirements')).toBe('requirements');
      });

      test('design は有効', () => {
        expect(validatePhase('design')).toBe('design');
      });

      test('tasks は有効', () => {
        expect(validatePhase('tasks')).toBe('tasks');
      });

      test('implementation は有効', () => {
        expect(validatePhase('implementation')).toBe('implementation');
      });

      test('testing は有効', () => {
        expect(validatePhase('testing')).toBe('testing');
      });

      test('completed は有効', () => {
        expect(validatePhase('completed')).toBe('completed');
      });
    });

    describe('省略形のフェーズ検証', () => {
      test('req → requirements', () => {
        expect(validatePhase('req')).toBe('requirements');
      });

      test('reqs → requirements', () => {
        expect(validatePhase('reqs')).toBe('requirements');
      });

      test('des → design', () => {
        expect(validatePhase('des')).toBe('design');
      });

      test('task → tasks', () => {
        expect(validatePhase('task')).toBe('tasks');
      });

      test('impl → implementation', () => {
        expect(validatePhase('impl')).toBe('implementation');
      });

      test('imp → implementation (後方互換性)', () => {
        expect(validatePhase('imp')).toBe('implementation');
      });

      test('test → testing', () => {
        expect(validatePhase('test')).toBe('testing');
      });

      test('comp → completed', () => {
        expect(validatePhase('comp')).toBe('completed');
      });

      test('done → completed', () => {
        expect(validatePhase('done')).toBe('completed');
      });
    });

    describe('大文字・小文字を区別しない', () => {
      test('REQ → requirements', () => {
        expect(validatePhase('REQ')).toBe('requirements');
      });

      test('IMPL → implementation', () => {
        expect(validatePhase('IMPL')).toBe('implementation');
      });

      test('REQUIREMENTS → requirements', () => {
        expect(validatePhase('REQUIREMENTS')).toBe('requirements');
      });

      test('Design → design', () => {
        expect(validatePhase('Design')).toBe('design');
      });
    });

    describe('空白のトリミング', () => {
      test('  req  → requirements', () => {
        expect(validatePhase('  req  ')).toBe('requirements');
      });

      test('  requirements  → requirements', () => {
        expect(validatePhase('  requirements  ')).toBe('requirements');
      });

      test('\\timpl\\t → implementation', () => {
        expect(validatePhase('\timpl\t')).toBe('implementation');
      });
    });

    describe('不正なフェーズ', () => {
      test('無効なフェーズ名はエラー', () => {
        expect(() => validatePhase('invalid')).toThrow();
      });

      test('空文字はエラー', () => {
        expect(() => validatePhase('')).toThrow();
      });

      test('存在しない省略形はエラー', () => {
        expect(() => validatePhase('xyz')).toThrow();
      });
    });
  });

  describe('VALID_PHASES', () => {
    test('すべてのフェーズが定義されている', () => {
      expect(VALID_PHASES).toContain('requirements');
      expect(VALID_PHASES).toContain('design');
      expect(VALID_PHASES).toContain('tasks');
      expect(VALID_PHASES).toContain('implementation');
      expect(VALID_PHASES).toContain('testing');
      expect(VALID_PHASES).toContain('completed');
    });

    test('フェーズ数が6つ', () => {
      expect(VALID_PHASES.length).toBe(6);
    });
  });
});
