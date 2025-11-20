/**
 * ファイルシステム同期ユーティリティのテスト
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fsyncFile, fsyncDirectory, fsyncFileAndDirectory } from '../../../src/core/utils/fsync.js';

describe('fsync', () => {
  const testDir = join(process.cwd(), 'tests', '.tmp', 'fsync-test');
  const testFile = join(testDir, 'test.txt');

  beforeEach(() => {
    // テスト用ディレクトリ作成
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // テスト用ディレクトリ削除
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('fsyncFile', () => {
    it('ファイルのfsyncが正常に実行される', () => {
      // ファイル作成
      writeFileSync(testFile, 'test content', 'utf-8');

      // fsync実行（エラーが発生しないことを確認）
      expect(() => fsyncFile(testFile)).not.toThrow();
    });

    it('存在しないファイルの場合はエラーをスロー', () => {
      const nonExistentFile = join(testDir, 'non-existent.txt');

      // 存在しないファイルのfsyncはエラー
      expect(() => fsyncFile(nonExistentFile)).toThrow();
    });

    it('ファイルを開いて閉じるまで正常に動作する', () => {
      writeFileSync(testFile, 'test content', 'utf-8');

      // fsync実行
      fsyncFile(testFile);

      // ファイルが削除されていないことを確認（正常にクローズされた）
      expect(existsSync(testFile)).toBe(true);
    });
  });

  describe('fsyncDirectory', () => {
    it('ディレクトリのfsyncが正常に実行される', () => {
      // ディレクトリfsync実行（エラーが発生しないことを確認）
      expect(() => fsyncDirectory(testDir)).not.toThrow();
    });

    it('存在しないディレクトリの場合はエラーをスロー', () => {
      const nonExistentDir = join(testDir, 'non-existent-dir');

      // 存在しないディレクトリのfsyncはエラー
      expect(() => fsyncDirectory(nonExistentDir)).toThrow();
    });
  });

  describe('fsyncFileAndDirectory', () => {
    it('ファイルとディレクトリの両方がfsyncされる', () => {
      // ファイル作成
      writeFileSync(testFile, 'test content', 'utf-8');

      // ファイル + ディレクトリfsync実行（エラーが発生しないことを確認）
      expect(() => fsyncFileAndDirectory(testFile)).not.toThrow();
    });

    it('存在しないファイルの場合はエラーをスロー', () => {
      const nonExistentFile = join(testDir, 'non-existent.txt');

      // 存在しないファイルのfsyncはエラー
      expect(() => fsyncFileAndDirectory(nonExistentFile)).toThrow();
    });

    it('ネストされたディレクトリでも正常に動作する', () => {
      const nestedDir = join(testDir, 'nested', 'deep');
      const nestedFile = join(nestedDir, 'test.txt');

      // ネストされたディレクトリ作成
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(nestedFile, 'test content', 'utf-8');

      // fsync実行（エラーが発生しないことを確認）
      expect(() => fsyncFileAndDirectory(nestedFile)).not.toThrow();
    });
  });
});
