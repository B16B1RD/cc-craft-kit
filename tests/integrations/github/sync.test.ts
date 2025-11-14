/**
 * GitHub 同期サービステスト
 */
import { createTestDatabase, cleanupTestDatabase } from '../../helpers/test-database.js';
import { Kysely } from 'kysely';
import { Database } from '../../../src/core/database/schema.js';
import { randomUUID } from 'crypto';

describe('GitHubSyncService', () => {
  let db: Kysely<Database>;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
  });

  test('仕様書とGitHub Issueの紐付けが記録される', async () => {
    const specId = randomUUID();
    const issueNumber = 123;

    // 仕様書作成
    await db
      .insertInto('specs')
      .values({
        id: specId,
        name: 'テスト仕様',
        description: 'GitHub同期テスト',
        phase: 'requirements',
        github_issue_id: issueNumber,
        github_project_id: null,
        github_milestone_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // 仕様書取得して確認
    const spec = await db.selectFrom('specs').where('id', '=', specId).selectAll().executeTakeFirst();

    expect(spec).toBeDefined();
    expect(spec?.github_issue_id).toBe(issueNumber);
  });

  test('同期ログが記録される', async () => {
    const specId = randomUUID();

    // 仕様書作成
    await db
      .insertInto('specs')
      .values({
        id: specId,
        name: 'ログテスト仕様',
        description: null,
        phase: 'requirements',
        github_issue_id: 456,
        github_project_id: null,
        github_milestone_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // 同期ログ記録
    await db
      .insertInto('github_sync')
      .values({
        spec_id: specId,
        github_issue_id: 456,
        synced_at: new Date().toISOString(),
        sync_direction: 'to_github',
        status: 'success',
        error_message: null,
        metadata: JSON.stringify({ test: true }),
      })
      .execute();

    // ログ取得
    const logs = await db
      .selectFrom('github_sync')
      .where('spec_id', '=', specId)
      .selectAll()
      .execute();

    expect(logs).toHaveLength(1);
    expect(logs[0].sync_direction).toBe('to_github');
    expect(logs[0].status).toBe('success');
  });

  test('双方向同期のログが記録される', async () => {
    const specId = randomUUID();

    // 仕様書作成
    await db
      .insertInto('specs')
      .values({
        id: specId,
        name: '双方向同期テスト',
        description: null,
        phase: 'requirements',
        github_issue_id: 789,
        github_project_id: null,
        github_milestone_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // to_github 同期
    await db
      .insertInto('github_sync')
      .values({
        spec_id: specId,
        github_issue_id: 789,
        synced_at: new Date().toISOString(),
        sync_direction: 'to_github',
        status: 'success',
        error_message: null,
        metadata: null,
      })
      .execute();

    // from_github 同期
    await db
      .insertInto('github_sync')
      .values({
        spec_id: specId,
        github_issue_id: 789,
        synced_at: new Date().toISOString(),
        sync_direction: 'from_github',
        status: 'success',
        error_message: null,
        metadata: null,
      })
      .execute();

    // 両方向のログ確認
    const toGitHub = await db
      .selectFrom('github_sync')
      .where('spec_id', '=', specId)
      .where('sync_direction', '=', 'to_github')
      .selectAll()
      .execute();

    const fromGitHub = await db
      .selectFrom('github_sync')
      .where('spec_id', '=', specId)
      .where('sync_direction', '=', 'from_github')
      .selectAll()
      .execute();

    expect(toGitHub).toHaveLength(1);
    expect(fromGitHub).toHaveLength(1);
  });
});
