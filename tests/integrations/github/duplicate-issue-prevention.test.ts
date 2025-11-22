/**
 * GitHub Issue 重複作成防止機能のユニットテスト
 *
 * 仕様書: .cc-craft-kit/specs/2507c382-628a-4fa9-bfad-41e1951d9292.md
 *
 * テストケース:
 * 1. 既存 Issue がない場合、新規作成される
 * 2. 既存 Issue がある場合、DUPLICATE_ISSUE エラーが throw される
 * 3. sync_status=failed のレコードは無視され、再作成が許可される
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { GitHubSyncService } from '../../../src/integrations/github/sync.js';
import { GitHubIssues } from '../../../src/integrations/github/issues.js';
import { GitHubProjects } from '../../../src/integrations/github/projects.js';
import { GitHubClient } from '../../../src/integrations/github/client.js';

// モジュールモック
jest.mock('../../../src/integrations/github/client.js');
jest.mock('../../../src/integrations/github/issues.js');
jest.mock('../../../src/integrations/github/projects.js');

describe('GitHub Issue 重複作成防止', () => {
  let lifecycle: DatabaseLifecycle;
  let syncService: GitHubSyncService;
  let mockIssues: jest.Mocked<GitHubIssues>;
  let mockProjects: jest.Mocked<GitHubProjects>;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();

    // モックを作成
    const mockClient = new GitHubClient({ token: 'test-token' }) as jest.Mocked<GitHubClient>;
    mockIssues = new GitHubIssues(mockClient) as jest.Mocked<GitHubIssues>;
    mockProjects = new GitHubProjects(mockClient) as jest.Mocked<GitHubProjects>;

    // GitHubSyncService のインスタンス作成
    syncService = new GitHubSyncService(lifecycle.db, mockIssues, mockProjects);
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
    jest.clearAllMocks();
  });

  describe('テストケース1: 既存 Issue がない場合、新規作成される', () => {
    test('github_sync テーブルにレコードがない場合、Issue が作成される', async () => {
      const specId = randomUUID();
      const owner = 'testowner';
      const repo = 'testrepo';

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様書',
          description: '重複防止テスト',
          phase: 'requirements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // Issue 作成APIのモック
      mockIssues.create = jest.fn().mockResolvedValue({
        number: 1,
        id: 123456,
        node_id: 'node_123',
        html_url: `https://github.com/${owner}/${repo}/issues/1`,
        title: '[requirements] テスト仕様書',
        body: '仕様書本文',
        state: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Issue 作成実行
      const issueNumber = await syncService.syncSpecToIssue({
        specId,
        owner,
        repo,
        createIfNotExists: true,
      });

      // Issue が作成されたことを確認
      expect(issueNumber).toBe(1);
      expect(mockIssues.create).toHaveBeenCalledTimes(1);

      // github_sync テーブルにレコードが作成されたことを確認
      const syncRecord = await lifecycle.db
        .selectFrom('github_sync')
        .where('entity_type', '=', 'spec')
        .where('entity_id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(syncRecord).toBeDefined();
      expect(syncRecord?.github_number).toBe(1);
      expect(syncRecord?.sync_status).toBe('success');
    });
  });

  describe('テストケース2: 既存 Issue がある場合、エラーが throw される', () => {
    test('github_sync テーブルに sync_status=success のレコードがある場合、エラー', async () => {
      const specId = randomUUID();
      const owner = 'testowner';
      const repo = 'testrepo';

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様書',
          description: '重複防止テスト',
          phase: 'requirements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 既存の github_sync レコードを作成（sync_status=success）
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          id: randomUUID(),
          entity_type: 'spec',
          entity_id: specId,
          github_id: '1',
          github_number: 1,
          github_node_id: 'node_123',
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // Issue 作成を試行 → エラーが throw されることを確認
      await expect(
        syncService.syncSpecToIssue({
          specId,
          owner,
          repo,
          createIfNotExists: true,
        })
      ).rejects.toThrow('この仕様書には既に GitHub Issue が作成されています');

      // Issue 作成 API が呼び出されていないことを確認
      expect(mockIssues.create).not.toHaveBeenCalled();
    });
  });

  describe('テストケース3: sync_status=failed のレコードは無視され、再作成が許可される', () => {
    test('github_sync テーブルに sync_status=failed のレコードがある場合、再作成される', async () => {
      const specId = randomUUID();
      const owner = 'testowner';
      const repo = 'testrepo';

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様書',
          description: '重複防止テスト',
          phase: 'requirements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 失敗した github_sync レコードを作成（sync_status=failed）
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          id: randomUUID(),
          entity_type: 'spec',
          entity_id: specId,
          github_id: '',
          github_number: null,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'failed',
          error_message: 'Network error',
        })
        .execute();

      // Issue 作成APIのモック
      mockIssues.create = jest.fn().mockResolvedValue({
        number: 2,
        id: 123457,
        node_id: 'node_124',
        html_url: `https://github.com/${owner}/${repo}/issues/2`,
        title: '[requirements] テスト仕様書',
        body: '仕様書本文',
        state: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Issue 作成実行 → エラーが throw されないことを確認
      const issueNumber = await syncService.syncSpecToIssue({
        specId,
        owner,
        repo,
        createIfNotExists: true,
      });

      // Issue が作成されたことを確認
      expect(issueNumber).toBe(2);
      expect(mockIssues.create).toHaveBeenCalledTimes(1);

      // github_sync テーブルのレコードが更新されたことを確認
      const syncRecords = await lifecycle.db
        .selectFrom('github_sync')
        .where('entity_type', '=', 'spec')
        .where('entity_id', '=', specId)
        .selectAll()
        .execute();

      // recordSyncLog は既存レコードを更新するため、レコード数は 1 のまま
      expect(syncRecords).toHaveLength(1);
      const successRecord = syncRecords[0];
      expect(successRecord.sync_status).toBe('success');
      expect(successRecord.github_number).toBe(2);
      expect(successRecord.error_message).toBeNull();
    });
  });

  describe('パフォーマンステスト', () => {
    test('重複チェッククエリが 100ms 以内に完了する', async () => {
      const specId = randomUUID();
      const owner = 'testowner';
      const repo = 'testrepo';

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様書',
          description: 'パフォーマンステスト',
          phase: 'requirements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 既存の github_sync レコードを作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          id: randomUUID(),
          entity_type: 'spec',
          entity_id: specId,
          github_id: '1',
          github_number: 1,
          github_node_id: 'node_123',
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // 実行時間を測定
      const start = Date.now();
      try {
        await syncService.syncSpecToIssue({
          specId,
          owner,
          repo,
          createIfNotExists: true,
        });
      } catch (error) {
        // 重複エラーは無視
      }
      const elapsed = Date.now() - start;

      // 100ms 以内に完了することを確認
      expect(elapsed).toBeLessThan(100);
    });
  });
});
