/**
 * placeholder-detector.ts のテスト
 */
import { describe, test, expect } from '@jest/globals';
import {
  detectPlaceholders,
  hasPlaceholderInSection,
  checkRequirementsPhase,
  checkDesignPhase,
} from '../../../src/core/validators/placeholder-detector.js';

describe('placeholder-detector', () => {
  describe('detectPlaceholders', () => {
    test('プレースホルダーが存在しない場合、hasPlaceholders が false', () => {
      const content = `# テスト仕様書

**仕様書 ID:** 12345678-1234-4abc-8def-123456789012
**フェーズ:** requirements

## 1. 背景と目的

### 背景

この機能は既存のシステムを改善するために必要です。

### 目的

ユーザーの利便性を向上させることを目的とします。
`;

      const result = detectPlaceholders(content);

      expect(result.hasPlaceholders).toBe(false);
      expect(result.placeholders).toHaveLength(0);
    });

    test('プレースホルダーが存在する場合、検出される', () => {
      const content = `# テスト仕様書

## 1. 背景と目的

### 背景

(背景を記述してください)

### 目的

(目的を記述してください)

## 3. 受け入れ基準

- [ ] (必須要件1)
- [ ] (必須要件2)
`;

      const result = detectPlaceholders(content);

      expect(result.hasPlaceholders).toBe(true);
      expect(result.placeholders.length).toBeGreaterThan(0);
      expect(result.placeholders.some((p) => p.placeholder.includes('背景を記述してください'))).toBe(true);
      expect(result.placeholders.some((p) => p.placeholder.includes('目的を記述してください'))).toBe(true);
      expect(result.placeholders.some((p) => p.placeholder.includes('必須要件'))).toBe(true);
    });

    test('TODO コメントも検出される', () => {
      const content = `# テスト仕様書

## 1. 背景と目的

TODO: このセクションを完成させる

## 3. 受け入れ基準

FIXME: 受け入れ基準を追加
`;

      const result = detectPlaceholders(content);

      expect(result.hasPlaceholders).toBe(true);
      expect(result.placeholders.some((p) => p.placeholder.includes('TODO'))).toBe(true);
      expect(result.placeholders.some((p) => p.placeholder.includes('FIXME'))).toBe(true);
    });

    test('フェーズを指定した場合、必須セクションの存在もチェックされる', () => {
      const content = `# テスト仕様書

**仕様書 ID:** 12345678-1234-4abc-8def-123456789012
**フェーズ:** requirements

## 1. 背景と目的

完全な背景と目的が記述されています。
`;

      const result = detectPlaceholders(content, 'requirements');

      expect(result.hasPlaceholders).toBe(true);
      // 以下のセクションが不足しているため検出される
      expect(result.placeholders.some((p) => p.placeholder.includes('## 2. 対象ユーザー'))).toBe(true);
      expect(result.placeholders.some((p) => p.placeholder.includes('## 3. 受け入れ基準'))).toBe(true);
      expect(result.placeholders.some((p) => p.placeholder.includes('## 4. 制約条件'))).toBe(true);
      expect(result.placeholders.some((p) => p.placeholder.includes('## 5. 依存関係'))).toBe(true);
    });

    test('行番号が正しく記録される', () => {
      const content = `# テスト仕様書

## 1. 背景と目的

### 背景

(背景を記述してください)
`;

      const result = detectPlaceholders(content);

      expect(result.hasPlaceholders).toBe(true);
      const placeholder = result.placeholders.find((p) => p.placeholder.includes('背景を記述してください'));
      expect(placeholder).toBeDefined();
      expect(placeholder!.lineNumber).toBeGreaterThan(0);
    });
  });

  describe('hasPlaceholderInSection', () => {
    test('セクションが存在しない場合、true を返す', () => {
      const content = `# テスト仕様書

## 1. 背景と目的

完全な背景と目的が記述されています。
`;

      const result = hasPlaceholderInSection(content, '## 2. 対象ユーザー');

      expect(result).toBe(true);
    });

    test('セクションにプレースホルダーが含まれる場合、true を返す', () => {
      const content = `# テスト仕様書

## 1. 背景と目的

(背景を記述してください)
`;

      const result = hasPlaceholderInSection(content, '## 1. 背景と目的');

      expect(result).toBe(true);
    });

    test('セクションが空の場合、true を返す', () => {
      const content = `# テスト仕様書

## 1. 背景と目的

## 2. 対象ユーザー
`;

      const result = hasPlaceholderInSection(content, '## 1. 背景と目的');

      expect(result).toBe(true);
    });

    test('セクションが十分に記述されている場合、false を返す', () => {
      const content = `# テスト仕様書

## 1. 背景と目的

### 背景

この機能は既存のシステムを改善するために必要です。

### 目的

ユーザーの利便性を向上させることを目的とします。

## 2. 対象ユーザー
`;

      const result = hasPlaceholderInSection(content, '## 1. 背景と目的');

      expect(result).toBe(false);
    });

    test('セクションに区切り線のみが含まれる場合、true を返す', () => {
      const content = `# テスト仕様書

## 1. 背景と目的

---

## 2. 対象ユーザー
`;

      const result = hasPlaceholderInSection(content, '## 1. 背景と目的');

      expect(result).toBe(true);
    });
  });

  describe('checkRequirementsPhase', () => {
    test('すべての必須セクションが記述されている場合、空配列を返す', () => {
      const content = `# テスト仕様書

## 1. 背景と目的

完全な背景と目的が記述されています。

## 2. 対象ユーザー

開発者向けのツールです。

## 3. 受け入れ基準

- [ ] 機能Aが正しく動作する
- [ ] 機能Bが正しく動作する

## 4. 制約条件

特になし

## 5. 依存関係

特になし
`;

      const result = checkRequirementsPhase(content);

      expect(result).toHaveLength(0);
    });

    test('不足しているセクションが返される', () => {
      const content = `# テスト仕様書

## 1. 背景と目的

完全な背景と目的が記述されています。

## 2. 対象ユーザー

(対象ユーザーを記述してください)

## 3. 受け入れ基準

(必須要件1)
`;

      const result = checkRequirementsPhase(content);

      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('## 2. 対象ユーザー');
      expect(result).toContain('## 3. 受け入れ基準');
      expect(result).toContain('## 4. 制約条件');
      expect(result).toContain('## 5. 依存関係');
    });
  });

  describe('checkDesignPhase', () => {
    test('設計詳細セクションが存在しない場合、セクション自体が返される', () => {
      const content = `# テスト仕様書

## 1. 背景と目的

完全な背景と目的が記述されています。
`;

      const result = checkDesignPhase(content);

      expect(result).toContain('## 7. 設計詳細');
    });

    test('設計詳細セクションが存在するが、サブセクションが不足している場合、サブセクションが返される', () => {
      const content = `# テスト仕様書

## 7. 設計詳細

### 7.1. アーキテクチャ設計

(アーキテクチャ設計を記述してください)

### 7.5. テスト戦略

(テスト戦略を記述してください)
`;

      const result = checkDesignPhase(content);

      expect(result).toContain('### 7.1. アーキテクチャ設計');
      expect(result).toContain('### 7.5. テスト戦略');
    });

    test('すべての必須サブセクションが記述されている場合、空配列を返す', () => {
      const content = `# テスト仕様書

## 7. 設計詳細

### 7.1. アーキテクチャ設計

イベント駆動アーキテクチャを採用します。

### 7.5. テスト戦略

単体テストとE2Eテストを実施します。
`;

      const result = checkDesignPhase(content);

      expect(result).toHaveLength(0);
    });
  });
});
