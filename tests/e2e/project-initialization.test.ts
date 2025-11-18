/**
 * E2Eテスト: プロジェクト初期化フロー
 */
import { initProjectTool } from '../../src/mcp/tools/init-project.js';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/test-database.js';
import { Kysely } from 'kysely';
import { Database } from '../../src/core/database/schema.js';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

describe('E2E: プロジェクト初期化フロー', () => {
  let db: Kysely<Database>;
  const testProjectDir = path.join(process.cwd(), '.cc-craft-kit');

  beforeAll(async () => {
    // .cc-craft-kitディレクトリを事前に作成
    await fs.mkdir(testProjectDir, { recursive: true });
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      // ignore
    }
  });

  test('完全なプロジェクト初期化フロー', async () => {
    // Step 1: プロジェクト初期化
    const initResult = await initProjectTool.handler({
      projectName: 'e2e-test-project',
      description: 'E2Eテスト用プロジェクト',
      githubRepo: 'test/e2e-project',
    });

    expect(initResult.success).toBe(true);
    expect(initResult.config.name).toBe('e2e-test-project');

    // ディレクトリ構造が作成されていることを確認
    const specsDir = path.join(testProjectDir, 'specs');
    const specsDirExists = await fs
      .access(specsDir)
      .then(() => true)
      .catch(() => false);
    expect(specsDirExists).toBe(true);

    // Step 2: 初期状態では仕様書が0件
    const initialSpecs = await db.selectFrom('specs').selectAll().execute();
    expect(initialSpecs).toHaveLength(0);

    // Step 3: 最初の仕様書作成
    const spec1 = {
      id: randomUUID(),
      name: 'ユーザー認証機能',
      description: 'メール/パスワード認証',
      phase: 'requirements' as const,
      github_issue_id: null,
      github_project_id: null,
      github_milestone_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.insertInto('specs').values(spec1).execute();

    // Step 4: 2つ目の仕様書作成
    const spec2 = {
      id: randomUUID(),
      name: 'プロフィール管理',
      description: 'ユーザープロフィールCRUD',
      phase: 'requirements' as const,
      github_issue_id: null,
      github_project_id: null,
      github_milestone_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.insertInto('specs').values(spec2).execute();

    // Step 5: 仕様書一覧取得
    const allSpecs = await db.selectFrom('specs').selectAll().execute();
    expect(allSpecs).toHaveLength(2);

    // 作成した仕様書が含まれていることを確認
    const specNames = allSpecs.map((s) => s.name);
    expect(specNames).toContain('ユーザー認証機能');
    expect(specNames).toContain('プロフィール管理');

    // Step 6: フェーズでフィルタリング
    const requirementsOnly = await db
      .selectFrom('specs')
      .where('phase', '=', 'requirements')
      .selectAll()
      .execute();
    expect(requirementsOnly).toHaveLength(2);
    expect(requirementsOnly.every((s) => s.phase === 'requirements')).toBe(true);
  });

  test('複数プロジェクトの並行初期化', async () => {
    // 同時に複数の仕様書を作成
    const specs = [
      {
        id: randomUUID(),
        name: '機能A',
        description: null,
        phase: 'requirements' as const,
        github_issue_id: null,
        github_project_id: null,
        github_milestone_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        name: '機能B',
        description: null,
        phase: 'requirements' as const,
        github_issue_id: null,
        github_project_id: null,
        github_milestone_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        name: '機能C',
        description: null,
        phase: 'requirements' as const,
        github_issue_id: null,
        github_project_id: null,
        github_milestone_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    await Promise.all(specs.map((spec) => db.insertInto('specs').values(spec).execute()));

    const allSpecs = await db.selectFrom('specs').selectAll().execute();
    expect(allSpecs.length).toBeGreaterThanOrEqual(3);
  });
});
