/**
 * JSON ストレージユーティリティのテスト
 */

import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  readJsonFile,
  writeJsonFile,
  appendJsonlFile,
  readJsonlFile,
  ensureMetaDir,
  getMetaDir,
  getJsonFilePath,
} from '../../../src/core/storage/json-storage.js';

describe('JSON Storage Utility', () => {
  let testDir: string;
  let metaDir: string;

  beforeEach(() => {
    // 一意のテストディレクトリを作成
    testDir = join(tmpdir(), `cc-craft-kit-test-${randomUUID()}`);
    metaDir = join(testDir, '.cc-craft-kit', 'meta');
    mkdirSync(metaDir, { recursive: true });
  });

  afterEach(() => {
    // テストディレクトリをクリーンアップ
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getMetaDir', () => {
    it('デフォルトでは process.cwd() 配下の .cc-craft-kit/meta を返す', () => {
      const result = getMetaDir();
      expect(result).toContain('.cc-craft-kit');
      expect(result).toContain('meta');
    });

    it('baseDir が指定された場合はその配下の .cc-craft-kit/meta を返す', () => {
      const result = getMetaDir(testDir);
      expect(result).toBe(metaDir);
    });
  });

  describe('ensureMetaDir', () => {
    it('ディレクトリが存在しない場合は作成する', () => {
      const newTestDir = join(tmpdir(), `cc-craft-kit-test-${randomUUID()}`);
      const newMetaDir = join(newTestDir, '.cc-craft-kit', 'meta');

      expect(existsSync(newMetaDir)).toBe(false);

      ensureMetaDir(newTestDir);

      expect(existsSync(newMetaDir)).toBe(true);

      // クリーンアップ
      rmSync(newTestDir, { recursive: true, force: true });
    });
  });

  describe('getJsonFilePath', () => {
    it('ファイル名と baseDir からフルパスを生成する', () => {
      const result = getJsonFilePath('specs.json', testDir);
      expect(result).toBe(join(metaDir, 'specs.json'));
    });
  });

  describe('readJsonFile', () => {
    it('ファイルが存在しない場合は空配列を返す', () => {
      const result = readJsonFile(join(metaDir, 'nonexistent.json'));
      expect(result).toEqual([]);
    });

    it('空ファイルの場合は空配列を返す', () => {
      const filePath = join(metaDir, 'empty.json');
      writeFileSync(filePath, '', 'utf-8');

      const result = readJsonFile(filePath);
      expect(result).toEqual([]);
    });

    it('有効な JSON 配列を読み込める', () => {
      const filePath = join(metaDir, 'valid.json');
      const data = [{ id: '1', name: 'test' }, { id: '2', name: 'test2' }];
      writeFileSync(filePath, JSON.stringify(data), 'utf-8');

      const result = readJsonFile(filePath);
      expect(result).toEqual(data);
    });

    it('配列でない場合はエラーをスローする', () => {
      const filePath = join(metaDir, 'object.json');
      writeFileSync(filePath, JSON.stringify({ key: 'value' }), 'utf-8');

      expect(() => readJsonFile(filePath)).toThrow('Expected array');
    });

    it('無効な JSON の場合はエラーをスローする', () => {
      const filePath = join(metaDir, 'invalid.json');
      writeFileSync(filePath, 'not valid json', 'utf-8');

      expect(() => readJsonFile(filePath)).toThrow('Failed to parse JSON file');
    });
  });

  describe('writeJsonFile', () => {
    it('配列をファイルに書き込める', () => {
      const filePath = join(metaDir, 'output.json');
      const data = [{ id: '1', name: 'test' }];

      writeJsonFile(filePath, data);

      const content = readFileSync(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });

    it('整形された JSON を出力する', () => {
      const filePath = join(metaDir, 'formatted.json');
      const data = [{ id: '1', name: 'test' }];

      writeJsonFile(filePath, data);

      const content = readFileSync(filePath, 'utf-8');
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });

    it('ディレクトリが存在しない場合は作成する', () => {
      const newDir = join(metaDir, 'subdir');
      const filePath = join(newDir, 'new.json');

      writeJsonFile(filePath, []);

      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe('appendJsonlFile', () => {
    it('ファイルに 1 行追記できる', () => {
      const filePath = join(metaDir, 'logs.jsonl');
      const log1 = { id: '1', message: 'first' };
      const log2 = { id: '2', message: 'second' };

      appendJsonlFile(filePath, log1);
      appendJsonlFile(filePath, log2);

      const content = readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0])).toEqual(log1);
      expect(JSON.parse(lines[1])).toEqual(log2);
    });

    it('ディレクトリが存在しない場合は作成する', () => {
      const newDir = join(metaDir, 'logs');
      const filePath = join(newDir, 'new.jsonl');

      appendJsonlFile(filePath, { id: '1' });

      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe('readJsonlFile', () => {
    it('ファイルが存在しない場合は空配列を返す', () => {
      const result = readJsonlFile(join(metaDir, 'nonexistent.jsonl'));
      expect(result).toEqual([]);
    });

    it('空ファイルの場合は空配列を返す', () => {
      const filePath = join(metaDir, 'empty.jsonl');
      writeFileSync(filePath, '', 'utf-8');

      const result = readJsonlFile(filePath);
      expect(result).toEqual([]);
    });

    it('複数行を読み込める', () => {
      const filePath = join(metaDir, 'multi.jsonl');
      const lines = [
        JSON.stringify({ id: '1' }),
        JSON.stringify({ id: '2' }),
        JSON.stringify({ id: '3' }),
      ].join('\n');
      writeFileSync(filePath, lines + '\n', 'utf-8');

      const result = readJsonlFile(filePath);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ id: '1' });
      expect(result[1]).toEqual({ id: '2' });
      expect(result[2]).toEqual({ id: '3' });
    });

    it('無効な行はスキップする', () => {
      const filePath = join(metaDir, 'mixed.jsonl');
      const content = [
        JSON.stringify({ id: '1' }),
        'invalid json line',
        JSON.stringify({ id: '2' }),
      ].join('\n');
      writeFileSync(filePath, content + '\n', 'utf-8');

      // 警告が出力されることを確認
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = readJsonlFile(filePath);

      expect(result).toHaveLength(2);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid JSONL line'));

      warnSpy.mockRestore();
    });
  });
});
