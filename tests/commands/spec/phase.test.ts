/**
 * /cft:spec-phase 自動リカバリー機能 統合テスト
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { updateSpecPhase } from '../../../src/commands/spec/phase.js';

// モジュールモック
vi.mock('../../../src/integrations/github/client.js');
vi.mock('../../../src/integrations/github/issues.js');
vi.mock('../../../src/integrations/github/projects.js');
vi.mock('../../../src/integrations/github/sync.js');
vi.mock('../../../src/integrations/github/project-resolver.js');

describe('/cft:spec-phase 自動リカバリー機能', () => {
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
    vi.clearAllMocks();
  });

  describe('フェーズ更新時の自動リカバリー', () => {
    test('Issue 未作成の仕様書に対してフェーズ変更を実行しても、エラーにならない', async () => {
      const specId = randomUUID();
      delete process.env.GITHUB_TOKEN;

      // 仕様書作成（Issue 未紐付け）
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: 'フェーズ変更テスト',
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // フェーズ変更実行（エラーにならないことを確認）
      await expect(
        updateSpecPhase(specId.substring(0, 8), 'design', { color: false })
      ).resolves.not.toThrow();

      // フェーズが正常に更新されていることを確認
      const updatedSpec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirstOrThrow();

      expect(updatedSpec.phase).toBe('design');
    });

    test('GitHub Token 未設定の場合、自動リカバリーはスキップされる', async () => {
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
          github_issue_id: null,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // フェーズ変更実行
      await updateSpecPhase(specId.substring(0, 8), 'design', { color: false });

      // github_sync レコードが作成されていないことを確認
      const sync = await lifecycle.db
        .selectFrom('github_sync')
        .where('entity_id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(sync).toBeUndefined();
    });
  });

  describe('Issue 既存の場合', () => {
    test('Issue が既に存在する場合、自動リカバリーはスキップされる', async () => {
      const specId = randomUUID();
      process.env.GITHUB_TOKEN = 'ghp_test_token';

      // 仕様書作成（Issue 既紐付け）
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: 'Issue 存在テスト',
          phase: 'requirements',
          github_issue_id: 123,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成
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

      // フェーズ変更実行
      await updateSpecPhase(specId.substring(0, 8), 'design', { color: false });

      // フェーズが正常に更新されていることを確認
      const updatedSpec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirstOrThrow();

      expect(updatedSpec.phase).toBe('design');
    });
  });
});
