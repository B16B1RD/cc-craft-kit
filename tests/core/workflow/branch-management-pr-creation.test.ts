/**
 * ブランチ管理機能（PR自動作成）の単体テスト
 *
 * completed フェーズ移行時の PR 自動作成機能を検証します。
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { execSync } from 'node:child_process';
import { registerBranchManagementHandlers } from '../../../src/core/workflow/branch-management.js';
import { EventBus, WorkflowEvent } from '../../../src/core/workflow/event-bus.js';
import * as githubClient from '../../../src/integrations/github/client.js';
import * as pullRequest from '../../../src/integrations/github/pull-request.js';
import * as githubConfig from '../../../src/core/config/github-config.js';

// モジュールモック
jest.mock('node:child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('../../../src/integrations/github/client.js', () => ({
  getGitHubClient: jest.fn(),
}));

jest.mock('../../../src/integrations/github/pull-request.js', () => ({
  createPullRequest: jest.fn(),
  recordPullRequestToIssue: jest.fn(),
}));

jest.mock('../../../src/core/errors/error-handler.js', () => ({
  getErrorHandler: jest.fn(() => ({
    handle: jest.fn(),
  })),
}));

jest.mock('../../../src/core/config/github-config.js', () => ({
  getGitHubConfig: jest.fn(() => ({
    owner: 'test-owner',
    repo: 'test-repo',
    defaultBaseBranch: 'develop',
    protectedBranches: ['main', 'develop'],
  })),
}));

jest.mock('../../../src/core/utils/branch-name-generator.js', () => ({
  isHotfixBranch: jest.fn((branchName: string) => branchName.startsWith('hotfix/')),
}));

describe('Branch Management - PR Creation', () => {
  let lifecycle: DatabaseLifecycle;
  let eventBus: EventBus;
  const originalEnv = process.env;

  // モック関数
  const mockExecSync = jest.mocked(execSync);
  const mockGetGitHubClient = jest.mocked(githubClient.getGitHubClient);
  const mockCreatePullRequest = jest.mocked(pullRequest.createPullRequest);
  const mockRecordPullRequestToIssue = jest.mocked(pullRequest.recordPullRequestToIssue);
  const mockGetGitHubConfig = jest.mocked(githubConfig.getGitHubConfig);

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
    eventBus = new EventBus();

    // イベントハンドラー登録
    registerBranchManagementHandlers(eventBus, lifecycle.db);

    // 環境変数をリセット
    process.env = { ...originalEnv };
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_DEFAULT_BASE_BRANCH;

    // モック初期化
    mockExecSync.mockReset();
    mockGetGitHubClient.mockReset();
    mockCreatePullRequest.mockReset();
    mockRecordPullRequestToIssue.mockReset();
    mockGetGitHubConfig.mockReturnValue({
      owner: 'test-owner',
      repo: 'test-repo',
      defaultBaseBranch: 'develop',
      protectedBranches: ['main', 'develop'],
    });
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();

    // 環境変数を復元
    process.env = originalEnv;

    // モックをクリア
    jest.clearAllMocks();
  });

  describe('GitHub クライアント未初期化の場合', () => {
    test('GitHub クライアント未初期化時、PR 作成がスキップされる', async () => {
      // Given: Git リポジトリは初期化済み
      mockExecSync.mockImplementation((cmd: string | Buffer) => {
        if (cmd === 'git rev-parse --git-dir') {
          return '' as never; // 成功
        }
        if (cmd === 'git rev-parse --abbrev-ref HEAD') {
          return 'feature/test' as never;
        }
        throw new Error('Unexpected command');
      });

      // Given: createPullRequest が GitHub クライアント未初期化エラーを返す
      mockCreatePullRequest.mockResolvedValue({
        success: false,
        error: 'GitHub client not initialized',
      });

      // Given: 仕様書が存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'implementation',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // スパイでコンソール出力をキャプチャ
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // When: implementation → completed フェーズ移行イベントを発火
      const event: WorkflowEvent<{ oldPhase: string; newPhase: string }> = {
        type: 'spec.phase_changed',
        specId,
        timestamp: new Date().toISOString(),
        data: {
          oldPhase: 'implementation',
          newPhase: 'completed',
        },
      };

      await eventBus.emit(event);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: createPullRequest が呼び出された
      expect(mockCreatePullRequest).toHaveBeenCalledWith(lifecycle.db, {
        specId,
        branchName: 'feature/test',
        baseBranch: 'develop',
      });

      // Then: 警告メッセージが表示された
      expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  Failed to create pull request');
      expect(consoleWarnSpy).toHaveBeenCalledWith('   Reason: GitHub client not initialized');
      expect(consoleWarnSpy).toHaveBeenCalledWith('   Please run: /cft:github-init <owner> <repo>');
      expect(consoleWarnSpy).toHaveBeenCalledWith('');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('リポジトリ情報不足の場合', () => {
    test('リポジトリ情報不足時、適切なエラーメッセージが表示される', async () => {
      // Given: Git リポジトリは初期化済み
      mockExecSync.mockImplementation((cmd: string | Buffer) => {
        if (cmd === 'git rev-parse --git-dir') {
          return '' as never; // 成功
        }
        if (cmd === 'git rev-parse --abbrev-ref HEAD') {
          return 'feature/test' as never;
        }
        throw new Error('Unexpected command');
      });

      // Given: GitHub クライアント初期化済み
      mockGetGitHubClient.mockReturnValue({} as ReturnType<typeof githubClient.getGitHubClient>);

      // Given: createPullRequest がリポジトリ情報不足エラーを返す
      mockCreatePullRequest.mockResolvedValue({
        success: false,
        error: 'Repository owner or name not found',
      });

      // Given: 仕様書が存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'implementation',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // スパイでコンソール出力をキャプチャ
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // When: implementation → completed フェーズ移行イベントを発火
      const event: WorkflowEvent<{ oldPhase: string; newPhase: string }> = {
        type: 'spec.phase_changed',
        specId,
        timestamp: new Date().toISOString(),
        data: {
          oldPhase: 'implementation',
          newPhase: 'completed',
        },
      };

      await eventBus.emit(event);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: createPullRequest が呼び出された
      expect(mockCreatePullRequest).toHaveBeenCalledWith(lifecycle.db, {
        specId,
        branchName: 'feature/test',
        baseBranch: 'develop', // デフォルト
      });

      // Then: エラーメッセージが表示された
      expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  Failed to create pull request');
      expect(consoleWarnSpy).toHaveBeenCalledWith('   Reason: Repository owner or name not found');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '   Please set GITHUB_OWNER and GITHUB_REPO in .env'
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith('');

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe('PR 作成成功の場合', () => {
    test('PR 作成成功時、成功メッセージが表示される', async () => {
      // Given: Git リポジトリは初期化済み
      mockExecSync.mockImplementation((cmd: string | Buffer) => {
        if (cmd === 'git rev-parse --git-dir') {
          return '' as never;
        }
        if (cmd === 'git rev-parse --abbrev-ref HEAD') {
          return 'feature/test' as never;
        }
        throw new Error('Unexpected command');
      });

      // Given: GitHub クライアント初期化済み
      mockGetGitHubClient.mockReturnValue({} as ReturnType<typeof githubClient.getGitHubClient>);

      // Given: createPullRequest が成功を返す
      const pullRequestUrl = 'https://github.com/owner/repo/pull/123';
      const pullRequestNumber = 123;
      mockCreatePullRequest.mockResolvedValue({
        success: true,
        pullRequestUrl,
        pullRequestNumber,
      });

      // Given: recordPullRequestToIssue は正常に実行される
      mockRecordPullRequestToIssue.mockResolvedValue(undefined);

      // Given: 仕様書と GitHub 同期レコードが存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'implementation',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: specId,
          github_id: '456',
          issue_number: 456,
          issue_url: 'https://github.com/owner/repo/issues/456',
          sync_status: 'success',
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // スパイでコンソール出力をキャプチャ
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // When: implementation → completed フェーズ移行イベントを発火
      const event: WorkflowEvent<{ oldPhase: string; newPhase: string }> = {
        type: 'spec.phase_changed',
        specId,
        timestamp: new Date().toISOString(),
        data: {
          oldPhase: 'implementation',
          newPhase: 'completed',
        },
      };

      await eventBus.emit(event);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: createPullRequest が呼び出された
      expect(mockCreatePullRequest).toHaveBeenCalledWith(lifecycle.db, {
        specId,
        branchName: 'feature/test',
        baseBranch: 'develop', // デフォルト
      });

      // Then: recordPullRequestToIssue が呼び出された
      expect(mockRecordPullRequestToIssue).toHaveBeenCalledWith(lifecycle.db, specId, pullRequestUrl);

      // Then: 成功メッセージが表示された
      expect(consoleLogSpy).toHaveBeenCalledWith(`✓ Pull request created: ${pullRequestUrl}\n`);

      // Then: 警告メッセージは表示されていない
      expect(consoleWarnSpy).not.toHaveBeenCalledWith('\n⚠️  Failed to create pull request');

      // Then: github_sync テーブルに PR 情報が記録された
      const syncRecord = await lifecycle.db
        .selectFrom('github_sync')
        .where('entity_id', '=', specId)
        .where('entity_type', '=', 'spec')
        .selectAll()
        .executeTakeFirst();

      expect(syncRecord).toBeDefined();
      expect(syncRecord?.pr_number).toBe(pullRequestNumber);
      expect(syncRecord?.pr_url).toBe(pullRequestUrl);

      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    test('hotfix ブランチの場合、base ブランチは main になる', async () => {
      // Given: Git リポジトリは初期化済み
      mockExecSync.mockImplementation((cmd: string | Buffer) => {
        if (cmd === 'git rev-parse --git-dir') {
          return '' as never;
        }
        if (cmd === 'git rev-parse --abbrev-ref HEAD') {
          return 'hotfix/critical-bug' as never;
        }
        throw new Error('Unexpected command');
      });

      // Given: GitHub クライアント初期化済み
      mockGetGitHubClient.mockReturnValue({} as ReturnType<typeof githubClient.getGitHubClient>);

      // Given: createPullRequest が成功を返す
      mockCreatePullRequest.mockResolvedValue({
        success: true,
        pullRequestUrl: 'https://github.com/owner/repo/pull/999',
        pullRequestNumber: 999,
      });

      mockRecordPullRequestToIssue.mockResolvedValue(undefined);

      // Given: 仕様書と GitHub 同期レコードが存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Hotfix Spec',
          description: 'Critical bug fix',
          phase: 'implementation',
          branch_name: 'hotfix/critical-bug',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: specId,
          github_id: '999',
          issue_number: 999,
          issue_url: 'https://github.com/owner/repo/issues/999',
          sync_status: 'success',
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // スパイでコンソール出力をキャプチャ
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // When: implementation → completed フェーズ移行イベントを発火
      const event: WorkflowEvent<{ oldPhase: string; newPhase: string }> = {
        type: 'spec.phase_changed',
        specId,
        timestamp: new Date().toISOString(),
        data: {
          oldPhase: 'implementation',
          newPhase: 'completed',
        },
      };

      await eventBus.emit(event);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: createPullRequest が base=main で呼び出された
      expect(mockCreatePullRequest).toHaveBeenCalledWith(lifecycle.db, {
        specId,
        branchName: 'hotfix/critical-bug',
        baseBranch: 'main', // hotfix ブランチの場合は main
      });

      // Then: 成功メッセージが表示された
      expect(consoleLogSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    test('GITHUB_DEFAULT_BASE_BRANCH が設定されている場合、それが使用される', async () => {
      // Given: 環境変数で base ブランチを指定
      process.env.GITHUB_DEFAULT_BASE_BRANCH = 'staging';
      mockGetGitHubConfig.mockReturnValue({
        owner: 'test-owner',
        repo: 'test-repo',
        defaultBaseBranch: 'staging',
        protectedBranches: ['main', 'develop'],
      });

      // Given: Git リポジトリは初期化済み
      mockExecSync.mockImplementation((cmd: string | Buffer) => {
        if (cmd === 'git rev-parse --git-dir') {
          return '' as never;
        }
        if (cmd === 'git rev-parse --abbrev-ref HEAD') {
          return 'feature/test' as never;
        }
        throw new Error('Unexpected command');
      });

      // Given: GitHub クライアント初期化済み
      mockGetGitHubClient.mockReturnValue({} as ReturnType<typeof githubClient.getGitHubClient>);

      // Given: createPullRequest が成功を返す
      mockCreatePullRequest.mockResolvedValue({
        success: true,
        pullRequestUrl: 'https://github.com/owner/repo/pull/777',
        pullRequestNumber: 777,
      });

      mockRecordPullRequestToIssue.mockResolvedValue(undefined);

      // Given: 仕様書と GitHub 同期レコードが存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'implementation',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: specId,
          github_id: '777',
          issue_number: 777,
          issue_url: 'https://github.com/owner/repo/issues/777',
          sync_status: 'success',
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // スパイでコンソール出力をキャプチャ
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // When: implementation → completed フェーズ移行イベントを発火
      const event: WorkflowEvent<{ oldPhase: string; newPhase: string }> = {
        type: 'spec.phase_changed',
        specId,
        timestamp: new Date().toISOString(),
        data: {
          oldPhase: 'implementation',
          newPhase: 'completed',
        },
      };

      await eventBus.emit(event);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: createPullRequest が base=staging で呼び出された
      expect(mockCreatePullRequest).toHaveBeenCalledWith(lifecycle.db, {
        specId,
        branchName: 'feature/test',
        baseBranch: 'staging', // 環境変数で指定した値
      });

      // Then: 成功メッセージが表示された
      expect(consoleLogSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });
  });

  describe('Git リポジトリチェック', () => {
    test('Git リポジトリ未初期化の場合、PR 作成がスキップされる', async () => {
      // Given: Git リポジトリ未初期化
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      // Given: 仕様書が存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'implementation',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // スパイでコンソール出力をキャプチャ
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // When: implementation → completed フェーズ移行イベントを発火
      const event: WorkflowEvent<{ oldPhase: string; newPhase: string }> = {
        type: 'spec.phase_changed',
        specId,
        timestamp: new Date().toISOString(),
        data: {
          oldPhase: 'implementation',
          newPhase: 'completed',
        },
      };

      await eventBus.emit(event);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: 情報メッセージが表示された
      expect(consoleLogSpy).toHaveBeenCalledWith('\nℹ Not a Git repository, skipping PR creation');

      // Then: createPullRequest が呼び出されていない
      expect(mockCreatePullRequest).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    test('現在のブランチ取得失敗時、PR 作成がスキップされる', async () => {
      // Given: Git リポジトリは初期化済みだが、ブランチ取得が失敗
      mockExecSync.mockImplementation((cmd: string | Buffer) => {
        if (cmd === 'git rev-parse --git-dir') {
          return '' as never; // 成功
        }
        throw new Error('Failed to get current branch');
      });

      // Given: 仕様書が存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'implementation',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // スパイでコンソール出力をキャプチャ
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // When: implementation → completed フェーズ移行イベントを発火
      const event: WorkflowEvent<{ oldPhase: string; newPhase: string }> = {
        type: 'spec.phase_changed',
        specId,
        timestamp: new Date().toISOString(),
        data: {
          oldPhase: 'implementation',
          newPhase: 'completed',
        },
      };

      await eventBus.emit(event);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: 警告メッセージが表示された
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '\n⚠️  Failed to get current branch, skipping PR creation'
      );

      // Then: createPullRequest が呼び出されていない
      expect(mockCreatePullRequest).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('保護ブランチチェック', () => {
    test('main ブランチの場合、PR 作成がスキップされる', async () => {
      // Given: Git リポジトリは初期化済み、現在のブランチは main
      mockExecSync.mockImplementation((cmd: string | Buffer) => {
        if (cmd === 'git rev-parse --git-dir') {
          return '' as never;
        }
        if (cmd === 'git rev-parse --abbrev-ref HEAD') {
          return 'main' as never;
        }
        throw new Error('Unexpected command');
      });

      // Given: 仕様書が存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'implementation',
          branch_name: 'main',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // スパイでコンソール出力をキャプチャ
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // When: implementation → completed フェーズ移行イベントを発火
      const event: WorkflowEvent<{ oldPhase: string; newPhase: string }> = {
        type: 'spec.phase_changed',
        specId,
        timestamp: new Date().toISOString(),
        data: {
          oldPhase: 'implementation',
          newPhase: 'completed',
        },
      };

      await eventBus.emit(event);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: 警告メッセージが表示された
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "\n⚠️  On protected branch 'main', skipping PR creation"
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith('   Please create a PR manually\n');

      // Then: createPullRequest が呼び出されていない
      expect(mockCreatePullRequest).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    test('develop ブランチの場合、PR 作成がスキップされる', async () => {
      // Given: Git リポジトリは初期化済み、現在のブランチは develop
      mockExecSync.mockImplementation((cmd: string | Buffer) => {
        if (cmd === 'git rev-parse --git-dir') {
          return '' as never;
        }
        if (cmd === 'git rev-parse --abbrev-ref HEAD') {
          return 'develop' as never;
        }
        throw new Error('Unexpected command');
      });

      // Given: 仕様書が存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'implementation',
          branch_name: 'develop',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // スパイでコンソール出力をキャプチャ
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // When: implementation → completed フェーズ移行イベントを発火
      const event: WorkflowEvent<{ oldPhase: string; newPhase: string }> = {
        type: 'spec.phase_changed',
        specId,
        timestamp: new Date().toISOString(),
        data: {
          oldPhase: 'implementation',
          newPhase: 'completed',
        },
      };

      await eventBus.emit(event);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: 警告メッセージが表示された
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "\n⚠️  On protected branch 'develop', skipping PR creation"
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith('   Please create a PR manually\n');

      // Then: createPullRequest が呼び出されていない
      expect(mockCreatePullRequest).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    test('カスタム保護ブランチの場合、PR 作成がスキップされる', async () => {
      // Given: カスタム保護ブランチを設定
      process.env.PROTECTED_BRANCHES = 'main,develop,staging';
      mockGetGitHubConfig.mockReturnValue({
        owner: 'test-owner',
        repo: 'test-repo',
        defaultBaseBranch: 'develop',
        protectedBranches: ['main', 'develop', 'staging'],
      });

      // Given: Git リポジトリは初期化済み、現在のブランチは staging
      mockExecSync.mockImplementation((cmd: string | Buffer) => {
        if (cmd === 'git rev-parse --git-dir') {
          return '' as never;
        }
        if (cmd === 'git rev-parse --abbrev-ref HEAD') {
          return 'staging' as never;
        }
        throw new Error('Unexpected command');
      });

      // Given: 仕様書が存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'implementation',
          branch_name: 'staging',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // スパイでコンソール出力をキャプチャ
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // When: implementation → completed フェーズ移行イベントを発火
      const event: WorkflowEvent<{ oldPhase: string; newPhase: string }> = {
        type: 'spec.phase_changed',
        specId,
        timestamp: new Date().toISOString(),
        data: {
          oldPhase: 'implementation',
          newPhase: 'completed',
        },
      };

      await eventBus.emit(event);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: 警告メッセージが表示された
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "\n⚠️  On protected branch 'staging', skipping PR creation"
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith('   Please create a PR manually\n');

      // Then: createPullRequest が呼び出されていない
      expect(mockCreatePullRequest).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('フェーズ移行タイミング', () => {
    test('requirements → design の場合、PR 作成は実行されない', async () => {
      // Given: 仕様書が存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'requirements',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // When: requirements → design フェーズ移行イベントを発火
      const event: WorkflowEvent<{ oldPhase: string; newPhase: string }> = {
        type: 'spec.phase_changed',
        specId,
        timestamp: new Date().toISOString(),
        data: {
          oldPhase: 'requirements',
          newPhase: 'design',
        },
      };

      await eventBus.emit(event);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: createPullRequest が呼び出されていない
      expect(mockCreatePullRequest).not.toHaveBeenCalled();
    });

    test('design → tasks の場合、PR 作成は実行されない', async () => {
      // Given: 仕様書が存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'design',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // When: design → tasks フェーズ移行イベントを発火
      const event: WorkflowEvent<{ oldPhase: string; newPhase: string }> = {
        type: 'spec.phase_changed',
        specId,
        timestamp: new Date().toISOString(),
        data: {
          oldPhase: 'design',
          newPhase: 'tasks',
        },
      };

      await eventBus.emit(event);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: createPullRequest が呼び出されていない
      expect(mockCreatePullRequest).not.toHaveBeenCalled();
    });

    test('tasks → implementation の場合、PR 作成は実行されない', async () => {
      // Given: 仕様書が存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'tasks',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // When: tasks → implementation フェーズ移行イベントを発火
      const event: WorkflowEvent<{ oldPhase: string; newPhase: string }> = {
        type: 'spec.phase_changed',
        specId,
        timestamp: new Date().toISOString(),
        data: {
          oldPhase: 'tasks',
          newPhase: 'implementation',
        },
      };

      await eventBus.emit(event);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then: createPullRequest が呼び出されていない
      expect(mockCreatePullRequest).not.toHaveBeenCalled();
    });
  });
});
