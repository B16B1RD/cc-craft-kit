/**
 * E2E テスト: ブランチ切り替えシナリオ
 *
 * ブランチを切り替えた際に、適切な仕様書のみが表示されることを確認します。
 */

// E2E テストであることを示すフラグ（グローバルセットアップをスキップ）
process.env.E2E_TEST = 'true';

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import { getDatabase, closeDatabase } from '../../src/core/database/connection.js';
import { getSpecsWithGitHubInfo } from '../../src/core/database/helpers.js';
import { randomUUID } from 'crypto';

describe('E2E: ブランチ切り替えシナリオ', () => {
  let testDir: string;
  let specsDir: string;
  let dbPath: string;
  const originalCwd = process.cwd();

  beforeAll(async () => {
    // データベース接続をクローズ（既存のインスタンスがあれば）
    await closeDatabase();

    // 一時ディレクトリを作成
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'cc-craft-kit-e2e-branch-'));
    const ccCraftKitDir = path.join(testDir, '.cc-craft-kit');
    specsDir = path.join(ccCraftKitDir, 'specs');
    dbPath = path.join(ccCraftKitDir, 'cc-craft-kit.db');

    await fs.mkdir(specsDir, { recursive: true });

    // 作業ディレクトリを変更
    process.chdir(testDir);

    // テーブル作成
    const db = getDatabase({ databasePath: dbPath });
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

    await db.schema
      .createTable('github_sync')
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('entity_type', 'text', (col) => col.notNull())
      .addColumn('entity_id', 'text', (col) => col.notNull())
      .addColumn('github_id', 'integer')
      .addColumn('github_number', 'integer')
      .addColumn('github_node_id', 'text')
      .addColumn('sync_status', 'text', (col) => col.notNull())
      .addColumn('last_synced_at', 'text')
      .addColumn('created_at', 'text', (col) => col.notNull())
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .addColumn('pr_number', 'integer')
      .addColumn('pr_url', 'text')
      .addColumn('pr_merged_at', 'text')
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

  test('各ブランチで作成された仕様書が正しくフィルタリングされる', async () => {
    const db = getDatabase({ databasePath: dbPath });
    const now = new Date().toISOString();

    // 1. main ブランチで仕様書を作成
    const mainSpecId = randomUUID();
    await db
      .insertInto('specs')
      .values({
        id: mainSpecId,
        name: 'Main branch spec',
        description: 'Spec created on main',
        phase: 'requirements',
        branch_name: 'main',
        created_at: now,
        updated_at: now,
      })
      .execute();

    // 2. develop ブランチで仕様書を作成
    const developSpecId = randomUUID();
    await db
      .insertInto('specs')
      .values({
        id: developSpecId,
        name: 'Develop branch spec',
        description: 'Spec created on develop',
        phase: 'requirements',
        branch_name: 'develop',
        created_at: now,
        updated_at: now,
      })
      .execute();

    // 3. feature/test-1 ブランチで仕様書を作成
    const feature1SpecId = randomUUID();
    await db
      .insertInto('specs')
      .values({
        id: feature1SpecId,
        name: 'Feature 1 spec',
        description: 'Spec created on feature/test-1',
        phase: 'requirements',
        branch_name: 'feature/test-1',
        created_at: now,
        updated_at: now,
      })
      .execute();

    // 4. feature/test-2 ブランチで仕様書を作成
    const feature2SpecId = randomUUID();
    await db
      .insertInto('specs')
      .values({
        id: feature2SpecId,
        name: 'Feature 2 spec',
        description: 'Spec created on feature/test-2',
        phase: 'requirements',
        branch_name: 'feature/test-2',
        created_at: now,
        updated_at: now,
      })
      .execute();

    // シナリオ 1: main ブランチでは main と develop のみ表示
    const mainSpecs = await getSpecsWithGitHubInfo(db, { branchName: 'main' });
    expect(mainSpecs).toHaveLength(2);
    const mainBranches = mainSpecs.map((s) => s.branch_name).sort();
    expect(mainBranches).toEqual(['develop', 'main']);

    // シナリオ 2: develop ブランチでは main と develop のみ表示
    const developSpecs = await getSpecsWithGitHubInfo(db, { branchName: 'develop' });
    expect(developSpecs).toHaveLength(2);
    const developBranches = developSpecs.map((s) => s.branch_name).sort();
    expect(developBranches).toEqual(['develop', 'main']);

    // シナリオ 3: feature/test-1 では main, develop, feature/test-1 のみ表示
    const feature1Specs = await getSpecsWithGitHubInfo(db, { branchName: 'feature/test-1' });
    expect(feature1Specs).toHaveLength(3);
    const feature1Branches = feature1Specs.map((s) => s.branch_name).sort();
    expect(feature1Branches).toEqual(['develop', 'feature/test-1', 'main']);

    // シナリオ 4: feature/test-2 では main, develop, feature/test-2 のみ表示
    const feature2Specs = await getSpecsWithGitHubInfo(db, { branchName: 'feature/test-2' });
    expect(feature2Specs).toHaveLength(3);
    const feature2Branches = feature2Specs.map((s) => s.branch_name).sort();
    expect(feature2Branches).toEqual(['develop', 'feature/test-2', 'main']);

    // シナリオ 5: 存在しないブランチでは main と develop のみ表示
    const nonExistentSpecs = await getSpecsWithGitHubInfo(db, {
      branchName: 'feature/non-existent',
    });
    expect(nonExistentSpecs).toHaveLength(2);
    const nonExistentBranches = nonExistentSpecs.map((s) => s.branch_name).sort();
    expect(nonExistentBranches).toEqual(['develop', 'main']);
  });

  test('ブランチフィルタリングとフェーズフィルタリングの併用', async () => {
    const db = getDatabase({ databasePath: dbPath });
    const now = new Date().toISOString();

    // このテスト用の一意な名前を使用
    const uniqueMainReqId = randomUUID();
    const uniqueMainDesignId = randomUUID();
    const uniqueFeatureReqId = randomUUID();

    // main ブランチに requirements と design を作成
    await db
      .insertInto('specs')
      .values({
        id: uniqueMainReqId,
        name: 'Test2 Main requirements',
        description: 'Requirements on main for test2',
        phase: 'requirements',
        branch_name: 'main',
        created_at: now,
        updated_at: now,
      })
      .execute();

    await db
      .insertInto('specs')
      .values({
        id: uniqueMainDesignId,
        name: 'Test2 Main design',
        description: 'Design on main for test2',
        phase: 'design',
        branch_name: 'main',
        created_at: now,
        updated_at: now,
      })
      .execute();

    // feature/test-unique ブランチに requirements を作成
    await db
      .insertInto('specs')
      .values({
        id: uniqueFeatureReqId,
        name: 'Test2 Feature requirements',
        description: 'Requirements on feature for test2',
        phase: 'requirements',
        branch_name: 'feature/test-unique',
        created_at: now,
        updated_at: now,
      })
      .execute();

    // feature/test-unique ブランチで requirements フィルタリング
    const filteredSpecs = await getSpecsWithGitHubInfo(db, {
      branchName: 'feature/test-unique',
      phase: 'requirements',
    });

    // このテストで作成した main の requirements と feature/test-unique の requirements が含まれることを確認
    const hasMainReq = filteredSpecs.some((s) => s.id === uniqueMainReqId);
    const hasFeatureReq = filteredSpecs.some((s) => s.id === uniqueFeatureReqId);
    const hasMainDesign = filteredSpecs.some((s) => s.id === uniqueMainDesignId);

    expect(hasMainReq).toBe(true);
    expect(hasFeatureReq).toBe(true);
    expect(hasMainDesign).toBe(false); // design は含まれない

    // すべて requirements フェーズであることを確認
    filteredSpecs.forEach((spec) => {
      expect(spec.phase).toBe('requirements');
    });
  });

  test('ブランチ間の仕様書が分離されている', async () => {
    const db = getDatabase({ databasePath: dbPath });
    const now = new Date().toISOString();

    // feature/branch-a で仕様書作成
    const branchASpecId = randomUUID();
    await db
      .insertInto('specs')
      .values({
        id: branchASpecId,
        name: 'Branch A spec',
        description: 'Spec on branch A',
        phase: 'requirements',
        branch_name: 'feature/branch-a',
        created_at: now,
        updated_at: now,
      })
      .execute();

    // feature/branch-b で仕様書作成
    const branchBSpecId = randomUUID();
    await db
      .insertInto('specs')
      .values({
        id: branchBSpecId,
        name: 'Branch B spec',
        description: 'Spec on branch B',
        phase: 'requirements',
        branch_name: 'feature/branch-b',
        created_at: now,
        updated_at: now,
      })
      .execute();

    // branch-a では branch-b の仕様書が見えない
    const branchASpecs = await getSpecsWithGitHubInfo(db, {
      branchName: 'feature/branch-a',
    });
    const hasBranchBSpec = branchASpecs.some((s) => s.id === branchBSpecId);
    expect(hasBranchBSpec).toBe(false);

    // branch-b では branch-a の仕様書が見えない
    const branchBSpecs = await getSpecsWithGitHubInfo(db, {
      branchName: 'feature/branch-b',
    });
    const hasBranchASpec = branchBSpecs.some((s) => s.id === branchASpecId);
    expect(hasBranchASpec).toBe(false);
  });

  test('main と develop は常にすべてのブランチから参照可能', async () => {
    const db = getDatabase({ databasePath: dbPath });
    const now = new Date().toISOString();

    // main で仕様書作成
    const mainSpecId = randomUUID();
    await db
      .insertInto('specs')
      .values({
        id: mainSpecId,
        name: 'Main spec for all branches',
        description: 'Visible from all branches',
        phase: 'requirements',
        branch_name: 'main',
        created_at: now,
        updated_at: now,
      })
      .execute();

    // develop で仕様書作成
    const developSpecId = randomUUID();
    await db
      .insertInto('specs')
      .values({
        id: developSpecId,
        name: 'Develop spec for all branches',
        description: 'Visible from all branches',
        phase: 'requirements',
        branch_name: 'develop',
        created_at: now,
        updated_at: now,
      })
      .execute();

    // 複数のブランチから main と develop の仕様書が見えることを確認
    const branches = ['feature/test-1', 'feature/test-2', 'feature/test-3'];

    for (const branch of branches) {
      const specs = await getSpecsWithGitHubInfo(db, { branchName: branch });
      const hasMainSpec = specs.some((s) => s.id === mainSpecId);
      const hasDevelopSpec = specs.some((s) => s.id === developSpecId);

      expect(hasMainSpec).toBe(true);
      expect(hasDevelopSpec).toBe(true);
    }
  });

  test('ブランチフィルタリングなしではすべての仕様書が表示される', async () => {
    const db = getDatabase({ databasePath: dbPath });
    const now = new Date().toISOString();

    // 複数のブランチで仕様書作成
    const branches = ['main', 'develop', 'feature/a', 'feature/b', 'feature/c'];
    const createdIds: string[] = [];

    for (const branch of branches) {
      const id = randomUUID();
      await db
        .insertInto('specs')
        .values({
          id,
          name: `Spec on ${branch}`,
          description: `Test spec on ${branch}`,
          phase: 'requirements',
          branch_name: branch,
          created_at: now,
          updated_at: now,
        })
        .execute();
      createdIds.push(id);
    }

    // ブランチフィルタリングなしで取得
    const allSpecs = await getSpecsWithGitHubInfo(db);

    // すべての仕様書が表示されることを確認
    expect(allSpecs.length).toBeGreaterThanOrEqual(branches.length);

    // 作成したすべての仕様書が含まれることを確認
    for (const id of createdIds) {
      const hasSpec = allSpecs.some((s) => s.id === id);
      expect(hasSpec).toBe(true);
    }
  });
});
