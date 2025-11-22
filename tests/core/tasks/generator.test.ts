/**
 * タスクリスト生成モジュールのテスト
 */

import { generateTaskList, generateDetailedTaskList } from '../../../src/core/tasks/generator.js';
import type { AcceptanceCriterion } from '../../../src/core/spec/parser.js';

describe('tasks/generator', () => {
  describe('generateTaskList', () => {
    describe('正常系', () => {
      it('should generate task list from acceptance criteria', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: 'ユーザーはログインできること',
          },
          {
            category: '必須要件',
            checked: true,
            text: 'ログイン後、ダッシュボードが表示されること',
          },
          {
            category: '機能要件',
            checked: false,
            text: 'プロフィール編集機能が利用できること',
          },
        ];

        const result = generateTaskList(criteria);

        expect(result).toContain('### 必須要件');
        expect(result).toContain('- [ ] ユーザーはログインできること');
        expect(result).toContain('- [ ] ログイン後、ダッシュボードが表示されること');
        expect(result).toContain('### 機能要件');
        expect(result).toContain('- [ ] プロフィール編集機能が利用できること');
      });

      it('should reset all checkboxes to unchecked state', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: true,
            text: '完了済みタスク1',
          },
          {
            category: '必須要件',
            checked: true,
            text: '完了済みタスク2',
          },
        ];

        const result = generateTaskList(criteria);

        expect(result).toContain('- [ ] 完了済みタスク1');
        expect(result).toContain('- [ ] 完了済みタスク2');
        expect(result).not.toContain('- [x]');
      });

      it('should follow category order: 必須要件 → 機能要件 → 非機能要件', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '非機能要件',
            checked: false,
            text: 'タスクC',
          },
          {
            category: '機能要件',
            checked: false,
            text: 'タスクB',
          },
          {
            category: '必須要件',
            checked: false,
            text: 'タスクA',
          },
        ];

        const result = generateTaskList(criteria);

        const indexA = result.indexOf('### 必須要件');
        const indexB = result.indexOf('### 機能要件');
        const indexC = result.indexOf('### 非機能要件');

        expect(indexA).toBeLessThan(indexB);
        expect(indexB).toBeLessThan(indexC);
      });

      it('should handle custom categories after standard ones', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: 'タスクA',
          },
          {
            category: 'カスタムカテゴリ',
            checked: false,
            text: 'カスタムタスク',
          },
          {
            category: '機能要件',
            checked: false,
            text: 'タスクB',
          },
        ];

        const result = generateTaskList(criteria);

        const indexStandard1 = result.indexOf('### 必須要件');
        const indexStandard2 = result.indexOf('### 機能要件');
        const indexCustom = result.indexOf('### カスタムカテゴリ');

        expect(indexStandard1).toBeGreaterThan(-1);
        expect(indexStandard2).toBeGreaterThan(-1);
        expect(indexCustom).toBeGreaterThan(-1);
        expect(indexCustom).toBeGreaterThan(indexStandard2);
      });

      it('should preserve task text with special characters', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: 'API エンドポイント /api/v1/users が動作すること',
          },
          {
            category: '必須要件',
            checked: false,
            text: '日本語テキスト「こんにちは」が表示されること',
          },
        ];

        const result = generateTaskList(criteria);

        expect(result).toContain('- [ ] API エンドポイント /api/v1/users が動作すること');
        expect(result).toContain('- [ ] 日本語テキスト「こんにちは」が表示されること');
      });

      it('should add blank lines between categories', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: 'タスクA',
          },
          {
            category: '機能要件',
            checked: false,
            text: 'タスクB',
          },
        ];

        const result = generateTaskList(criteria);

        const lines = result.split('\n');
        const categoryIndex1 = lines.indexOf('### 必須要件');
        const categoryIndex2 = lines.indexOf('### 機能要件');

        expect(lines[categoryIndex1 + 1]).toBe('');
        expect(lines[categoryIndex2 + 1]).toBe('');
      });
    });

    describe('エッジケース', () => {
      it('should return empty string for empty criteria array', () => {
        const criteria: AcceptanceCriterion[] = [];

        const result = generateTaskList(criteria);

        expect(result).toBe('');
      });

      it('should handle single criterion', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: '単一タスク',
          },
        ];

        const result = generateTaskList(criteria);

        expect(result).toContain('### 必須要件');
        expect(result).toContain('- [ ] 単一タスク');
      });

      it('should skip categories with no items', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: 'タスクA',
          },
        ];

        const result = generateTaskList(criteria);

        expect(result).toContain('### 必須要件');
        expect(result).not.toContain('### 機能要件');
        expect(result).not.toContain('### 非機能要件');
      });

      it('should handle multiple items in same category', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: 'タスク1',
          },
          {
            category: '必須要件',
            checked: false,
            text: 'タスク2',
          },
          {
            category: '必須要件',
            checked: false,
            text: 'タスク3',
          },
        ];

        const result = generateTaskList(criteria);

        expect(result).toContain('- [ ] タスク1');
        expect(result).toContain('- [ ] タスク2');
        expect(result).toContain('- [ ] タスク3');

        const categoryCount = (result.match(/### 必須要件/g) || []).length;
        expect(categoryCount).toBe(1);
      });

      it('should handle only custom categories', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: 'カスタムA',
            checked: false,
            text: 'タスクA',
          },
          {
            category: 'カスタムB',
            checked: false,
            text: 'タスクB',
          },
        ];

        const result = generateTaskList(criteria);

        expect(result).toContain('### カスタムA');
        expect(result).toContain('### カスタムB');
        expect(result).not.toContain('### 必須要件');
        expect(result).not.toContain('### 機能要件');
        expect(result).not.toContain('### 非機能要件');
      });

      it('should handle empty text gracefully', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: '',
          },
        ];

        const result = generateTaskList(criteria);

        expect(result).toContain('- [ ] ');
      });
    });
  });

  describe('generateDetailedTaskList', () => {
    describe('正常系', () => {
      it('should generate detailed task list from acceptance criteria', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: 'ユーザーはログインできること',
          },
          {
            category: '機能要件',
            checked: false,
            text: 'プロフィール編集機能が利用できること',
          },
          {
            category: '非機能要件',
            checked: false,
            text: 'レスポンスタイムは1秒以内であること',
          },
        ];

        const result = generateDetailedTaskList(criteria);

        expect(result).toContain('### 必須要件');
        expect(result).toContain('- [ ] ユーザーはログインできること');
        expect(result).toContain('### 機能要件');
        expect(result).toContain('- [ ] プロフィール編集機能が利用できること');
        expect(result).toContain('### 非機能要件');
        expect(result).toContain('- [ ] レスポンスタイムは1秒以内であること');
      });

      it('should follow phase order: 必須要件 → 機能要件 → 非機能要件', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '非機能要件',
            checked: false,
            text: 'タスクC',
          },
          {
            category: '機能要件',
            checked: false,
            text: 'タスクB',
          },
          {
            category: '必須要件',
            checked: false,
            text: 'タスクA',
          },
        ];

        const result = generateDetailedTaskList(criteria);

        const indexA = result.indexOf('### 必須要件');
        const indexB = result.indexOf('### 機能要件');
        const indexC = result.indexOf('### 非機能要件');

        expect(indexA).toBeLessThan(indexB);
        expect(indexB).toBeLessThan(indexC);
      });

      it('should reset all checkboxes to unchecked state', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: true,
            text: '完了済みタスク',
          },
        ];

        const result = generateDetailedTaskList(criteria);

        expect(result).toContain('- [ ] 完了済みタスク');
        expect(result).not.toContain('- [x]');
      });

      it('should handle custom categories after standard phases', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: 'タスクA',
          },
          {
            category: 'セキュリティ要件',
            checked: false,
            text: 'カスタムタスク',
          },
        ];

        const result = generateDetailedTaskList(criteria);

        const indexStandard = result.indexOf('### 必須要件');
        const indexCustom = result.indexOf('### セキュリティ要件');

        expect(indexStandard).toBeGreaterThan(-1);
        expect(indexCustom).toBeGreaterThan(-1);
        expect(indexCustom).toBeGreaterThan(indexStandard);
      });

      it('should add blank lines between sections', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: 'タスクA',
          },
          {
            category: '機能要件',
            checked: false,
            text: 'タスクB',
          },
        ];

        const result = generateDetailedTaskList(criteria);

        const lines = result.split('\n');
        const categoryIndex1 = lines.indexOf('### 必須要件');
        const categoryIndex2 = lines.indexOf('### 機能要件');

        expect(lines[categoryIndex1 + 1]).toBe('');
        expect(lines[categoryIndex2 + 1]).toBe('');
      });
    });

    describe('エッジケース', () => {
      it('should return empty string for empty criteria array', () => {
        const criteria: AcceptanceCriterion[] = [];

        const result = generateDetailedTaskList(criteria);

        expect(result).toBe('');
      });

      it('should handle single criterion', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: '単一タスク',
          },
        ];

        const result = generateDetailedTaskList(criteria);

        expect(result).toContain('### 必須要件');
        expect(result).toContain('- [ ] 単一タスク');
      });

      it('should skip phases with no items', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: 'タスクA',
          },
        ];

        const result = generateDetailedTaskList(criteria);

        expect(result).toContain('### 必須要件');
        expect(result).not.toContain('### 機能要件');
        expect(result).not.toContain('### 非機能要件');
      });

      it('should handle multiple items in same phase', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: 'タスク1',
          },
          {
            category: '必須要件',
            checked: false,
            text: 'タスク2',
          },
          {
            category: '必須要件',
            checked: false,
            text: 'タスク3',
          },
        ];

        const result = generateDetailedTaskList(criteria);

        expect(result).toContain('- [ ] タスク1');
        expect(result).toContain('- [ ] タスク2');
        expect(result).toContain('- [ ] タスク3');

        const phaseCount = (result.match(/### 必須要件/g) || []).length;
        expect(phaseCount).toBe(1);
      });

      it('should handle only custom categories', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: 'カスタムA',
            checked: false,
            text: 'タスクA',
          },
          {
            category: 'カスタムB',
            checked: false,
            text: 'タスクB',
          },
        ];

        const result = generateDetailedTaskList(criteria);

        expect(result).toContain('### カスタムA');
        expect(result).toContain('### カスタムB');
        expect(result).not.toContain('### 必須要件');
        expect(result).not.toContain('### 機能要件');
        expect(result).not.toContain('### 非機能要件');
      });

      it('should preserve task text with special characters', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: 'データベーススキーマを設計する (users, posts, comments)',
          },
        ];

        const result = generateDetailedTaskList(criteria);

        expect(result).toContain('- [ ] データベーススキーマを設計する (users, posts, comments)');
      });
    });

    describe('generateTaskList と generateDetailedTaskList の比較', () => {
      it('should produce identical output for standard categories', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: '必須要件',
            checked: false,
            text: 'タスク1',
          },
          {
            category: '機能要件',
            checked: false,
            text: 'タスク2',
          },
          {
            category: '非機能要件',
            checked: false,
            text: 'タスク3',
          },
        ];

        const result1 = generateTaskList(criteria);
        const result2 = generateDetailedTaskList(criteria);

        expect(result1).toBe(result2);
      });

      it('should produce same output structure for custom categories', () => {
        const criteria: AcceptanceCriterion[] = [
          {
            category: 'カスタムカテゴリ',
            checked: false,
            text: 'カスタムタスク',
          },
        ];

        const result1 = generateTaskList(criteria);
        const result2 = generateDetailedTaskList(criteria);

        expect(result1).toContain('### カスタムカテゴリ');
        expect(result2).toContain('### カスタムカテゴリ');
        expect(result1).toContain('- [ ] カスタムタスク');
        expect(result2).toContain('- [ ] カスタムタスク');
      });
    });
  });
});
