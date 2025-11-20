/**
 * E2E テスト: データベース整合性
 *
 * 100 回連続で仕様書作成・削除を実行し、
 * データベース不整合が発生しないことを確認します。
 */

// E2E テストであることを示すフラグ（グローバルセットアップをスキップ）
process.env.E2E_TEST = 'true';

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import { getDatabase, closeDatabase } from '../../src/core/database/connection.js';
import { checkDatabaseIntegrity } from '../../src/core/validators/database-integrity-checker.js';
import { randomUUID } from 'crypto';

/**
 * 日時フォーマットヘルパー
 */
function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * テスト用仕様書作成ヘルパー（create.ts の関数を直接呼ばずに実装）
 */
async function createSpecForTest(
  db: ReturnType<typeof getDatabase>,
  name: string,
  description: string | undefined,
  specsDir: string
): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();

  await db
    .insertInto('specs')
    .values({
      id,
      name,
      description: description || null,
      phase: 'requirements',
      created_at: now,
      updated_at: now,
    })
    .execute();

  const specPath = path.join(specsDir, `${id}.md`);
  const content = `# ${name}

**仕様書 ID:** ${id}
**フェーズ:** requirements
**作成日時:** ${formatDateTime(new Date(now))}
**更新日時:** ${formatDateTime(new Date(now))}

---

## 1. 背景と目的

### 背景

${description || '(背景を記述してください)'}
`;

  await fs.writeFile(specPath, content, 'utf-8');
  return id;
}

/**
 * テスト用仕様書削除ヘルパー（delete.ts の関数を直接呼ばずに実装）
 */
async function deleteSpecForTest(
  db: ReturnType<typeof getDatabase>,
  specId: string,
  specsDir: string
): Promise<void> {

  // DB レコード削除
  await db.deleteFrom('specs').where('id', '=', specId).execute();

  // ファイル削除
  const specPath = path.join(specsDir, `${specId}.md`);
  try {
    await fs.unlink(specPath);
  } catch {
    // ファイルが存在しない場合は無視
  }
}

describe('E2E: データベース整合性テスト', () => {
  let testDir: string;
  let specsDir: string;
  let dbPath: string;
  const originalCwd = process.cwd(); // describe スコープで定義

  beforeEach(async () => {
    // データベース接続をクローズ（既存のインスタンスがあれば）
    await closeDatabase();

    // 一時ディレクトリを作成
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'cc-craft-kit-e2e-'));
    const ccCraftKitDir = path.join(testDir, '.cc-craft-kit');
    specsDir = path.join(ccCraftKitDir, 'specs');
    dbPath = path.join(ccCraftKitDir, 'cc-craft-kit.db');

    await fs.mkdir(specsDir, { recursive: true });

    // 作業ディレクトリを変更
    process.chdir(testDir);
  });

  afterEach(async () => {
    // 作業ディレクトリを元に戻す
    process.chdir(originalCwd);

    // データベース接続をクローズ
    await closeDatabase();

    // テスト後にクリーンアップ
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // エラーは無視
    }
  });

  describe('仕様書作成・削除の連続実行', () => {
    it('100 回連続で作成・削除しても不整合が発生しない', async () => {
      const db = getDatabase({ databasePath: dbPath });

      // マイグレーション実行
      await db.schema
        .createTable('specs')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('phase', 'text', (col) => col.notNull())
        .addColumn('created_at', 'text', (col) => col.notNull())
        .addColumn('updated_at', 'text', (col) => col.notNull())
        .execute();

      await db.schema
        .createTable('github_sync')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('entity_type', 'text', (col) => col.notNull())
        .addColumn('entity_id', 'text', (col) => col.notNull())
        .addColumn('github_number', 'integer', (col) => col.notNull())
        .addColumn('github_url', 'text', (col) => col.notNull())
        .addColumn('synced_at', 'text', (col) => col.notNull())
        .execute();

      const iterations = 100;
      const createdIds: string[] = [];

      // 100 回連続で作成
      for (let i = 0; i < iterations; i++) {
        const specName = `テスト仕様書 ${i + 1}`;
        const specDescription = `E2E テスト用の仕様書 ${i + 1}`;

        const specId = await createSpecForTest(db, specName, specDescription, specsDir);
        createdIds.push(specId);

        // 整合性チェック（作成後）
        const createCheck = await checkDatabaseIntegrity(db, specsDir);
        expect(createCheck.isValid).toBe(true);
        expect(createCheck.details.missingFiles).toHaveLength(0);
        expect(createCheck.details.missingInDb).toHaveLength(0);
      }

      // 中間整合性チェック
      const midCheck = await checkDatabaseIntegrity(db, specsDir);
      expect(midCheck.isValid).toBe(true);
      expect(midCheck.stats.totalDbRecords).toBe(iterations);
      expect(midCheck.stats.totalFiles).toBe(iterations);

      // 100 回連続で削除
      for (let i = 0; i < iterations; i++) {
        const specId = createdIds[i];

        await deleteSpecForTest(db, specId, specsDir);

        // 整合性チェック（削除後）
        const deleteCheck = await checkDatabaseIntegrity(db, specsDir);
        expect(deleteCheck.isValid).toBe(true);
        expect(deleteCheck.details.missingFiles).toHaveLength(0);
        expect(deleteCheck.details.missingInDb).toHaveLength(0);
      }

      // 最終整合性チェック
      const finalCheck = await checkDatabaseIntegrity(db, specsDir);
      expect(finalCheck.isValid).toBe(true);
      expect(finalCheck.stats.totalDbRecords).toBe(0);
      expect(finalCheck.stats.totalFiles).toBe(0);
      expect(finalCheck.details.missingFiles).toHaveLength(0);
      expect(finalCheck.details.missingInDb).toHaveLength(0);
    }, 60000); // タイムアウト: 60 秒

    it('作成・削除を交互に実行しても不整合が発生しない', async () => {
      const db = getDatabase({ databasePath: dbPath });

      // マイグレーション実行
      await db.schema
        .createTable('specs')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('phase', 'text', (col) => col.notNull())
        .addColumn('created_at', 'text', (col) => col.notNull())
        .addColumn('updated_at', 'text', (col) => col.notNull())
        .execute();

      await db.schema
        .createTable('github_sync')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('entity_type', 'text', (col) => col.notNull())
        .addColumn('entity_id', 'text', (col) => col.notNull())
        .addColumn('github_number', 'integer', (col) => col.notNull())
        .addColumn('github_url', 'text', (col) => col.notNull())
        .addColumn('synced_at', 'text', (col) => col.notNull())
        .execute();

      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        // 作成
        const specName = `交互テスト仕様書 ${i + 1}`;
        const specId = await createSpecForTest(db, specName, undefined, specsDir);

        // 作成直後の整合性チェック
        const createCheck = await checkDatabaseIntegrity(db, specsDir);
        expect(createCheck.isValid).toBe(true);

        // 削除
        await deleteSpecForTest(db, specId, specsDir);

        // 削除直後の整合性チェック
        const deleteCheck = await checkDatabaseIntegrity(db, specsDir);
        expect(deleteCheck.isValid).toBe(true);
        expect(deleteCheck.stats.totalDbRecords).toBe(0);
        expect(deleteCheck.stats.totalFiles).toBe(0);
      }

      // 最終整合性チェック
      const finalCheck = await checkDatabaseIntegrity(db, specsDir);
      expect(finalCheck.isValid).toBe(true);
      expect(finalCheck.details.missingFiles).toHaveLength(0);
      expect(finalCheck.details.missingInDb).toHaveLength(0);
    }, 60000); // タイムアウト: 60 秒

    it('孤立レコードが発生しない', async () => {
      const db = getDatabase({ databasePath: dbPath });

      // マイグレーション実行
      await db.schema
        .createTable('specs')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('phase', 'text', (col) => col.notNull())
        .addColumn('created_at', 'text', (col) => col.notNull())
        .addColumn('updated_at', 'text', (col) => col.notNull())
        .execute();

      await db.schema
        .createTable('github_sync')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('entity_type', 'text', (col) => col.notNull())
        .addColumn('entity_id', 'text', (col) => col.notNull())
        .addColumn('github_number', 'integer', (col) => col.notNull())
        .addColumn('github_url', 'text', (col) => col.notNull())
        .addColumn('synced_at', 'text', (col) => col.notNull())
        .execute();

      // 20 個の仕様書を作成
      const createdIds: string[] = [];
      for (let i = 0; i < 20; i++) {
        const specId = await createSpecForTest(db, `孤立テスト仕様書 ${i + 1}`, undefined, specsDir);
        createdIds.push(specId);
      }

      // 中間チェック: 孤立レコードが 0 件
      const midCheck = await checkDatabaseIntegrity(db, specsDir);
      expect(midCheck.details.missingFiles).toHaveLength(0);

      // 10 個削除
      for (let i = 0; i < 10; i++) {
        await deleteSpecForTest(db, createdIds[i], specsDir);
      }

      // 削除後チェック: 孤立レコードが 0 件
      const afterDeleteCheck = await checkDatabaseIntegrity(db, specsDir);
      expect(afterDeleteCheck.details.missingFiles).toHaveLength(0);
      expect(afterDeleteCheck.stats.totalDbRecords).toBe(10);
      expect(afterDeleteCheck.stats.totalFiles).toBe(10);

      // 残りをすべて削除
      for (let i = 10; i < 20; i++) {
        await deleteSpecForTest(db, createdIds[i], specsDir);
      }

      // 最終チェック: すべて削除され、孤立レコードが 0 件
      const finalCheck = await checkDatabaseIntegrity(db, specsDir);
      expect(finalCheck.isValid).toBe(true);
      expect(finalCheck.details.missingFiles).toHaveLength(0);
      expect(finalCheck.stats.totalDbRecords).toBe(0);
      expect(finalCheck.stats.totalFiles).toBe(0);
    }, 60000); // タイムアウト: 60 秒
  });

  describe('異常終了シミュレーション', () => {
    it('データベース接続が正常にクローズされる', async () => {
      const db = getDatabase({ databasePath: dbPath });

      // マイグレーション実行
      await db.schema
        .createTable('specs')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('phase', 'text', (col) => col.notNull())
        .addColumn('created_at', 'text', (col) => col.notNull())
        .addColumn('updated_at', 'text', (col) => col.notNull())
        .execute();

      // 仕様書を 5 個作成
      for (let i = 0; i < 5; i++) {
        const specId = randomUUID();
        const now = new Date().toISOString();
        await db
          .insertInto('specs')
          .values({
            id: specId,
            name: `異常終了テスト ${i + 1}`,
            description: null,
            phase: 'requirements',
            created_at: now,
            updated_at: now,
          })
          .execute();

        // ファイル作成
        const specPath = path.join(specsDir, `${specId}.md`);
        await fs.writeFile(
          specPath,
          `# 異常終了テスト ${i + 1}\n\n**仕様書 ID:** ${specId}\n**フェーズ:** requirements\n**作成日時:** ${now}\n**更新日時:** ${now}\n`
        );
      }

      // データベース接続をクローズ（正常終了をシミュレート）
      await closeDatabase();

      // 再接続して整合性チェック
      const db2 = getDatabase({ databasePath: dbPath });
      const check = await checkDatabaseIntegrity(db2, specsDir);

      expect(check.isValid).toBe(true);
      expect(check.stats.totalDbRecords).toBe(5);
      expect(check.stats.totalFiles).toBe(5);
      expect(check.details.missingFiles).toHaveLength(0);
      expect(check.details.missingInDb).toHaveLength(0);
    });
  });
});
