/**
 * データベース接続の安全性テスト
 *
 * シングルトンパターンが正しく機能し、
 * データベース破損を防ぐことを検証する
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getDatabase,
  closeDatabase,
  getCurrentDatabasePath,
} from '../../../src/core/database/connection.js';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';

describe('Database Connection Safety', () => {
  const testDir = join(process.cwd(), '.test-db');
  const testDbPath = join(testDir, `test-${randomUUID()}.db`);

  beforeEach(() => {
    // テスト用ディレクトリ作成
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // データベース接続をクローズ
    await closeDatabase();

    // テストファイル削除
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('同じパスでの複数回呼び出しは同じインスタンスを返す', () => {
    const db1 = getDatabase({ databasePath: testDbPath });
    const db2 = getDatabase({ databasePath: testDbPath });

    expect(db1).toBe(db2);
    expect(getCurrentDatabasePath()).toBe(testDbPath);
  });

  test('異なるパスが要求された場合はエラーをスローする', () => {
    const dbPath1 = join(testDir, 'db1.db');
    const dbPath2 = join(testDir, 'db2.db');

    // 最初のインスタンス作成
    getDatabase({ databasePath: dbPath1 });

    // 異なるパスでの呼び出しはエラー
    expect(() => {
      getDatabase({ databasePath: dbPath2 });
    }).toThrow(/Database instance already exists/);
  });

  test('closeDatabase() 後は新しいパスで再作成できる', async () => {
    const dbPath1 = join(testDir, 'db1.db');
    const dbPath2 = join(testDir, 'db2.db');

    // 最初のインスタンス
    const db1 = getDatabase({ databasePath: dbPath1 });
    expect(getCurrentDatabasePath()).toBe(dbPath1);

    // クローズ
    await closeDatabase();
    expect(getCurrentDatabasePath()).toBeNull();

    // 新しいパスで再作成
    const db2 = getDatabase({ databasePath: dbPath2 });
    expect(getCurrentDatabasePath()).toBe(dbPath2);

    // 異なるインスタンス
    expect(db1).not.toBe(db2);
  });

  test('config なしでの呼び出しはデフォルトパスを使用する', () => {
    const db = getDatabase();
    const currentPath = getCurrentDatabasePath();

    expect(currentPath).toContain('.cc-craft-kit');
    expect(currentPath).toContain('cc-craft-kit.db');
  });

  test('環境変数 DATABASE_PATH が優先される', () => {
    const customPath = join(testDir, 'custom.db');
    process.env.DATABASE_PATH = customPath;

    const db = getDatabase();
    expect(getCurrentDatabasePath()).toBe(customPath);

    delete process.env.DATABASE_PATH;
  });
});
