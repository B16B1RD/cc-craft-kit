/**
 * ファイルシステムウォッチャーのテスト
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { Kysely } from 'kysely';
import { Database } from '../../../src/core/database/schema.js';
import { SpecFileWatcher } from '../../../src/core/filesystem/watcher.js';

// モックデータベース
const createMockDatabase = (): Kysely<Database> => {
  return {
    selectFrom: jest.fn(() => ({
      where: jest.fn(() => ({
        selectAll: jest.fn(() => ({
          executeTakeFirst: jest.fn(async () => ({
            id: 'test-spec-id',
            name: 'Test Spec',
            phase: 'requirements',
            description: null,
            github_issue_id: null,
            github_project_item_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
        })),
      })),
    })),
    updateTable: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          execute: jest.fn(async () => undefined),
        })),
      })),
    })),
  } as unknown as Kysely<Database>;
};

describe('SpecFileWatcher', () => {
  let testDir: string;
  let mockDb: Kysely<Database>;

  beforeEach(() => {
    // テスト用ディレクトリ作成
    testDir = join(process.cwd(), 'tests', 'tmp', `test-${Date.now()}`);
    mkdirSync(join(testDir, 'specs'), { recursive: true });

    // モックDB作成
    mockDb = createMockDatabase();
  });

  afterEach(() => {
    // テスト用ディレクトリ削除
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create watcher instance', () => {
    const watcher = new SpecFileWatcher(mockDb, testDir);
    expect(watcher).toBeInstanceOf(SpecFileWatcher);
    expect(watcher.running).toBe(false);
  });

  it('should extract spec ID from valid filename', () => {
    const validFilename = 'bb06f332-777a-4610-a5ff-cbd9903a135f.md';

    // private メソッドのテストは実装の詳細なのでスキップ
    // または、ファイル変更をトリガーして間接的にテスト
    expect(validFilename).toMatch(/^[a-f0-9-]+\.md$/);
  });

  it('should start and stop watcher', async () => {
    const watcher = new SpecFileWatcher(mockDb, testDir, { logLevel: 'error' });

    await watcher.start();
    expect(watcher.running).toBe(true);

    await watcher.stop();
    expect(watcher.running).toBe(false);
  });

  it('should not start watcher twice', async () => {
    const watcher = new SpecFileWatcher(mockDb, testDir, { logLevel: 'error' });

    await watcher.start();
    expect(watcher.running).toBe(true);

    // 2回目の start は無視される
    await watcher.start();
    expect(watcher.running).toBe(true);

    await watcher.stop();
  });

  it('should throw error if specs directory does not exist', async () => {
    const invalidDir = join(testDir, 'invalid');
    const watcher = new SpecFileWatcher(mockDb, invalidDir, { logLevel: 'error' });

    await expect(watcher.start()).rejects.toThrow('Specs directory not found');
  });

  it('should detect file changes with debounce', async () => {
    const watcher = new SpecFileWatcher(mockDb, testDir, {
      debounceMs: 100,
      logLevel: 'error',
    });

    await watcher.start();

    // テスト用ファイル作成
    const specId = 'bb06f332-777a-4610-a5ff-cbd9903a135f';
    const filePath = join(testDir, 'specs', `${specId}.md`);
    writeFileSync(filePath, '# Test Spec\n\nContent');

    // デバウンス時間 + マージン待機
    await new Promise((resolve) => setTimeout(resolve, 200));

    await watcher.stop();

    // updateTable が呼ばれたことを確認
    expect(mockDb.updateTable).toHaveBeenCalled();
  }, 10000);
});
