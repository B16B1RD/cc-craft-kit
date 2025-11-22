/**
 * 仕様書パーサーモジュールのテスト
 */

import { readFileSync } from 'node:fs';
import {
  parseAcceptanceCriteria,
  parseTaskList,
  hasTaskListSection,
  type AcceptanceCriterion,
  type TaskItem,
} from '../../../src/core/spec/parser.js';

// ファイルシステムをモック化
jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
}));

describe('spec/parser', () => {
  const mockReadFileSync = jest.mocked(readFileSync);

  beforeEach(() => {
    mockReadFileSync.mockReset();
  });

  describe('parseAcceptanceCriteria', () => {
    describe('正常系', () => {
      it('should parse acceptance criteria from spec file', () => {
        const specContent = `# 仕様書タイトル

## 1. 概要

## 2. 目的

## 3. 受け入れ基準

### 必須要件

- [ ] ユーザーはログインできること
- [x] ログイン後、ダッシュボードが表示されること

### 機能要件

- [ ] プロフィール編集機能が利用できること
- [ ] パスワード変更機能が利用できること

### 非機能要件

- [ ] レスポンスタイムは1秒以内であること

## 4. 設計
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseAcceptanceCriteria('/path/to/spec.md');

        expect(result).toHaveLength(5);
        expect(result[0]).toEqual({
          category: '必須要件',
          checked: false,
          text: 'ユーザーはログインできること',
        });
        expect(result[1]).toEqual({
          category: '必須要件',
          checked: true,
          text: 'ログイン後、ダッシュボードが表示されること',
        });
        expect(result[2]).toEqual({
          category: '機能要件',
          checked: false,
          text: 'プロフィール編集機能が利用できること',
        });
        expect(result[3]).toEqual({
          category: '機能要件',
          checked: false,
          text: 'パスワード変更機能が利用できること',
        });
        expect(result[4]).toEqual({
          category: '非機能要件',
          checked: false,
          text: 'レスポンスタイムは1秒以内であること',
        });
      });

      it('should handle multiple categories with mixed checkboxes', () => {
        const specContent = `## 3. 受け入れ基準

### カテゴリA

- [x] 完了済みタスク1
- [ ] 未完了タスク1
- [x] 完了済みタスク2

### カテゴリB

- [ ] 未完了タスク2

## 4. 設計
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseAcceptanceCriteria('/path/to/spec.md');

        expect(result).toHaveLength(4);
        expect(result[0]).toEqual({
          category: 'カテゴリA',
          checked: true,
          text: '完了済みタスク1',
        });
        expect(result[1]).toEqual({
          category: 'カテゴリA',
          checked: false,
          text: '未完了タスク1',
        });
        expect(result[2]).toEqual({
          category: 'カテゴリA',
          checked: true,
          text: '完了済みタスク2',
        });
        expect(result[3]).toEqual({
          category: 'カテゴリB',
          checked: false,
          text: '未完了タスク2',
        });
      });

      it('should handle spec file with leading/trailing whitespace', () => {
        const specContent = `
## 3. 受け入れ基準

### 必須要件

- [ ] テスト項目1
- [x] テスト項目2

## 4. 設計
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseAcceptanceCriteria('/path/to/spec.md');

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          category: '必須要件',
          checked: false,
          text: 'テスト項目1',
        });
        expect(result[1]).toEqual({
          category: '必須要件',
          checked: true,
          text: 'テスト項目2',
        });
      });

      it('should preserve text with special characters', () => {
        const specContent = `## 3. 受け入れ基準

### 必須要件

- [ ] APIエンドポイント /api/v1/users が動作すること
- [ ] 日本語テキスト「こんにちは」が表示されること
- [ ] 記号: !@#$%^&*() が含まれること

## 4. 設計
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseAcceptanceCriteria('/path/to/spec.md');

        expect(result).toHaveLength(3);
        expect(result[0].text).toBe('APIエンドポイント /api/v1/users が動作すること');
        expect(result[1].text).toBe('日本語テキスト「こんにちは」が表示されること');
        expect(result[2].text).toBe('記号: !@#$%^&*() が含まれること');
      });
    });

    describe('エッジケース', () => {
      it('should return empty array when no acceptance criteria section exists', () => {
        const specContent = `# 仕様書タイトル

## 1. 概要

## 2. 目的

## 4. 設計
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseAcceptanceCriteria('/path/to/spec.md');

        expect(result).toEqual([]);
      });

      it('should return empty array when acceptance criteria section is empty', () => {
        const specContent = `## 3. 受け入れ基準

## 4. 設計
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseAcceptanceCriteria('/path/to/spec.md');

        expect(result).toEqual([]);
      });

      it('should ignore checkboxes without category', () => {
        const specContent = `## 3. 受け入れ基準

- [ ] カテゴリなしの項目

### 必須要件

- [ ] カテゴリありの項目

## 4. 設計
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseAcceptanceCriteria('/path/to/spec.md');

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          category: '必須要件',
          checked: false,
          text: 'カテゴリありの項目',
        });
      });

      it('should handle category with no checkboxes', () => {
        const specContent = `## 3. 受け入れ基準

### カテゴリA

### カテゴリB

- [ ] カテゴリBの項目

## 4. 設計
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseAcceptanceCriteria('/path/to/spec.md');

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          category: 'カテゴリB',
          checked: false,
          text: 'カテゴリBの項目',
        });
      });

      it('should stop parsing at section 4', () => {
        const specContent = `## 3. 受け入れ基準

### 必須要件

- [ ] 項目1

## 4. 設計

### 不正なカテゴリ

- [ ] 無視される項目
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseAcceptanceCriteria('/path/to/spec.md');

        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('項目1');
      });

      it('should handle checkbox with indentation', () => {
        const specContent = `## 3. 受け入れ基準

### 必須要件

  - [ ] インデントされた項目
    - [ ] さらにインデントされた項目

## 4. 設計
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseAcceptanceCriteria('/path/to/spec.md');

        expect(result).toHaveLength(2);
        expect(result[0].text).toBe('インデントされた項目');
        expect(result[1].text).toBe('さらにインデントされた項目');
      });

      it('should handle empty file', () => {
        mockReadFileSync.mockReturnValue('');

        const result = parseAcceptanceCriteria('/path/to/spec.md');

        expect(result).toEqual([]);
      });

      it('should handle file with only section header', () => {
        const specContent = '## 3. 受け入れ基準';

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseAcceptanceCriteria('/path/to/spec.md');

        expect(result).toEqual([]);
      });
    });

    describe('エラーケース', () => {
      it('should throw error when file cannot be read', () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('ENOENT: no such file or directory');
        });

        expect(() => parseAcceptanceCriteria('/invalid/path.md')).toThrow(
          'ENOENT: no such file or directory'
        );
      });

      it('should handle malformed checkbox syntax gracefully', () => {
        const specContent = `## 3. 受け入れ基準

### 必須要件

- [] 空白なしのチェックボックス
- [x 閉じ括弧なし
- x] 開き括弧なし
- [ ] 正常なチェックボックス

## 4. 設計
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseAcceptanceCriteria('/path/to/spec.md');

        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('正常なチェックボックス');
      });
    });
  });

  describe('parseTaskList', () => {
    describe('正常系', () => {
      it('should parse task list from spec file', () => {
        const specContent = `# 仕様書

## 8. 実装タスクリスト

### 必須要件

- [ ] タスク1
- [x] タスク2
  - [ ] サブタスク1
  - [x] サブタスク2

### 機能要件

- [ ] タスク3

## 9. その他のセクション
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseTaskList('/path/to/spec.md');

        expect(result).toHaveLength(5);
        expect(result[0]).toEqual({
          checked: false,
          text: 'タスク1',
          indentLevel: 0,
        });
        expect(result[1]).toEqual({
          checked: true,
          text: 'タスク2',
          indentLevel: 0,
        });
        expect(result[2]).toEqual({
          checked: false,
          text: 'サブタスク1',
          indentLevel: 1,
        });
        expect(result[3]).toEqual({
          checked: true,
          text: 'サブタスク2',
          indentLevel: 1,
        });
        expect(result[4]).toEqual({
          checked: false,
          text: 'タスク3',
          indentLevel: 0,
        });
      });

      it('should handle deeply nested tasks', () => {
        const specContent = `## 8. 実装タスクリスト

- [ ] レベル0
  - [ ] レベル1
    - [ ] レベル2
      - [ ] レベル3
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseTaskList('/path/to/spec.md');

        expect(result).toHaveLength(4);
        expect(result[0].indentLevel).toBe(0);
        expect(result[1].indentLevel).toBe(1);
        expect(result[2].indentLevel).toBe(2);
        expect(result[3].indentLevel).toBe(3);
      });

      it('should preserve task text with special characters', () => {
        const specContent = `## 8. 実装タスクリスト

- [ ] データベーススキーマを設計する (users, posts, comments)
- [ ] API エンドポイント GET /api/v1/users/:id を実装
- [ ] 日本語タスク「ユーザー認証機能」の実装

## 9. その他
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseTaskList('/path/to/spec.md');

        expect(result).toHaveLength(3);
        expect(result[0].text).toBe('データベーススキーマを設計する (users, posts, comments)');
        expect(result[1].text).toBe('API エンドポイント GET /api/v1/users/:id を実装');
        expect(result[2].text).toBe('日本語タスク「ユーザー認証機能」の実装');
      });
    });

    describe('エッジケース', () => {
      it('should return empty array when no task list section exists', () => {
        const specContent = `# 仕様書

## 1. 概要

## 2. 目的
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseTaskList('/path/to/spec.md');

        expect(result).toEqual([]);
      });

      it('should return empty array when task list section is empty', () => {
        const specContent = `## 8. 実装タスクリスト

## 9. その他
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseTaskList('/path/to/spec.md');

        expect(result).toEqual([]);
      });

      it('should stop parsing at next section', () => {
        const specContent = `## 8. 実装タスクリスト

- [ ] タスク1

## 9. その他のセクション

- [ ] 無視されるタスク
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseTaskList('/path/to/spec.md');

        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('タスク1');
      });

      it('should handle empty file', () => {
        mockReadFileSync.mockReturnValue('');

        const result = parseTaskList('/path/to/spec.md');

        expect(result).toEqual([]);
      });

      it('should handle file with only section header', () => {
        const specContent = '## 8. 実装タスクリスト';

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseTaskList('/path/to/spec.md');

        expect(result).toEqual([]);
      });

      it('should handle inconsistent indentation (3 spaces)', () => {
        const specContent = `## 8. 実装タスクリスト

- [ ] タスク1
   - [ ] 3スペースインデント

## 9. その他
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseTaskList('/path/to/spec.md');

        expect(result).toHaveLength(2);
        expect(result[0].indentLevel).toBe(0);
        expect(result[1].indentLevel).toBe(1); // 3スペース / 2 = 1 (floor)
      });

      it('should handle tasks without categories', () => {
        const specContent = `## 8. 実装タスクリスト

- [ ] タスク1
- [ ] タスク2

## 9. その他
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseTaskList('/path/to/spec.md');

        expect(result).toHaveLength(2);
      });
    });

    describe('エラーケース', () => {
      it('should throw error when file cannot be read', () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('ENOENT: no such file or directory');
        });

        expect(() => parseTaskList('/invalid/path.md')).toThrow(
          'ENOENT: no such file or directory'
        );
      });

      it('should handle malformed checkbox syntax gracefully', () => {
        const specContent = `## 8. 実装タスクリスト

- [] 空白なしのチェックボックス
- [x 閉じ括弧なし
- [ ] 正常なチェックボックス

## 9. その他
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = parseTaskList('/path/to/spec.md');

        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('正常なチェックボックス');
      });
    });
  });

  describe('hasTaskListSection', () => {
    describe('正常系', () => {
      it('should return true when task list section exists', () => {
        const specContent = `# 仕様書

## 8. 実装タスクリスト

- [ ] タスク1
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = hasTaskListSection('/path/to/spec.md');

        expect(result).toBe(true);
      });

      it('should return true even if task list is empty', () => {
        const specContent = `# 仕様書

## 8. 実装タスクリスト

## 9. その他
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = hasTaskListSection('/path/to/spec.md');

        expect(result).toBe(true);
      });
    });

    describe('エッジケース', () => {
      it('should return false when task list section does not exist', () => {
        const specContent = `# 仕様書

## 1. 概要

## 2. 目的
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = hasTaskListSection('/path/to/spec.md');

        expect(result).toBe(false);
      });

      it('should return false for empty file', () => {
        mockReadFileSync.mockReturnValue('');

        const result = hasTaskListSection('/path/to/spec.md');

        expect(result).toBe(false);
      });

      it('should return false when section header has different format', () => {
        const specContent = `# 仕様書

## 8.実装タスクリスト

## 9. その他
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = hasTaskListSection('/path/to/spec.md');

        expect(result).toBe(false); // スペースが必須
      });

      it('should return false when section header is in different case', () => {
        const specContent = `# 仕様書

## 8. Implementation Task List

## 9. その他
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = hasTaskListSection('/path/to/spec.md');

        expect(result).toBe(false); // 完全一致が必要
      });

      it('should be case-sensitive and whitespace-sensitive', () => {
        const specContent = `# 仕様書

##  8. 実装タスクリスト

## 9. その他
`;

        mockReadFileSync.mockReturnValue(specContent);

        const result = hasTaskListSection('/path/to/spec.md');

        expect(result).toBe(false); // 余分なスペースあり
      });
    });

    describe('エラーケース', () => {
      it('should throw error when file cannot be read', () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('ENOENT: no such file or directory');
        });

        expect(() => hasTaskListSection('/invalid/path.md')).toThrow(
          'ENOENT: no such file or directory'
        );
      });
    });
  });
});
