/**
 * task-parser.ts のテスト
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { parseTaskListFromSpec } from '../../../src/core/utils/task-parser.js';

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
    expect(tasks[0].title).toBe('GitHubClient への依存性注入パターン導入');
    expect(tasks[1].title).toBe('GitHubIssues への依存性注入パターン導入');
    expect(tasks[2].title).toBe('テストヘルパー関数を実装する');
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
    expect(tasks[0].title).toBe('Task ten');
    expect(tasks[1].title).toBe('Task twenty');
    expect(tasks[2].title).toBe('Task thirty');
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

    // 現在の実装では completed タスクも解析される（`- [ ]` だけでなく `- [x]` も対象）
    // 仕様を確認する必要があるが、ここでは現状の動作をテスト
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Pending task');
  });
});
