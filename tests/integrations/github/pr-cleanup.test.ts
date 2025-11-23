/**
 * GitHub プルリクエスト マージ後処理のテスト
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  cleanupMergedPullRequest,
  checkPullRequestMerged,
} from '../../../src/integrations/github/pr-cleanup.js';
import { createTestDatabase, cleanupTestDatabase } from '../../helpers/test-database.js';
import type { Kysely } from 'kysely';
import type { Database } from '../../../src/core/database/schema.js';
import { createMockGitHubClient, createMockOctokitResponse, createMockEventBus } from '../../helpers/index.js';

// GitHub クライアントのモック
jest.mock('../../../src/integrations/github/client.js', () => ({
  getGitHubClient: jest.fn(),
  initGitHubClient: jest.fn(),
}));

// Git コマンドのモック
jest.mock('node:child_process', () => ({
  execSync: jest.fn(),
}));

// EventBus のモック
jest.mock('../../../src/core/workflow/event-bus.js', () => ({
  getEventBusAsync: jest.fn(),
}));

// ファイルシステムのモック
jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import { getGitHubClient, initGitHubClient } from '../../../src/integrations/github/client.js';
import { execSync } from 'node:child_process';
import { getEventBusAsync } from '../../../src/core/workflow/event-bus.js';
import { existsSync, readFileSync } from 'node:fs';

describe('pr-cleanup', () => {
  let db: Kysely<Database>;
  let mockClient: ReturnType<typeof createMockGitHubClient>;
  let mockEventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(async () => {
    db = await createTestDatabase();
    mockClient = createMockGitHubClient();
    mockEventBus = createMockEventBus();
    (getGitHubClient as jest.MockedFunction<typeof getGitHubClient>).mockReturnValue(mockClient);
    (getEventBusAsync as jest.MockedFunction<typeof getEventBusAsync>).mockResolvedValue(mockEventBus);

    // デフォルトでファイルシステムモックを設定
    (existsSync as jest.MockedFunction<typeof existsSync>).mockReturnValue(false);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
    jest.clearAllMocks();
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_OWNER;
    delete process.env.GITHUB_REPO;
    delete process.env.PROTECTED_BRANCHES;
  });

  describe('checkPullRequestMerged', () => {
    test('should return true when PR is merged', async () => {
      // PR マージ済みのモック
      mockClient.rest.pulls.get = jest.fn().mockResolvedValue(
        createMockOctokitResponse({
          number: 123,
          merged: true,
          merged_at: '2025-01-20T10:00:00Z',
        })
      );

      const result = await checkPullRequestMerged(mockClient, 'testowner', 'testrepo', 123);

      expect(result).toBe(true);
      expect(mockClient.rest.pulls.get).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        pull_number: 123,
      });
    });

    test('should return false when PR is not merged', async () => {
      // PR 未マージのモック
      mockClient.rest.pulls.get = jest.fn().mockResolvedValue(
        createMockOctokitResponse({
          number: 123,
          merged: false,
          merged_at: null,
        })
      );

      const result = await checkPullRequestMerged(mockClient, 'testowner', 'testrepo', 123);

      expect(result).toBe(false);
    });
  });

  describe('cleanupMergedPullRequest', () => {
    beforeEach(async () => {
      // テスト用の仕様書を作成
      await db
        .insertInto('specs')
        .values({
          id: 'test-spec-id-12345678',
          name: 'テスト仕様書',
          description: 'テスト用の仕様書です',
          phase: 'completed',
          branch_name: 'feature/test-branch',
        })
        .execute();

      // GitHub 同期レコードを作成
      await db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: 'test-spec-id-12345678',
          github_id: '456',
          github_number: 123,
          pr_number: 123,
          sync_status: 'success',
          last_synced_at: new Date().toISOString(),
        })
        .execute();
    });

    describe('GitHub クライアント初期化', () => {
      test('should auto-initialize GitHub client from env vars', async () => {
        // GitHub クライアント未初期化をシミュレート
        (getGitHubClient as jest.MockedFunction<typeof getGitHubClient>)
          .mockImplementationOnce(() => {
            throw new Error('GitHub client not initialized');
          })
          .mockReturnValue(mockClient);

        // 環境変数を設定
        process.env.GITHUB_TOKEN = 'test-token';
        process.env.GITHUB_OWNER = 'testowner';
        process.env.GITHUB_REPO = 'testrepo';

        // initGitHubClient のモック
        (initGitHubClient as jest.MockedFunction<typeof initGitHubClient>).mockReturnValue(mockClient);

        // PR マージ済みのモック
        mockClient.rest.pulls.get = jest.fn().mockResolvedValue(
          createMockOctokitResponse({
            number: 123,
            merged: true,
            merged_at: '2025-01-20T10:00:00Z',
            base: { ref: 'develop' },
          })
        );

        // Git コマンドのモック
        (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(Buffer.from('success'));

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(true);
        expect(initGitHubClient).toHaveBeenCalledWith({ token: 'test-token' });
      });

      test('should fail if GitHub client cannot be initialized', async () => {
        // GitHub クライアント未初期化をシミュレート
        (getGitHubClient as jest.MockedFunction<typeof getGitHubClient>).mockImplementation(() => {
          throw new Error('GitHub client not initialized');
        });

        // 環境変数を未設定にする
        delete process.env.GITHUB_TOKEN;

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(false);
        expect(result.error).toContain('GitHub client not initialized');
      });
    });

    describe('設定読み込み', () => {
      test('should read config from env vars first', async () => {
        // 環境変数を設定
        process.env.GITHUB_OWNER = 'envowner';
        process.env.GITHUB_REPO = 'envrepo';

        // config.json も存在するが、環境変数が優先される
        (existsSync as jest.MockedFunction<typeof existsSync>).mockReturnValue(true);
        (readFileSync as jest.MockedFunction<typeof readFileSync>).mockReturnValue(
          JSON.stringify({
            github: {
              owner: 'fileowner',
              repo: 'filerepo',
            },
          })
        );

        // PR マージ済みのモック
        mockClient.rest.pulls.get = jest.fn().mockResolvedValue(
          createMockOctokitResponse({
            number: 123,
            merged: true,
            merged_at: '2025-01-20T10:00:00Z',
            base: { ref: 'develop' },
          })
        );

        // Git コマンドのモック
        (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(Buffer.from('success'));

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(true);
        expect(mockClient.rest.pulls.get).toHaveBeenCalledWith(
          expect.objectContaining({
            owner: 'envowner',
            repo: 'envrepo',
          })
        );
      });

      test('should fallback to config.json if env vars are missing', async () => {
        // 環境変数を未設定
        delete process.env.GITHUB_OWNER;
        delete process.env.GITHUB_REPO;

        // config.json を返す
        (existsSync as jest.MockedFunction<typeof existsSync>).mockReturnValue(true);
        (readFileSync as jest.MockedFunction<typeof readFileSync>).mockReturnValue(
          JSON.stringify({
            github: {
              owner: 'fileowner',
              repo: 'filerepo',
            },
          })
        );

        // PR マージ済みのモック
        mockClient.rest.pulls.get = jest.fn().mockResolvedValue(
          createMockOctokitResponse({
            number: 123,
            merged: true,
            merged_at: '2025-01-20T10:00:00Z',
            base: { ref: 'develop' },
          })
        );

        // Git コマンドのモック
        (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(Buffer.from('success'));

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(true);
        expect(mockClient.rest.pulls.get).toHaveBeenCalledWith(
          expect.objectContaining({
            owner: 'fileowner',
            repo: 'filerepo',
          })
        );
      });

      test('should fail if GitHub repository not configured', async () => {
        // 環境変数を未設定
        delete process.env.GITHUB_OWNER;
        delete process.env.GITHUB_REPO;

        // config.json が存在しない
        (existsSync as jest.MockedFunction<typeof existsSync>).mockReturnValue(false);

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(false);
        expect(result.error).toContain('GitHub repository not configured');
      });
    });

    describe('PR マージ状態確認', () => {
      beforeEach(() => {
        // 環境変数を設定
        process.env.GITHUB_OWNER = 'testowner';
        process.env.GITHUB_REPO = 'testrepo';
      });

      test('should succeed when PR is merged', async () => {
        // PR マージ済みのモック
        mockClient.rest.pulls.get = jest.fn().mockResolvedValue(
          createMockOctokitResponse({
            number: 123,
            merged: true,
            merged_at: '2025-01-20T10:00:00Z',
            base: { ref: 'develop' },
          })
        );

        // Git コマンドのモック
        (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(Buffer.from('success'));

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(true);
        expect(result.prNumber).toBe(123);
        expect(result.branchName).toBe('feature/test-branch');
        expect(result.mergedAt).toBe('2025-01-20T10:00:00Z');
      });

      test('should fail when PR is not merged', async () => {
        // PR 未マージのモック
        mockClient.rest.pulls.get = jest.fn().mockResolvedValue(
          createMockOctokitResponse({
            number: 123,
            merged: false,
            merged_at: null,
          })
        );

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(false);
        expect(result.error).toContain('is not merged yet');
      });

      test('should fail when PR fetch fails', async () => {
        // GitHub API エラー
        mockClient.rest.pulls.get = jest.fn().mockRejectedValue(new Error('Not found'));

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to fetch PR');
        expect(result.error).toContain('Not found');
      });

      test('should fail when spec has no PR number', async () => {
        // PR 番号がない仕様書を作成
        await db
          .insertInto('specs')
          .values({
            id: 'test-spec-no-pr',
            name: 'テスト仕様書(PR なし)',
            phase: 'implementation',
            branch_name: 'feature/no-pr',
          })
          .execute();

        await db
          .insertInto('github_sync')
          .values({
            entity_type: 'spec',
            entity_id: 'test-spec-no-pr',
            github_id: '789',
            github_number: null,
            pr_number: null,
            sync_status: 'success',
            last_synced_at: new Date().toISOString(),
          })
          .execute();

        const result = await cleanupMergedPullRequest(db, 'test-spec-no-pr');

        expect(result.success).toBe(false);
        expect(result.error).toContain('PR が作成されていません');
      });

      test('should fail when spec not found', async () => {
        const result = await cleanupMergedPullRequest(db, 'non-existent-spec');

        expect(result.success).toBe(false);
        expect(result.error).toContain('仕様書が見つかりません');
      });
    });

    describe('ブランチ削除', () => {
      beforeEach(() => {
        // 環境変数を設定
        process.env.GITHUB_OWNER = 'testowner';
        process.env.GITHUB_REPO = 'testrepo';

        // PR マージ済みのモック
        mockClient.rest.pulls.get = jest.fn().mockResolvedValue(
          createMockOctokitResponse({
            number: 123,
            merged: true,
            merged_at: '2025-01-20T10:00:00Z',
            base: { ref: 'develop' },
          })
        );
      });

      test('should delete local and remote branches', async () => {
        // Git コマンドのモック
        (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(Buffer.from('success'));

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(true);

        // ローカルブランチ削除を確認
        expect(execSync).toHaveBeenCalledWith('git branch -D feature/test-branch', expect.any(Object));

        // リモートブランチ削除を確認
        expect(execSync).toHaveBeenCalledWith('git push origin --delete feature/test-branch', expect.any(Object));
      });

      test('should warn when branch is already deleted', async () => {
        // ブランチが存在しないエラーをシミュレート
        (execSync as jest.MockedFunction<typeof execSync>).mockImplementation((cmd) => {
          if (typeof cmd === 'string' && cmd.includes('git branch -D')) {
            const error = new Error('error: branch \'feature/test-branch\' not found.');
            throw error;
          }
          if (typeof cmd === 'string' && cmd.includes('git push origin --delete')) {
            const error = new Error('error: unable to delete \'feature/test-branch\': remote ref does not exist');
            throw error;
          }
          return Buffer.from('success');
        });

        // console.warn のスパイ
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(true);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('既に削除済みです'));

        warnSpy.mockRestore();
      });

      test('should throw error when deleting protected branch', async () => {
        // 保護ブランチ（develop）を使用する仕様書を作成
        await db
          .updateTable('specs')
          .set({ branch_name: 'develop' })
          .where('id', '=', 'test-spec-id-12345678')
          .execute();

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(false);
        expect(result.error).toContain('保護ブランチは削除できません');
      });
    });

    describe('データベーストランザクション', () => {
      beforeEach(() => {
        // 環境変数を設定
        process.env.GITHUB_OWNER = 'testowner';
        process.env.GITHUB_REPO = 'testrepo';

        // PR マージ済みのモック
        mockClient.rest.pulls.get = jest.fn().mockResolvedValue(
          createMockOctokitResponse({
            number: 123,
            merged: true,
            merged_at: '2025-01-20T10:00:00Z',
            base: { ref: 'develop' },
          })
        );

        // Git コマンドのモック
        (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(Buffer.from('success'));
      });

      test('should update database in transaction', async () => {
        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(true);

        // データベース更新を確認
        const spec = await db
          .selectFrom('specs')
          .selectAll()
          .where('id', '=', 'test-spec-id-12345678')
          .executeTakeFirst();

        expect(spec?.branch_name).toBe('develop'); // ベースブランチに更新されている

        const githubSync = await db
          .selectFrom('github_sync')
          .selectAll()
          .where('entity_id', '=', 'test-spec-id-12345678')
          .executeTakeFirst();

        expect(githubSync?.pr_merged_at).toBe('2025-01-20T10:00:00Z');
      });

      test('should rollback transaction on error', async () => {
        // データベースエラーをシミュレート
        // 保護ブランチエラーを発生させる
        await db
          .updateTable('specs')
          .set({ branch_name: 'main' })
          .where('id', '=', 'test-spec-id-12345678')
          .execute();

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(false);
        expect(result.error).toContain('保護ブランチは削除できません');

        // データベースが変更されていないことを確認
        const githubSync = await db
          .selectFrom('github_sync')
          .selectAll()
          .where('entity_id', '=', 'test-spec-id-12345678')
          .executeTakeFirst();

        expect(githubSync?.pr_merged_at).toBeNull();
      });
    });

    describe('イベント発行', () => {
      beforeEach(() => {
        // 環境変数を設定
        process.env.GITHUB_OWNER = 'testowner';
        process.env.GITHUB_REPO = 'testrepo';

        // PR マージ済みのモック
        mockClient.rest.pulls.get = jest.fn().mockResolvedValue(
          createMockOctokitResponse({
            number: 123,
            merged: true,
            merged_at: '2025-01-20T10:00:00Z',
            base: { ref: 'develop' },
          })
        );

        // Git コマンドのモック
        (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(Buffer.from('success'));
      });

      test('should emit spec.pr_merged event', async () => {
        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(true);
        expect(mockEventBus.emit).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'spec.pr_merged',
            specId: 'test-spec-id-12345678',
            data: {
              prNumber: 123,
              branchName: 'feature/test-branch',
              mergedAt: '2025-01-20T10:00:00Z',
            },
          })
        );
      });

      test('should continue even if event emission fails', async () => {
        // イベント発火エラーをシミュレート
        mockEventBus.emit.mockRejectedValue(new Error('Event bus error'));

        // console.warn のスパイ
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(true);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('イベント発火に失敗しました'));

        warnSpy.mockRestore();
      });
    });

    describe('エッジケース', () => {
      beforeEach(() => {
        // 環境変数を設定
        process.env.GITHUB_OWNER = 'testowner';
        process.env.GITHUB_REPO = 'testrepo';
      });

      test('should handle merged_at as null gracefully', async () => {
        // merged_at が null の場合
        mockClient.rest.pulls.get = jest.fn().mockResolvedValue(
          createMockOctokitResponse({
            number: 123,
            merged: true,
            merged_at: null,
            base: { ref: 'develop' },
          })
        );

        // Git コマンドのモック
        (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(Buffer.from('success'));

        const result = await cleanupMergedPullRequest(db, 'test-spec-id');

        expect(result.success).toBe(true);
        expect(result.mergedAt).toBeNull();

        // データベースに現在時刻が記録されていることを確認
        const githubSync = await db
          .selectFrom('github_sync')
          .selectAll()
          .where('entity_id', '=', 'test-spec-id-12345678')
          .executeTakeFirst();

        expect(githubSync?.pr_merged_at).toBeTruthy();
      });

      test('should handle spec ID prefix matching', async () => {
        // 前方一致検索をテスト(test-spec のみで検索)
        mockClient.rest.pulls.get = jest.fn().mockResolvedValue(
          createMockOctokitResponse({
            number: 123,
            merged: true,
            merged_at: '2025-01-20T10:00:00Z',
            base: { ref: 'develop' },
          })
        );

        // Git コマンドのモック
        (execSync as jest.MockedFunction<typeof execSync>).mockReturnValue(Buffer.from('success'));

        const result = await cleanupMergedPullRequest(db, 'test-spec');

        expect(result.success).toBe(true);
        expect(result.prNumber).toBe(123);
      });
    });
  });
});
