/**
 * backup.ts のテスト
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  createBackup,
  restoreBackup,
  listBackups,
  getLatestBackup,
} from '../../../src/core/database/backup.js';

describe('backup', () => {
  const testDir = join(__dirname, '../../.tmp/backup-test');
  const dbPath = join(testDir, 'test.db');
  const backupDir = join(testDir, 'backups');

  beforeEach(() => {
    // テストディレクトリ作成
    mkdirSync(testDir, { recursive: true });
    // ダミーDBファイル作成
    writeFileSync(dbPath, 'test database content');
  });

  afterEach(() => {
    // テストディレクトリ削除
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createBackup', () => {
    test('should create backup file', () => {
      const backupPath = createBackup(dbPath, { backupDir });

      expect(existsSync(backupPath)).toBe(true);
      expect(backupPath).toContain('cc-craft-kit-');
      expect(backupPath).toContain('.db');
    });

    test('should create backup directory if not exists', () => {
      expect(existsSync(backupDir)).toBe(false);

      createBackup(dbPath, { backupDir });

      expect(existsSync(backupDir)).toBe(true);
    });

    test('should throw error if database file not found', () => {
      const nonExistentDb = join(testDir, 'nonexistent.db');

      expect(() => createBackup(nonExistentDb, { backupDir })).toThrow(
        'Database file not found'
      );
    });

    test('should cleanup old backups when maxBackups exceeded', () => {
      const maxBackups = 3;

      // 5個のバックアップ作成
      for (let i = 0; i < 5; i++) {
        createBackup(dbPath, { backupDir, maxBackups });
        // タイムスタンプが異なるように少し待機
        const now = Date.now();
        while (Date.now() - now < 10) {
          // busy wait
        }
      }

      const backups = listBackups(backupDir);
      expect(backups.length).toBe(maxBackups);
    });

    test('should use default backup directory if not specified', () => {
      const backupPath = createBackup(dbPath);

      expect(backupPath).toContain('backups');
      expect(existsSync(backupPath)).toBe(true);
    });

    test('should use default maxBackups if not specified', () => {
      // デフォルトは10個
      for (let i = 0; i < 12; i++) {
        createBackup(dbPath, { backupDir });
        const now = Date.now();
        while (Date.now() - now < 10) {
          // busy wait
        }
      }

      const backups = listBackups(backupDir);
      expect(backups.length).toBe(10);
    });
  });

  describe('restoreBackup', () => {
    test('should restore database from backup', () => {
      const backupPath = createBackup(dbPath, { backupDir });

      // DB を変更
      writeFileSync(dbPath, 'modified content');

      // バックアップから復元
      restoreBackup(backupPath, dbPath);

      // 元の内容に戻っていることを確認
      const content = require('fs').readFileSync(dbPath, 'utf-8');
      expect(content).toBe('test database content');
    });

    test('should create emergency backup of existing database', () => {
      const backupPath = createBackup(dbPath, { backupDir });

      restoreBackup(backupPath, dbPath);

      // emergency バックアップが作成されていることを確認
      const files = require('fs').readdirSync(testDir);
      const emergencyBackup = files.find((f: string) =>
        f.startsWith('test.db.emergency-')
      );
      expect(emergencyBackup).toBeDefined();
    });

    test('should throw error if backup file not found', () => {
      const nonExistentBackup = join(backupDir, 'nonexistent.db');

      expect(() => restoreBackup(nonExistentBackup, dbPath)).toThrow(
        'Backup file not found'
      );
    });

    test('should restore even if target database does not exist', () => {
      const backupPath = createBackup(dbPath, { backupDir });
      const newDbPath = join(testDir, 'new.db');

      restoreBackup(backupPath, newDbPath);

      expect(existsSync(newDbPath)).toBe(true);
    });
  });

  describe('listBackups', () => {
    test('should return empty array if backup directory does not exist', () => {
      const backups = listBackups(join(testDir, 'nonexistent'));

      expect(backups).toEqual([]);
    });

    test('should list all backup files', () => {
      createBackup(dbPath, { backupDir });
      // タイムスタンプが異なるように少し待機
      let now = Date.now();
      while (Date.now() - now < 10) {
        // busy wait
      }
      createBackup(dbPath, { backupDir });

      const backups = listBackups(backupDir);

      expect(backups.length).toBeGreaterThanOrEqual(2);
      for (const backup of backups) {
        expect(backup.path).toContain('cc-craft-kit-');
        expect(backup.date).toBeTruthy();
        expect(typeof backup.date.getTime).toBe('function');
      }
    });

    test('should sort backups by date (newest first)', () => {
      createBackup(dbPath, { backupDir });
      let now = Date.now();
      while (Date.now() - now < 10) {
        // busy wait
      }
      createBackup(dbPath, { backupDir });

      const backups = listBackups(backupDir);

      expect(backups.length).toBeGreaterThanOrEqual(2);
      // 新しい順にソート
      for (let i = 0; i < backups.length - 1; i++) {
        expect(backups[i].date.getTime()).toBeGreaterThanOrEqual(
          backups[i + 1].date.getTime()
        );
      }
    });

    test('should filter only backup files', () => {
      createBackup(dbPath, { backupDir });
      // 非バックアップファイル作成
      writeFileSync(join(backupDir, 'other-file.txt'), 'test');
      writeFileSync(join(backupDir, 'another.db'), 'test');

      const backups = listBackups(backupDir);

      // cc-craft-kit- で始まる .db ファイルのみ
      for (const backup of backups) {
        expect(backup.path).toMatch(/cc-craft-kit-.*\.db$/);
      }
    });
  });

  describe('getLatestBackup', () => {
    test('should return null if no backups exist', () => {
      const latest = getLatestBackup(join(testDir, 'nonexistent'));

      expect(latest).toBe(null);
    });

    test('should return the latest backup', () => {
      const backup1 = createBackup(dbPath, { backupDir });
      let now = Date.now();
      while (Date.now() - now < 10) {
        // busy wait
      }
      const backup2 = createBackup(dbPath, { backupDir });

      const latest = getLatestBackup(backupDir);

      expect(latest).toBe(backup2);
    });

    test('should return only one backup even if multiple exist', () => {
      createBackup(dbPath, { backupDir });
      createBackup(dbPath, { backupDir });
      createBackup(dbPath, { backupDir });

      const latest = getLatestBackup(backupDir);

      expect(latest).not.toBe(null);
      expect(typeof latest).toBe('string');
    });
  });
});
