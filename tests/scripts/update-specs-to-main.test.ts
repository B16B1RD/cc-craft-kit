/**
 * データベース更新スクリプトの単体テスト
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getDatabase, closeDatabase, createDatabase } from '../../src/core/database/connection.js';
import { migrateToLatest } from '../../src/core/database/migrator.js';
import { updateAllSpecsToMain, verifyAllSpecsOnMain } from '../../src/scripts/update-specs-to-main.js';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/core/database/schema.js';

describe('update-specs-to-main', () => {
  let db: Kysely<Database>;

  beforeEach(async () => {
    // インメモリデータベースを作成
    db = createDatabase({ databasePath: ':memory:' });

    // マイグレーション実行
    await migrateToLatest(db);

    // 既存のデータをすべてクリア（マイグレーションで追加されたデータを削除）
    await db.deleteFrom('specs').execute();

    // テストデータを新規投入
    await db.insertInto('specs').values([
      {
        id: 'spec-1',
        name: 'Spec 1',
        branch_name: 'feature/test-1',
        phase: 'requirements',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'spec-2',
        name: 'Spec 2',
        branch_name: 'develop',
        phase: 'design',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'spec-3',
        name: 'Spec 3',
        branch_name: 'main',
        phase: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]).execute();
  });

  afterEach(async () => {
    await closeDatabase();
  });

  describe('updateAllSpecsToMain', () => {
    it('すべての仕様書の branch_name を main に更新する', async () => {
      await updateAllSpecsToMain(db);

      const allSpecs = await db.selectFrom('specs').selectAll().execute();
      expect(allSpecs.every(spec => spec.branch_name === 'main')).toBe(true);
    });

    it('既に main の仕様書はそのまま', async () => {
      await updateAllSpecsToMain(db);

      const spec3 = await db.selectFrom('specs')
        .selectAll()
        .where('id', '=', 'spec-3')
        .executeTakeFirstOrThrow();

      expect(spec3.branch_name).toBe('main');
    });

    it('異なるブランチの仕様書が main に更新される', async () => {
      await updateAllSpecsToMain(db);

      const spec1 = await db.selectFrom('specs')
        .selectAll()
        .where('id', '=', 'spec-1')
        .executeTakeFirstOrThrow();

      expect(spec1.branch_name).toBe('main');
    });
  });

  describe('verifyAllSpecsOnMain', () => {
    it('main 以外のブランチが存在する場合は false を返す', async () => {
      const result = await verifyAllSpecsOnMain(db);
      expect(result).toBe(false);
    });

    it('すべての仕様書が main の場合は true を返す', async () => {
      await updateAllSpecsToMain(db);

      const result = await verifyAllSpecsOnMain(db);
      expect(result).toBe(true);
    });

    it('空のデータベースの場合は true を返す', async () => {
      // すべての仕様書を削除
      await db.deleteFrom('specs').execute();

      const result = await verifyAllSpecsOnMain(db);
      expect(result).toBe(true);
    });
  });
});
