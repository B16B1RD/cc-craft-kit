/**
 * GitHub プルリクエスト統合機能のテスト
 *
 * 注意: PR 自動作成処理は、プロンプトベース実装（spec-phase.md）に移行されました。
 * このファイルには、PR URL を GitHub Issue に記録する機能のテストのみが残されています。
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { recordPullRequestToIssue } from '../../../src/integrations/github/pull-request.js';
import { createTestDatabase, cleanupTestDatabase } from '../../helpers/test-database.js';
import type { Kysely } from 'kysely';
import type { Database } from '../../../src/core/database/schema.js';
import { createMockGitHubClient, createMockOctokitResponse } from '../../helpers/index.js';

// GitHub クライアントのモック
jest.mock('../../../src/integrations/github/client.js', () => ({
  getGitHubClient: jest.fn(),
}));

// Git コマンドのモック
jest.mock('node:child_process', () => ({
  execSync: jest.fn(),
  spawnSync: jest.fn(),
}));

import { getGitHubClient } from '../../../src/integrations/github/client.js';
import { execSync } from 'node:child_process';

describe('pull-request', () => {
  let db: Kysely<Database>;
  let mockClient: ReturnType<typeof createMockGitHubClient>;

  beforeEach(async () => {
    db = await createTestDatabase();
    mockClient = createMockGitHubClient();
    (getGitHubClient as jest.MockedFunction<typeof getGitHubClient>).mockReturnValue(mockClient);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
    jest.clearAllMocks();
  });

  describe('recordPullRequestToIssue', () => {
    beforeEach(async () => {
      // テスト用の仕様書を作成
      await db
        .insertInto('specs')
        .values({
          id: 'test-spec-id',
          name: 'テスト仕様書',
          phase: 'completed',
        })
        .execute();

      // GitHub 同期レコードを作成
      await db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: 'test-spec-id',
          github_id: '123',
          github_number: 456,
          issue_number: 456,
          sync_status: 'success',
          last_synced_at: new Date().toISOString(),
        })
        .execute();
    });

    test('PR URLをIssueにコメントとして記録できる', async () => {
      // 環境変数をクリア
      delete process.env.GITHUB_OWNER;

      (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(
        'git@github.com:testowner/testrepo.git\n'
      );

      mockClient.rest.issues.createComment = jest.fn().mockResolvedValue(
        createMockOctokitResponse({
          id: 789,
          body: 'プルリクエストが作成されました: https://github.com/testowner/testrepo/pull/123',
        })
      );

      await recordPullRequestToIssue(db, 'test-spec-id', 'https://github.com/testowner/testrepo/pull/123');

      expect(mockClient.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        issue_number: 456,
        body: 'プルリクエストが作成されました: https://github.com/testowner/testrepo/pull/123',
      });
    });

    test('Issue番号が存在しない場合、処理をスキップする', async () => {
      // Issue番号がない同期レコードを作成
      await db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: 'test-spec-id-2',
          github_id: '999',
          github_number: null,
          sync_status: 'success',
          last_synced_at: new Date().toISOString(),
        })
        .execute();

      mockClient.rest.issues.createComment = jest.fn();

      await recordPullRequestToIssue(
        db,
        'test-spec-id-2',
        'https://github.com/testowner/testrepo/pull/123'
      );

      expect(mockClient.rest.issues.createComment).not.toHaveBeenCalled();
    });

    test('GitHub同期レコードが存在しない場合、処理をスキップする', async () => {
      mockClient.rest.issues.createComment = jest.fn();

      await recordPullRequestToIssue(
        db,
        'non-existent-spec',
        'https://github.com/testowner/testrepo/pull/123'
      );

      expect(mockClient.rest.issues.createComment).not.toHaveBeenCalled();
    });

    test('GitHub APIエラーの場合、警告のみで処理を続行する', async () => {
      (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(
        'git@github.com:testowner/testrepo.git\n'
      );

      mockClient.rest.issues.createComment = jest
        .fn()
        .mockRejectedValue(new Error('API Error'));

      // エラーをスローせず、警告のみ出力されることを確認
      await expect(
        recordPullRequestToIssue(db, 'test-spec-id', 'https://github.com/testowner/testrepo/pull/123')
      ).resolves.not.toThrow();
    });
  });
});
