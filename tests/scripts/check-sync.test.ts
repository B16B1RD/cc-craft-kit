import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import {
  scanDirectory,
  calculateFileHash,
  calculateFileHashes,
  detectDifferences,
  checkSync,
  type FileInfo,
} from '../../src/scripts/check-sync.js';

describe('check-sync', () => {
  let testDir: string;

  beforeEach(async () => {
    // 一時ディレクトリを作成
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'cc-craft-kit-test-'));
  });

  afterEach(async () => {
    // テスト後にクリーンアップ
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // エラーは無視
    }
  });

  describe('scanDirectory', () => {
    it('should scan directory and return file list', async () => {
      // テストファイルを作成
      const subDir = path.join(testDir, 'test');
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(path.join(subDir, 'file1.ts'), 'content1');
      await fs.writeFile(path.join(subDir, 'file2.ts'), 'content2');
      await fs.writeFile(path.join(subDir, 'file3.json'), '{}');

      const files = await scanDirectory(subDir);

      expect(files).toHaveLength(3);
      expect(files.map((f) => f.relativePath).sort()).toEqual(['file1.ts', 'file2.ts', 'file3.json'].sort());
    });

    it('should exclude non-target extensions', async () => {
      await fs.writeFile(path.join(testDir, 'file.ts'), 'ts');
      await fs.writeFile(path.join(testDir, 'file.txt'), 'txt');
      await fs.writeFile(path.join(testDir, 'file.log'), 'log');

      const files = await scanDirectory(testDir);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe('file.ts');
    });

    it('should scan recursively', async () => {
      const level1 = path.join(testDir, 'level1');
      const level2 = path.join(level1, 'level2');
      await fs.mkdir(level2, { recursive: true });

      await fs.writeFile(path.join(testDir, 'root.ts'), 'root');
      await fs.writeFile(path.join(level1, 'level1.ts'), 'l1');
      await fs.writeFile(path.join(level2, 'level2.ts'), 'l2');

      const files = await scanDirectory(testDir);

      expect(files).toHaveLength(3);
      expect(files.map((f) => f.relativePath).sort()).toEqual([
        'root.ts',
        'level1/level1.ts',
        'level1/level2/level2.ts',
      ].sort());
    });

    it('should handle empty directories', async () => {
      const emptyDir = path.join(testDir, 'empty');
      await fs.mkdir(emptyDir);

      const files = await scanDirectory(emptyDir);

      expect(files).toHaveLength(0);
    });
  });

  describe('calculateFileHash', () => {
    it('should calculate MD5 hash of a file', async () => {
      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello, World!');

      const hash = await calculateFileHash(filePath);

      // "Hello, World!" の MD5 ハッシュ
      expect(hash).toBe('65a8e27d8879283831b664bd8b7f0ad4');
    });

    it('should return different hashes for different contents', async () => {
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');

      await fs.writeFile(file1, 'content1');
      await fs.writeFile(file2, 'content2');

      const hash1 = await calculateFileHash(file1);
      const hash2 = await calculateFileHash(file2);

      expect(hash1).not.toBe(hash2);
    });

    it('should return same hash for identical contents', async () => {
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');

      await fs.writeFile(file1, 'same content');
      await fs.writeFile(file2, 'same content');

      const hash1 = await calculateFileHash(file1);
      const hash2 = await calculateFileHash(file2);

      expect(hash1).toBe(hash2);
    });

    it('should handle large files', async () => {
      const filePath = path.join(testDir, 'large.txt');
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      await fs.writeFile(filePath, largeContent);

      const hash = await calculateFileHash(filePath);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(32); // MD5 ハッシュは32文字
    });
  });

  describe('calculateFileHashes', () => {
    it('should calculate hashes for multiple files', async () => {
      await fs.writeFile(path.join(testDir, 'file1.ts'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.ts'), 'content2');

      const files: FileInfo[] = [
        { relativePath: 'file1.ts', absolutePath: path.join(testDir, 'file1.ts') },
        { relativePath: 'file2.ts', absolutePath: path.join(testDir, 'file2.ts') },
      ];

      const hashes = await calculateFileHashes(files);

      expect(hashes.size).toBe(2);
      expect(hashes.has('file1.ts')).toBe(true);
      expect(hashes.has('file2.ts')).toBe(true);
    });

    it('should handle empty file list', async () => {
      const hashes = await calculateFileHashes([]);

      expect(hashes.size).toBe(0);
    });
  });

  describe('detectDifferences', () => {
    it('should detect modified files', () => {
      const srcHashes = new Map([
        ['file1.ts', 'hash1'],
        ['file2.ts', 'hash2_modified'],
      ]);

      const ccCraftKitHashes = new Map([
        ['file1.ts', 'hash1'],
        ['file2.ts', 'hash2_original'],
      ]);

      const diffs = detectDifferences(srcHashes, ccCraftKitHashes);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toEqual({
        path: 'file2.ts',
        srcHash: 'hash2_modified',
        takumiHash: 'hash2_original',
        status: 'modified',
      });
    });

    it('should detect missing files in .cc-craft-kit/', () => {
      const srcHashes = new Map([
        ['file1.ts', 'hash1'],
        ['file2.ts', 'hash2'],
      ]);

      const ccCraftKitHashes = new Map([
        ['file1.ts', 'hash1'],
      ]);

      const diffs = detectDifferences(srcHashes, ccCraftKitHashes);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toEqual({
        path: 'file2.ts',
        srcHash: 'hash2',
        takumiHash: null,
        status: 'missing_in_cc_craft_kit',
      });
    });

    it('should detect extra files in .cc-craft-kit/', () => {
      const srcHashes = new Map([
        ['file1.ts', 'hash1'],
      ]);

      const ccCraftKitHashes = new Map([
        ['file1.ts', 'hash1'],
        ['file2.ts', 'hash2'],
      ]);

      const diffs = detectDifferences(srcHashes, ccCraftKitHashes);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toEqual({
        path: 'file2.ts',
        srcHash: null,
        takumiHash: 'hash2',
        status: 'extra_in_cc_craft_kit',
      });
    });

    it('should detect multiple types of differences', () => {
      const srcHashes = new Map([
        ['same.ts', 'hash_same'],
        ['modified.ts', 'hash_modified_new'],
        ['missing.ts', 'hash_missing'],
      ]);

      const ccCraftKitHashes = new Map([
        ['same.ts', 'hash_same'],
        ['modified.ts', 'hash_modified_old'],
        ['extra.ts', 'hash_extra'],
      ]);

      const diffs = detectDifferences(srcHashes, ccCraftKitHashes);

      expect(diffs).toHaveLength(3);

      const modified = diffs.find((d) => d.status === 'modified');
      const missing = diffs.find((d) => d.status === 'missing_in_cc_craft_kit');
      const extra = diffs.find((d) => d.status === 'extra_in_cc_craft_kit');

      expect(modified?.path).toBe('modified.ts');
      expect(missing?.path).toBe('missing.ts');
      expect(extra?.path).toBe('extra.ts');
    });

    it('should return empty array when files are in sync', () => {
      const srcHashes = new Map([
        ['file1.ts', 'hash1'],
        ['file2.ts', 'hash2'],
      ]);

      const ccCraftKitHashes = new Map([
        ['file1.ts', 'hash1'],
        ['file2.ts', 'hash2'],
      ]);

      const diffs = detectDifferences(srcHashes, ccCraftKitHashes);

      expect(diffs).toHaveLength(0);
    });
  });

  describe('checkSync (integration)', () => {
    it('should report in sync when files are identical', async () => {
      // src/ と .cc-craft-kit/ を作成
      const srcDir = path.join(testDir, 'src', 'core');
      const ccCraftKitDir = path.join(testDir, '.cc-craft-kit', 'core');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(ccCraftKitDir, { recursive: true });

      await fs.writeFile(path.join(srcDir, 'file.ts'), 'content');
      await fs.writeFile(path.join(ccCraftKitDir, 'file.ts'), 'content');

      const result = await checkSync({ baseDir: testDir, verbose: false });

      expect(result.inSync).toBe(true);
      expect(result.diffs).toHaveLength(0);
    });

    it('should report differences when files are different', async () => {
      const srcDir = path.join(testDir, 'src', 'core');
      const ccCraftKitDir = path.join(testDir, '.cc-craft-kit', 'core');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(ccCraftKitDir, { recursive: true });

      await fs.writeFile(path.join(srcDir, 'file.ts'), 'content1');
      await fs.writeFile(path.join(ccCraftKitDir, 'file.ts'), 'content2');

      const result = await checkSync({ baseDir: testDir, verbose: false });

      expect(result.inSync).toBe(false);
      expect(result.diffs).toHaveLength(1);
      expect(result.diffs[0].status).toBe('modified');
    });
  });
});
