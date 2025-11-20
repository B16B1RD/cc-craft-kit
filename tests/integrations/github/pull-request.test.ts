/**
 * GitHub プルリクエスト自動作成機能のテスト
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createPullRequest, recordPullRequestToIssue } from '../../../src/integrations/github/pull-request.js';
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

  describe('createPullRequest', () => {
    beforeEach(async () => {
      // テスト用の仕様書を作成
      await db
        .insertInto('specs')
        .values({
          id: 'test-spec-id',
          name: 'テスト仕様書',
          description: 'テスト用の仕様書です',
          phase: 'implementation',
        })
        .execute();
    });

    test('PRを正常に作成できる', async () => {
      // 環境変数をクリア
      delete process.env.GITHUB_OWNER;

      // Git リポジトリ情報のモック
      (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(
        'git@github.com:testowner/testrepo.git\n'
      );

      // PR作成のモック
      mockClient.rest.pulls.create = jest.fn().mockResolvedValue(
        createMockOctokitResponse({
          number: 123,
          html_url: 'https://github.com/testowner/testrepo/pull/123',
          title: 'テスト仕様書',
          body: 'PR本文',
        })
      );

      const result = await createPullRequest(db, {
        specId: 'test-spec-id',
        branchName: 'feature/test-branch',
        baseBranch: 'develop',
      });

      expect(result.success).toBe(true);
      expect(result.pullRequestUrl).toBe('https://github.com/testowner/testrepo/pull/123');
      expect(result.pullRequestNumber).toBe(123);
      expect(mockClient.rest.pulls.create).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        title: 'テスト仕様書',
        head: 'feature/test-branch',
        base: 'develop',
        body: expect.stringContaining('テスト用の仕様書です'),
      });
    });

    test('環境変数からリポジトリ情報を取得できる', async () => {
      process.env.GITHUB_OWNER = 'envowner';

      // Git リポジトリ情報のモック
      (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(
        'git@github.com:gitowner/testrepo.git\n'
      );

      mockClient.rest.pulls.create = jest.fn().mockResolvedValue(
        createMockOctokitResponse({
          number: 124,
          html_url: 'https://github.com/envowner/testrepo/pull/124',
          title: 'テスト仕様書',
        })
      );

      const result = await createPullRequest(db, {
        specId: 'test-spec-id',
        branchName: 'feature/test-branch',
      });

      expect(result.success).toBe(true);
      expect(mockClient.rest.pulls.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'envowner',
        })
      );

      delete process.env.GITHUB_OWNER;
    });

    test('ベースブランチのデフォルト値を使用できる', async () => {
      (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(
        'git@github.com:testowner/testrepo.git\n'
      );

      mockClient.rest.pulls.create = jest.fn().mockResolvedValue(
        createMockOctokitResponse({
          number: 125,
          html_url: 'https://github.com/testowner/testrepo/pull/125',
        })
      );

      await createPullRequest(db, {
        specId: 'test-spec-id',
        branchName: 'feature/test-branch',
      });

      expect(mockClient.rest.pulls.create).toHaveBeenCalledWith(
        expect.objectContaining({
          base: 'develop', // デフォルト値
        })
      );
    });

    test('仕様書が存在しない場合、エラーを返す', async () => {
      const result = await createPullRequest(db, {
        specId: 'non-existent-spec',
        branchName: 'feature/test-branch',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Spec not found');
    });

    test('リポジトリ情報が取得できない場合、エラーを返す', async () => {
      (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue('');

      const result = await createPullRequest(db, {
        specId: 'test-spec-id',
        branchName: 'feature/test-branch',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Repository owner or name not found');
    });

    test('GitHub API エラーの場合、エラーを返す', async () => {
      (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(
        'git@github.com:testowner/testrepo.git\n'
      );

      mockClient.rest.pulls.create = jest
        .fn()
        .mockRejectedValue(new Error('API Error: Rate limit exceeded'));

      const result = await createPullRequest(db, {
        specId: 'test-spec-id',
        branchName: 'feature/test-branch',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });
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
