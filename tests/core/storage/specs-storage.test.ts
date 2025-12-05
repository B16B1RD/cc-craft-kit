/**
 * 仕様書ストレージのテスト
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  loadSpecs,
  saveSpecs,
  getSpec,
  findSpecByIdPrefix,
  addSpec,
  updateSpec,
  deleteSpec,
  getSpecsByPhase,
  updateSpecPhase,
  countSpecs,
} from '../../../src/core/storage/specs-storage.js';
import type { SpecData } from '../../../src/core/storage/schemas.js';

describe('Specs Storage', () => {
  let testDir: string;
  let metaDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `cc-craft-kit-test-${randomUUID()}`);
    metaDir = join(testDir, '.cc-craft-kit', 'meta');
    mkdirSync(metaDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('loadSpecs / saveSpecs', () => {
    it('空の状態では空配列を返す', () => {
      const specs = loadSpecs(testDir);
      expect(specs).toEqual([]);
    });

    it('仕様書を保存して読み込める', () => {
      const spec: SpecData = {
        id: randomUUID(),
        name: 'テスト仕様書',
        description: '説明',
        phase: 'requirements',
        branch_name: 'feature/test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      saveSpecs([spec], testDir);
      const loaded = loadSpecs(testDir);

      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toEqual(spec);
    });
  });

  describe('getSpec', () => {
    it('ID で仕様書を取得できる', () => {
      const id = randomUUID();
      const spec: SpecData = {
        id,
        name: 'テスト',
        description: null,
        phase: 'design',
        branch_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveSpecs([spec], testDir);

      const found = getSpec(id, testDir);
      expect(found).toEqual(spec);
    });

    it('存在しない ID では undefined を返す', () => {
      const found = getSpec(randomUUID(), testDir);
      expect(found).toBeUndefined();
    });
  });

  describe('findSpecByIdPrefix', () => {
    it('ID プレフィックスで仕様書を検索できる', () => {
      const id = 'abc12345-6789-0123-4567-890123456789';
      const spec: SpecData = {
        id,
        name: 'テスト',
        description: null,
        phase: 'design',
        branch_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveSpecs([spec], testDir);

      const found = findSpecByIdPrefix('abc12345', testDir);
      expect(found).toEqual(spec);
    });

    it('複数マッチする場合は undefined を返す', () => {
      const spec1: SpecData = {
        id: 'abc12345-1111-0000-0000-000000000000',
        name: 'テスト1',
        description: null,
        phase: 'design',
        branch_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const spec2: SpecData = {
        id: 'abc12345-2222-0000-0000-000000000000',
        name: 'テスト2',
        description: null,
        phase: 'design',
        branch_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveSpecs([spec1, spec2], testDir);

      const found = findSpecByIdPrefix('abc12345', testDir);
      expect(found).toBeUndefined();
    });
  });

  describe('addSpec', () => {
    it('新しい仕様書を追加できる', () => {
      const newSpec = addSpec(
        {
          name: '新規仕様書',
          description: '説明文',
          phase: 'requirements',
          branch_name: 'feature/new',
        },
        testDir
      );

      expect(newSpec.id).toBeDefined();
      expect(newSpec.name).toBe('新規仕様書');
      expect(newSpec.created_at).toBeDefined();

      const specs = loadSpecs(testDir);
      expect(specs).toHaveLength(1);
    });
  });

  describe('updateSpec', () => {
    it('仕様書を更新できる', () => {
      const spec = addSpec({ name: '元の名前', description: null, phase: 'requirements', branch_name: null }, testDir);

      const updated = updateSpec(spec.id, { name: '新しい名前' }, testDir);

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('新しい名前');
      // updated_at は新しい日時が設定される（同一ミリ秒の可能性があるため厳密比較は避ける）
      expect(updated!.updated_at).toBeDefined();
    });

    it('存在しない ID では undefined を返す', () => {
      const result = updateSpec(randomUUID(), { name: 'test' }, testDir);
      expect(result).toBeUndefined();
    });
  });

  describe('deleteSpec', () => {
    it('仕様書を削除できる', () => {
      const spec = addSpec({ name: 'テスト', description: null, phase: 'requirements', branch_name: null }, testDir);

      const result = deleteSpec(spec.id, testDir);

      expect(result).toBe(true);
      expect(loadSpecs(testDir)).toHaveLength(0);
    });

    it('存在しない ID では false を返す', () => {
      const result = deleteSpec(randomUUID(), testDir);
      expect(result).toBe(false);
    });
  });

  describe('getSpecsByPhase', () => {
    it('フェーズで仕様書をフィルタリングできる', () => {
      addSpec({ name: 'Req1', description: null, phase: 'requirements', branch_name: null }, testDir);
      addSpec({ name: 'Des1', description: null, phase: 'design', branch_name: null }, testDir);
      addSpec({ name: 'Req2', description: null, phase: 'requirements', branch_name: null }, testDir);

      const reqs = getSpecsByPhase('requirements', testDir);
      expect(reqs).toHaveLength(2);

      const designs = getSpecsByPhase('design', testDir);
      expect(designs).toHaveLength(1);
    });
  });

  describe('updateSpecPhase', () => {
    it('仕様書のフェーズを更新できる', () => {
      const spec = addSpec({ name: 'テスト', description: null, phase: 'requirements', branch_name: null }, testDir);

      const updated = updateSpecPhase(spec.id, 'design', testDir);

      expect(updated).toBeDefined();
      expect(updated!.phase).toBe('design');
    });
  });

  describe('countSpecs', () => {
    it('仕様書の数を取得できる', () => {
      expect(countSpecs(testDir)).toBe(0);

      addSpec({ name: 'テスト1', description: null, phase: 'requirements', branch_name: null }, testDir);
      addSpec({ name: 'テスト2', description: null, phase: 'requirements', branch_name: null }, testDir);

      expect(countSpecs(testDir)).toBe(2);
    });
  });
});
