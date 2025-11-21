import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import { getDatabase, closeDatabase } from '../../src/core/database/connection.js';
import { checkDatabaseIntegrity } from '../../src/core/validators/database-integrity-checker.js';

describe('repair-database script', () => {
  let testDir: string;
  let specsDir: string;
  let dbPath: string;

  beforeEach(async () => {
    // 一時ディレクトリを作成
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'cc-craft-kit-repair-test-'));
    specsDir = path.join(testDir, 'specs');
    dbPath = path.join(testDir, 'test.db');

    await fs.mkdir(specsDir, { recursive: true });

    // データベース接続をクローズ（既存のインスタンスがあれば）
    await closeDatabase();
  });

  afterEach(async () => {
    // データベース接続をクローズ
    await closeDatabase();

    // テスト後にクリーンアップ
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // エラーは無視
    }
  });

  describe('孤立レコード削除機能', () => {
    it('ファイルが存在しない DB レコードを削除する', async () => {
      // テスト用のデータベース作成
      const db = getDatabase({ databasePath: dbPath });

      // マイグレーション実行
      await db.schema
        .createTable('specs')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('phase', 'text', (col) => col.notNull())
        .addColumn('branch_name', 'text', (col) => col.notNull())
        .addColumn('created_at', 'text', (col) => col.notNull())
        .addColumn('updated_at', 'text', (col) => col.notNull())
        .execute();

      // 1. ファイルありレコード（正常）
      const validSpecId = 'valid-spec-id';
      const validSpecPath = path.join(specsDir, `${validSpecId}.md`);
      const validSpecContent = `# Valid Spec

**仕様書 ID:** ${validSpecId}
**フェーズ:** requirements
**作成日時:** 2025/11/20 10:00:00
**更新日時:** 2025/11/20 10:00:00
`;
      await fs.writeFile(validSpecPath, validSpecContent);

      await db
        .insertInto('specs')
        .values({
          id: validSpecId,
          name: 'Valid Spec',
          description: null,
          phase: 'requirements',
          branch_name: 'develop',
          created_at: '2025-11-20T10:00:00.000Z',
          updated_at: '2025-11-20T10:00:00.000Z',
        })
        .execute();

      // 2. 孤立レコード（ファイルなし）
      const orphanedSpecId = 'orphaned-spec-id';
      await db
        .insertInto('specs')
        .values({
          id: orphanedSpecId,
          name: 'Orphaned Spec',
          description: null,
          phase: 'requirements',
          branch_name: 'develop',
          created_at: '2025-11-20T10:00:00.000Z',
          updated_at: '2025-11-20T10:00:00.000Z',
        })
        .execute();

      // 整合性チェック前の状態確認
      const beforeCheck = await checkDatabaseIntegrity(db, specsDir);
      expect(beforeCheck.isValid).toBe(false);
      expect(beforeCheck.details.missingFiles).toHaveLength(1);
      expect(beforeCheck.details.missingFiles[0].id).toBe(orphanedSpecId);

      // 孤立レコードを削除
      for (const { id } of beforeCheck.details.missingFiles) {
        await db.deleteFrom('specs').where('id', '=', id).execute();
      }

      // 整合性チェック後の状態確認
      const afterCheck = await checkDatabaseIntegrity(db, specsDir);
      expect(afterCheck.isValid).toBe(true);
      expect(afterCheck.details.missingFiles).toHaveLength(0);
      expect(afterCheck.stats.totalDbRecords).toBe(1);
      expect(afterCheck.stats.totalFiles).toBe(1);
    });

    it('複数の孤立レコードを一括削除する', async () => {
      // テスト用のデータベース作成
      const db = getDatabase({ databasePath: dbPath });

      // マイグレーション実行
      await db.schema
        .createTable('specs')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('phase', 'text', (col) => col.notNull())
        .addColumn('branch_name', 'text', (col) => col.notNull())
        .addColumn('created_at', 'text', (col) => col.notNull())
        .addColumn('updated_at', 'text', (col) => col.notNull())
        .execute();

      // 3つの孤立レコードを作成
      const orphanedIds = ['orphaned-1', 'orphaned-2', 'orphaned-3'];
      for (const id of orphanedIds) {
        await db
          .insertInto('specs')
          .values({
            id,
            name: `Orphaned Spec ${id}`,
            description: null,
            phase: 'requirements',
            branch_name: 'develop',
            created_at: '2025-11-20T10:00:00.000Z',
            updated_at: '2025-11-20T10:00:00.000Z',
          })
          .execute();
      }

      // 整合性チェック
      const beforeCheck = await checkDatabaseIntegrity(db, specsDir);
      expect(beforeCheck.details.missingFiles).toHaveLength(3);

      // 孤立レコードを一括削除
      let deletedCount = 0;
      for (const { id } of beforeCheck.details.missingFiles) {
        await db.deleteFrom('specs').where('id', '=', id).execute();
        deletedCount++;
      }

      expect(deletedCount).toBe(3);

      // 整合性チェック後の状態確認
      const afterCheck = await checkDatabaseIntegrity(db, specsDir);
      expect(afterCheck.isValid).toBe(true);
      expect(afterCheck.details.missingFiles).toHaveLength(0);
      expect(afterCheck.stats.totalDbRecords).toBe(0);
    });

    it('孤立レコード削除処理が冪等性を持つ', async () => {
      // テスト用のデータベース作成
      const db = getDatabase({ databasePath: dbPath });

      // マイグレーション実行
      await db.schema
        .createTable('specs')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('phase', 'text', (col) => col.notNull())
        .addColumn('branch_name', 'text', (col) => col.notNull())
        .addColumn('created_at', 'text', (col) => col.notNull())
        .addColumn('updated_at', 'text', (col) => col.notNull())
        .execute();

      // 孤立レコードを作成
      const orphanedId = 'orphaned-spec';
      await db
        .insertInto('specs')
        .values({
          id: orphanedId,
          name: 'Orphaned Spec',
          description: null,
          phase: 'requirements',
          branch_name: 'develop',
          created_at: '2025-11-20T10:00:00.000Z',
          updated_at: '2025-11-20T10:00:00.000Z',
        })
        .execute();

      // 1回目の削除処理
      const firstCheck = await checkDatabaseIntegrity(db, specsDir);
      for (const { id } of firstCheck.details.missingFiles) {
        await db.deleteFrom('specs').where('id', '=', id).execute();
      }

      const afterFirst = await checkDatabaseIntegrity(db, specsDir);
      expect(afterFirst.isValid).toBe(true);
      expect(afterFirst.details.missingFiles).toHaveLength(0);

      // 2回目の削除処理（冪等性確認）
      const secondCheck = await checkDatabaseIntegrity(db, specsDir);
      for (const { id } of secondCheck.details.missingFiles) {
        await db.deleteFrom('specs').where('id', '=', id).execute();
      }

      const afterSecond = await checkDatabaseIntegrity(db, specsDir);
      expect(afterSecond.isValid).toBe(true);
      expect(afterSecond.details.missingFiles).toHaveLength(0);

      // 3回目の削除処理（冪等性確認）
      const thirdCheck = await checkDatabaseIntegrity(db, specsDir);
      for (const { id } of thirdCheck.details.missingFiles) {
        await db.deleteFrom('specs').where('id', '=', id).execute();
      }

      const afterThird = await checkDatabaseIntegrity(db, specsDir);
      expect(afterThird.isValid).toBe(true);
      expect(afterThird.details.missingFiles).toHaveLength(0);
    });

    it('正常なレコードは削除されない', async () => {
      // テスト用のデータベース作成
      const db = getDatabase({ databasePath: dbPath });

      // マイグレーション実行
      await db.schema
        .createTable('specs')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('phase', 'text', (col) => col.notNull())
        .addColumn('branch_name', 'text', (col) => col.notNull())
        .addColumn('created_at', 'text', (col) => col.notNull())
        .addColumn('updated_at', 'text', (col) => col.notNull())
        .execute();

      // 正常なレコードとファイルを作成
      const validSpecId = 'valid-spec-id';
      const validSpecPath = path.join(specsDir, `${validSpecId}.md`);
      const validSpecContent = `# Valid Spec

**仕様書 ID:** ${validSpecId}
**フェーズ:** requirements
**作成日時:** 2025/11/20 10:00:00
**更新日時:** 2025/11/20 10:00:00
`;
      await fs.writeFile(validSpecPath, validSpecContent);

      await db
        .insertInto('specs')
        .values({
          id: validSpecId,
          name: 'Valid Spec',
          description: null,
          phase: 'requirements',
          branch_name: 'develop',
          created_at: '2025-11-20T10:00:00.000Z',
          updated_at: '2025-11-20T10:00:00.000Z',
        })
        .execute();

      // 整合性チェック
      const check = await checkDatabaseIntegrity(db, specsDir);
      expect(check.isValid).toBe(true);
      expect(check.details.missingFiles).toHaveLength(0);

      // 孤立レコード削除処理（削除対象なし）
      for (const { id } of check.details.missingFiles) {
        await db.deleteFrom('specs').where('id', '=', id).execute();
      }

      // 正常なレコードが残っているか確認
      const afterCheck = await checkDatabaseIntegrity(db, specsDir);
      expect(afterCheck.isValid).toBe(true);
      expect(afterCheck.stats.totalDbRecords).toBe(1);

      const records = await db.selectFrom('specs').selectAll().execute();
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe(validSpecId);
    });
  });
});
