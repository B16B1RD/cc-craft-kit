/**
 * E2E テスト: データベース整合性（簡易版）
 *
 * 10 回連続で仕様書作成・削除を実行し、
 * データベース不整合が発生しないことを確認します。
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
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

describe('E2E: データベース整合性テスト（簡易版）', () => {
  let testDir: string;
  let specsDir: string;
  let dbPath: string;
  const originalCwd = process.cwd();

  beforeAll(async () => {
    // 一時ディレクトリを作成
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'cc-craft-kit-e2e-'));
    const ccCraftKitDir = path.join(testDir, '.cc-craft-kit');
    specsDir = path.join(ccCraftKitDir, 'specs');
    dbPath = path.join(ccCraftKitDir, 'cc-craft-kit.db');

    await fs.mkdir(specsDir, { recursive: true });

    // 作業ディレクトリを変更
    process.chdir(testDir);

    // データベース接続をクローズ（既存のインスタンスがあれば）
    await closeDatabase();

    // テーブル作成
    const db = getDatabase({ databasePath: dbPath });
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
  });

  afterAll(async () => {
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

  it('10 回連続で作成・削除しても不整合が発生しない', async () => {
    const db = getDatabase({ databasePath: dbPath });
    const iterations = 10;
    const createdIds: string[] = [];

    // 10 回連続で作成
    for (let i = 0; i < iterations; i++) {
      const id = randomUUID();
      const now = new Date().toISOString();
      const name = `テスト仕様書 ${i + 1}`;

      await db
        .insertInto('specs')
        .values({
          id,
          name,
          description: `E2E テスト用の仕様書 ${i + 1}`,
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

E2E テスト用の仕様書 ${i + 1}
`;

      await fs.writeFile(specPath, content, 'utf-8');
      createdIds.push(id);

      // 整合性チェック（作成後）
      const createCheck = await checkDatabaseIntegrity(db, specsDir);
      expect(createCheck.isValid).toBe(true);
      expect(createCheck.details.missingFiles).toHaveLength(0);
      expect(createCheck.details.missingDbRecords).toHaveLength(0);
    }

    // 中間整合性チェック
    const midCheck = await checkDatabaseIntegrity(db, specsDir);
    expect(midCheck.isValid).toBe(true);
    expect(midCheck.stats.totalDbRecords).toBe(iterations);
    expect(midCheck.stats.totalFiles).toBe(iterations);

    // 10 回連続で削除
    for (let i = 0; i < iterations; i++) {
      const specId = createdIds[i];

      // DB レコード削除
      await db.deleteFrom('specs').where('id', '=', specId).execute();

      // ファイル削除
      const specPath = path.join(specsDir, `${specId}.md`);
      await fs.unlink(specPath);

      // 整合性チェック（削除後）
      const deleteCheck = await checkDatabaseIntegrity(db, specsDir);
      expect(deleteCheck.isValid).toBe(true);
      expect(deleteCheck.details.missingFiles).toHaveLength(0);
      expect(deleteCheck.details.missingDbRecords).toHaveLength(0);
    }

    // 最終整合性チェック
    const finalCheck = await checkDatabaseIntegrity(db, specsDir);
    expect(finalCheck.isValid).toBe(true);
    expect(finalCheck.stats.totalDbRecords).toBe(0);
    expect(finalCheck.stats.totalFiles).toBe(0);
    expect(finalCheck.details.missingFiles).toHaveLength(0);
    expect(finalCheck.details.missingDbRecords).toHaveLength(0);
  }, 30000); // タイムアウト: 30 秒
});
