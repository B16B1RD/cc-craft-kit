/**
 * task-parser.ts のテスト
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  parseTaskListFromSpec,
  parseTaskListFromContent,
} from '../../../src/core/utils/task-parser.js';

describe('parseTaskListFromSpec', () => {
  const testDir = join(__dirname, '../../.tmp');
  const testFilePath = join(testDir, 'test-spec.md');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await unlink(testFilePath);
    } catch {
      // ファイルが存在しない場合は無視
    }
  });

  test('should parse tasks from spec file', async () => {
    const content = `
# Test Specification

## 8. 実装タスクリスト

- [ ] **タスク 1**: GitHubClient への依存性注入パターン導入
- [ ] **タスク 2**: GitHubIssues への依存性注入パターン導入
- [ ] **タスク 3**: テストヘルパー関数を実装する
`;

    await writeFile(testFilePath, content, 'utf-8');

    const tasks = await parseTaskListFromSpec(testFilePath);

    expect(tasks).toHaveLength(3);
    // 新しい実装ではタイトル全体（「**タスク X**: ...」形式を含む）が返される
    expect(tasks[0].title).toBe('**タスク 1**: GitHubClient への依存性注入パターン導入');
    expect(tasks[1].title).toBe('**タスク 2**: GitHubIssues への依存性注入パターン導入');
    expect(tasks[2].title).toBe('**タスク 3**: テストヘルパー関数を実装する');
    expect(tasks[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  test('should return empty array when no task section exists', async () => {
    const content = `
# Test Specification

## 1. Background

Some content here.
`;

    await writeFile(testFilePath, content, 'utf-8');

    const tasks = await parseTaskListFromSpec(testFilePath);

    expect(tasks).toEqual([]);
  });

  test('should handle spec with empty task list', async () => {
    const content = `
# Test Specification

## 8. 実装タスクリスト

(No tasks defined yet)
`;

    await writeFile(testFilePath, content, 'utf-8');

    const tasks = await parseTaskListFromSpec(testFilePath);

    expect(tasks).toEqual([]);
  });

  test('should parse tasks with sequential numbering', async () => {
    const content = `
# Test Specification

## 8. 実装タスクリスト

- [ ] **タスク 10**: Task ten
- [ ] **タスク 20**: Task twenty
- [ ] **タスク 30**: Task thirty
`;

    await writeFile(testFilePath, content, 'utf-8');

    const tasks = await parseTaskListFromSpec(testFilePath);

    expect(tasks).toHaveLength(3);
    // 新しい実装ではタイトル全体が返される
    expect(tasks[0].title).toBe('**タスク 10**: Task ten');
    expect(tasks[1].title).toBe('**タスク 20**: Task twenty');
    expect(tasks[2].title).toBe('**タスク 30**: Task thirty');
  });

  test('should ignore completed tasks', async () => {
    const content = `
# Test Specification

## 8. 実装タスクリスト

- [x] **タスク 1**: Completed task
- [ ] **タスク 2**: Pending task
`;

    await writeFile(testFilePath, content, 'utf-8');

    const tasks = await parseTaskListFromSpec(testFilePath);

    // 新しい実装では completed タスク（[x]）は解析しない
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('**タスク 2**: Pending task');
  });
});

describe('parseTaskListFromContent', () => {
  describe('シンプルなチェックボックス形式', () => {
    test('基本的なチェックボックス形式を解析できる', () => {
      const content = `# 仕様書

## 8. 実装タスクリスト

- [ ] タスク1を実装する
- [ ] タスク2を実装する
- [ ] タスク3を実装する
`;

      const tasks = parseTaskListFromContent(content);

      expect(tasks).toHaveLength(3);
      expect(tasks[0].title).toBe('タスク1を実装する');
      expect(tasks[1].title).toBe('タスク2を実装する');
      expect(tasks[2].title).toBe('タスク3を実装する');
    });

    test('Phase 単位でグループ化されたタスクリストを解析できる', () => {
      const content = `# 仕様書

## 8. 実装タスクリスト

### Phase 1: 基盤変更

- [ ] schema.ts の SpecPhase 型から tasks を非推奨化
- [ ] spec-phase.md の design フェーズ後処理を更新

### Phase 2: GitHub 統合

- [ ] github-integration.ts を更新
- [ ] E2E テストを追加
`;

      const tasks = parseTaskListFromContent(content);

      expect(tasks).toHaveLength(4);
      expect(tasks[0].title).toBe('schema.ts の SpecPhase 型から tasks を非推奨化');
      expect(tasks[1].title).toBe('spec-phase.md の design フェーズ後処理を更新');
      expect(tasks[2].title).toBe('github-integration.ts を更新');
      expect(tasks[3].title).toBe('E2E テストを追加');
    });

    test('バッククォート付きのタスクを解析できる', () => {
      const content = `# 仕様書

## 8. 実装タスクリスト

- [ ] \`schema.ts\` の SpecPhase 型を更新
- [ ] \`spec-phase.md\` を修正
`;

      const tasks = parseTaskListFromContent(content);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('`schema.ts` の SpecPhase 型を更新');
      expect(tasks[1].title).toBe('`spec-phase.md` を修正');
    });
  });

  describe('エッジケース', () => {
    test('タスクリストセクションがない場合は空配列を返す', () => {
      const content = `# 仕様書

## 7. 設計詳細

設計内容...
`;

      const tasks = parseTaskListFromContent(content);

      expect(tasks).toHaveLength(0);
    });

    test('チェックボックスがない場合は空配列を返す', () => {
      const content = `# 仕様書

## 8. 実装タスクリスト

タスクの説明文...
`;

      const tasks = parseTaskListFromContent(content);

      expect(tasks).toHaveLength(0);
    });

    test('完了済みタスク（[x]）は解析しない', () => {
      const content = `# 仕様書

## 8. 実装タスクリスト

- [x] 完了済みタスク
- [ ] 未完了タスク
`;

      const tasks = parseTaskListFromContent(content);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('未完了タスク');
    });

    test('次のセクション（##）がある場合はそこで解析を終了する', () => {
      const content = `# 仕様書

## 8. 実装タスクリスト

- [ ] タスク1

## 9. 補足情報

- [ ] これはタスクではない
`;

      const tasks = parseTaskListFromContent(content);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('タスク1');
    });

    test('区切り線（---）がある場合はそこで解析を終了する', () => {
      const content = `# 仕様書

## 8. 実装タスクリスト

- [ ] タスク1

---

- [ ] これはタスクではない
`;

      const tasks = parseTaskListFromContent(content);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('タスク1');
    });

    test('各タスクに一意のIDが割り当てられる', () => {
      const content = `# 仕様書

## 8. 実装タスクリスト

- [ ] タスク1
- [ ] タスク2
`;

      const tasks = parseTaskListFromContent(content);

      expect(tasks[0].id).not.toBe(tasks[1].id);
      expect(tasks[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    test('インデントされたタスクも解析できる', () => {
      const content = `# 仕様書

## 8. 実装タスクリスト

### Phase 1

  - [ ] インデントされたタスク1
  - [ ] インデントされたタスク2
`;

      const tasks = parseTaskListFromContent(content);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('インデントされたタスク1');
    });
  });
});
