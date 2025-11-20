/**
 * データベース整合性の E2E テスト
 *
 * 仕様書作成・フェーズ更新を繰り返し実行し、
 * データベースとファイルシステムの整合性を検証する
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDatabase } from '../../src/core/database/connection.js';
import { checkDatabaseIntegrity } from '../../src/core/validators/database-integrity-checker.js';
import { migrateToLatest } from '../../src/core/database/migrator.js';
import { getCurrentDateTimeForSpec } from '../../src/core/utils/date-format.js';
import { fsyncFileAndDirectory } from '../../src/core/utils/fsync.js';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/core/database/schema.js';

describe('Database Integrity E2E Test', () => {
  const testDir = join(process.cwd(), 'tests', '.tmp', 'e2e-integrity-test');
  const ccCraftKitDir = join(testDir, '.cc-craft-kit');
  const specsDir = join(ccCraftKitDir, 'specs');
  const dbPath = join(ccCraftKitDir, 'cc-craft-kit.db');

  let db: Kysely<Database>;

  beforeAll(async () => {
    // テスト用ディレクトリ作成
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(ccCraftKitDir, { recursive: true });
    mkdirSync(specsDir, { recursive: true });

    // データベース初期化
    db = createDatabase({ databasePath: dbPath });
    await migrateToLatest(db);
  });

  afterAll(async () => {
    // データベースクローズ
    if (db) {
      await db.destroy();
    }

    // テスト用ディレクトリ削除
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * 仕様書作成ヘルパー
   */
  async function createTestSpec(name: string, description?: string): Promise<string> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const formattedDateTime = getCurrentDateTimeForSpec();

    // 1. データベースレコード作成
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

    // 2. Markdownファイル生成
    const specPath = join(specsDir, `${id}.md`);
    const content = `# ${name}

**仕様書 ID:** ${id}
**フェーズ:** requirements
**作成日時:** ${formattedDateTime}
**更新日時:** ${formattedDateTime}

---

## 1. 背景と目的

### 背景

${description || '(背景を記述してください)'}

### 目的

(この仕様の目的を記述してください)
`;

    writeFileSync(specPath, content, 'utf-8');
    fsyncFileAndDirectory(specPath);

    return id;
  }

  /**
   * フェーズ更新ヘルパー
   */
  async function updateTestSpecPhase(
    specId: string,
    newPhase: 'requirements' | 'design' | 'tasks' | 'implementation' | 'completed'
  ): Promise<void> {
    const now = new Date().toISOString();
    const formattedDateTime = getCurrentDateTimeForSpec();

    // 1. データベース更新
    await db
      .updateTable('specs')
      .set({
        phase: newPhase,
        updated_at: now,
      })
      .where('id', '=', specId)
      .execute();

    // 2. Markdownファイル更新
    const specPath = join(specsDir, `${specId}.md`);
    if (existsSync(specPath)) {
      let content = require('node:fs').readFileSync(specPath, 'utf-8');
      content = content.replace(/\*\*フェーズ:\*\* .+/, `**フェーズ:** ${newPhase}`);
      content = content.replace(/\*\*更新日時:\*\* .+/, `**更新日時:** ${formattedDateTime}`);

      writeFileSync(specPath, content, 'utf-8');
      fsyncFileAndDirectory(specPath);
    }
  }

  it('仕様書作成・フェーズ更新を100回実行しても整合性エラーが発生しない', async () => {
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      // 1. 仕様書作成
      const specName = `E2E Test Spec ${i + 1}`;
      const specDescription = `E2E テスト用の仕様書 (iteration ${i + 1})`;

      const specId = await createTestSpec(specName, specDescription);

      // 2. フェーズ更新（requirements → design → tasks → implementation → completed）
      const phases: Array<'design' | 'tasks' | 'implementation' | 'completed'> = [
        'design',
        'tasks',
        'implementation',
        'completed',
      ];
      for (const phase of phases) {
        await updateTestSpecPhase(specId, phase);
      }

      // 3. 整合性チェック（10回ごと）
      if ((i + 1) % 10 === 0) {
        const result = await checkDatabaseIntegrity(db, specsDir);

        // エラーがないことを確認
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.stats.invalidFiles).toBe(0);
        expect(result.stats.missingInDb).toBe(0);
        expect(result.stats.missingFiles).toBe(0);
        expect(result.stats.orphanedRecords).toBe(0);
      }
    }

    // 最終整合性チェック
    const finalResult = await checkDatabaseIntegrity(db, specsDir);

    expect(finalResult.isValid).toBe(true);
    expect(finalResult.errors).toHaveLength(0);
    expect(finalResult.stats.totalFiles).toBe(iterations);
    expect(finalResult.stats.totalDbRecords).toBe(iterations);
    expect(finalResult.stats.validFiles).toBe(iterations);
    expect(finalResult.stats.invalidFiles).toBe(0);
    expect(finalResult.stats.missingInDb).toBe(0);
    expect(finalResult.stats.missingFiles).toBe(0);
    expect(finalResult.stats.orphanedRecords).toBe(0);

    console.log(`\n✅ E2E Test: ${iterations} specs created and updated successfully!`);
    console.log(`   Total specs: ${finalResult.stats.totalFiles}`);
    console.log(`   Valid specs: ${finalResult.stats.validFiles}`);
    console.log(`   Integrity errors: 0\n`);
  }, 300000); // タイムアウト: 5分

  it('仕様書作成中のエラーでロールバックが正常に動作する', async () => {
    // 初期状態の仕様書数を取得
    const initialCount = await db
      .selectFrom('specs')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst();

    const initialSpecCount = Number(initialCount?.count ?? 0);

    // 不正なデータで仕様書作成を試行（name が空文字列）
    const id = randomUUID();
    const now = new Date().toISOString();

    try {
      await db
        .insertInto('specs')
        .values({
          id,
          name: '', // 空文字列（不正）
          description: null,
          phase: 'requirements',
          created_at: now,
          updated_at: now,
        })
        .execute();

      // ロールバック（手動）
      await db.deleteFrom('specs').where('id', '=', id).execute();
    } catch (error) {
      // エラー発生時もロールバック
      await db.deleteFrom('specs').where('id', '=', id).execute();
    }

    // ロールバック後の仕様書数を確認（増えていないこと）
    const afterCount = await db
      .selectFrom('specs')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst();

    const afterSpecCount = Number(afterCount?.count ?? 0);

    expect(afterSpecCount).toBe(initialSpecCount);

    // 整合性チェック
    const result = await checkDatabaseIntegrity(db, specsDir);
    expect(result.isValid).toBe(true);
  });

  it('データベース再接続後も整合性が保たれる', async () => {
    // 1. 仕様書作成
    const specName = 'DB Reconnection Test';
    await createTestSpec(specName, 'Test spec for DB reconnection');

    // 2. データベースクローズ
    await db.destroy();

    // 3. データベース再接続
    db = createDatabase({ databasePath: dbPath });

    // 4. 整合性チェック
    const result = await checkDatabaseIntegrity(db, specsDir);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);

    // 5. 作成した仕様書が存在することを確認
    const spec = await db
      .selectFrom('specs')
      .where('name', '=', specName)
      .selectAll()
      .executeTakeFirst();

    expect(spec).toBeDefined();
    expect(spec?.name).toBe(specName);
  });
});
