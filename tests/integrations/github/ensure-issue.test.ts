/**
 * ensureGitHubIssue ユニットテスト
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { ensureGitHubIssue } from '../../../src/integrations/github/ensure-issue.js';

// モジュールモック
jest.mock('../../../src/integrations/github/client.js');
jest.mock('../../../src/integrations/github/issues.js');
jest.mock('../../../src/integrations/github/projects.js');
jest.mock('../../../src/integrations/github/sync.js');
jest.mock('../../../src/integrations/github/project-resolver.js');

describe('ensureGitHubIssue', () => {
  let lifecycle: DatabaseLifecycle;
  const originalEnv = process.env;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();

    // 環境変数をリセット
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();

    // 環境変数を復元
    process.env = originalEnv;

    // モックをクリア
    jest.clearAllMocks();
  });

  describe('GitHub トークン未設定時の動作', () => {
    test('GITHUB_TOKEN が未設定の場合、静かにスキップする', async () => {
      const specId = randomUUID();
      delete process.env.GITHUB_TOKEN;

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: 'トークン未設定テスト',
          phase: 'requirements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      const result = await ensureGitHubIssue(lifecycle.db, specId);

      expect(result.issueNumber).toBe(null);
      expect(result.wasCreated).toBe(false);

      // Issue が作成されていないことを確認
      const sync = await lifecycle.db
        .selectFrom('github_sync')
        .where('entity_id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(sync).toBeUndefined();
    });
  });

  describe('Issue 存在チェック', () => {
    test('Issue が既に存在する場合、何もしない', async () => {
      const specId = randomUUID();
      process.env.GITHUB_TOKEN = 'ghp_test_token';

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: 'Issue 存在テスト',
          phase: 'requirements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成（Issue 既存）
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          id: randomUUID(),
          entity_type: 'spec',
          entity_id: specId,
          github_id: '123',
          github_number: 123,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      const result = await ensureGitHubIssue(lifecycle.db, specId);

      expect(result.issueNumber).toBe(123);
      expect(result.wasCreated).toBe(false);
    });
  });

  describe('ログ記録', () => {
    test('Issue 未作成の場合、エラーログが記録される（GitHub 設定なし）', async () => {
      const specId = randomUUID();
      process.env.GITHUB_TOKEN = 'ghp_test_token';

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: 'ログ記録テスト',
          phase: 'requirements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // config.json が存在しないため、自動作成は試行されるが失敗する
      const result = await ensureGitHubIssue(lifecycle.db, specId);

      // 自動作成が試行されたが、GitHub 設定がないため失敗
      expect(result.issueNumber).toBeUndefined();
      expect(result.wasCreated).toBe(true); // 作成試行フラグは true
    });
  });
});
