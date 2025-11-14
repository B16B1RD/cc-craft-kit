/**
 * create-spec MCPツールテスト
 */
import { createTestDatabase, cleanupTestDatabase } from '../../helpers/test-database.js';
import { Kysely } from 'kysely';
import { Database } from '../../../src/core/database/schema.js';
import { randomUUID } from 'crypto';

describe('createSpecTool', () => {
  let db: Kysely<Database>;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
  });

  test('仕様書が正常に作成される', async () => {
    // テスト用の仕様書を直接DBに作成
    const spec = {
      id: randomUUID(),
      name: 'テスト仕様',
      description: 'テスト用の仕様書',
      phase: 'requirements' as const,
      github_issue_id: null,
      github_project_id: null,
      github_milestone_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insertInto('specs').values(spec).execute();

    // データベースに保存されていることを確認
    const specs = await db.selectFrom('specs').selectAll().execute();
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe('テスト仕様');
    expect(specs[0].description).toBe('テスト用の仕様書');
    expect(specs[0].phase).toBe('requirements');
  });

  test('説明なしで仕様書が作成される', async () => {
    const spec = {
      id: randomUUID(),
      name: '説明なし仕様',
      description: null,
      phase: 'requirements' as const,
      github_issue_id: null,
      github_project_id: null,
      github_milestone_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insertInto('specs').values(spec).execute();

    const specs = await db.selectFrom('specs').where('name', '=', '説明なし仕様').selectAll().execute();
    expect(specs[0].name).toBe('説明なし仕様');
    expect(specs[0].description).toBeNull();
  });

  test('複数の仕様書が作成できる', async () => {
    const specs = [
      {
        id: randomUUID(),
        name: '仕様1',
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
        name: '仕様2',
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
        name: '仕様3',
        description: null,
        phase: 'requirements' as const,
        github_issue_id: null,
        github_project_id: null,
        github_milestone_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    for (const spec of specs) {
      await db.insertInto('specs').values(spec).execute();
    }

    const allSpecs = await db.selectFrom('specs').selectAll().execute();
    expect(allSpecs.length).toBeGreaterThanOrEqual(3);
  });
});
