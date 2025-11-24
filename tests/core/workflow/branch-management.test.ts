/**
 * ブランチ管理機能（checkRemoteBranchExists, handlePullRequestCreationOnCompleted）の単体テスト
 *
 * checkRemoteBranchExists() と handlePullRequestCreationOnCompleted() の追加テストケースを検証します。
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

describe('Branch Management - checkRemoteBranchExists & handlePullRequestCreationOnCompleted', () => {
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
    delete process.env.BASE_BRANCH;

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

  describe('checkRemoteBranchExists()', () => {
    describe('正常系: ブランチがリモートに存在する場合', () => {
      test('git ls-remote が成功し、true を返す', async () => {
        // Given: Git リポジトリは初期化済み
        mockExecSync.mockImplementation((cmd: string | Buffer) => {
          if (cmd === 'git rev-parse --git-dir') {
            return '' as never;
          }
          if (cmd === 'git rev-parse --abbrev-ref HEAD') {
            return 'feature/existing-branch' as never;
          }
          if (typeof cmd === 'string' && cmd.startsWith('git ls-remote --heads origin')) {
            return 'abc123 refs/heads/feature/existing-branch\n' as never;
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
            branch_name: 'feature/existing-branch',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute();

        // Given: GitHub 同期レコードが存在する
        await lifecycle.db
          .insertInto('github_sync')
          .values({
            entity_type: 'spec',
            entity_id: specId,
            github_id: '123',
            issue_number: 123,
            issue_url: 'https://github.com/owner/repo/issues/123',
            sync_status: 'success',
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute();

        // Given: createPullRequest が成功を返す
        mockCreatePullRequest.mockResolvedValue({
          success: true,
          pullRequestUrl: 'https://github.com/owner/repo/pull/100',
          pullRequestNumber: 100,
        });

        mockRecordPullRequestToIssue.mockResolvedValue(undefined);

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

        // Then: git ls-remote が呼び出された（ブランチ存在確認）
        expect(mockExecSync).toHaveBeenCalledWith(
          'git ls-remote --heads origin feature/existing-branch',
          expect.objectContaining({ stdio: ['ignore', 'pipe', 'ignore'] })
        );

        // Then: ブランチプッシュは実行されていない（既にリモートに存在するため）
        expect(mockExecSync).not.toHaveBeenCalledWith(
          expect.stringContaining('git push -u origin'),
          expect.anything()
        );

        // Then: PR作成が実行された
        expect(mockCreatePullRequest).toHaveBeenCalledWith(lifecycle.db, {
          specId,
          branchName: 'feature/existing-branch',
          defaultBaseBranch: 'develop',
        });

        consoleLogSpy.mockRestore();
      });
    });

    describe('正常系: ブランチがリモートに存在しない場合', () => {
      test('git ls-remote が失敗し、自動プッシュが実行される', async () => {
        // Given: Git リポジトリは初期化済み
        mockExecSync.mockImplementation((cmd: string | Buffer) => {
          if (cmd === 'git rev-parse --git-dir') {
            return '' as never;
          }
          if (cmd === 'git rev-parse --abbrev-ref HEAD') {
            return 'feature/new-branch' as never;
          }
          if (typeof cmd === 'string' && cmd.startsWith('git ls-remote --heads origin')) {
            throw new Error('Branch not found');
          }
          if (typeof cmd === 'string' && cmd.includes('git push -u origin')) {
            return '' as never; // プッシュ成功
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
            branch_name: 'feature/new-branch',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute();

        // Given: GitHub 同期レコードが存在する
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

        // Given: createPullRequest が成功を返す
        mockCreatePullRequest.mockResolvedValue({
          success: true,
          pullRequestUrl: 'https://github.com/owner/repo/pull/200',
          pullRequestNumber: 200,
        });

        mockRecordPullRequestToIssue.mockResolvedValue(undefined);

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

        // Then: git ls-remote が呼び出された（ブランチ存在確認）
        expect(mockExecSync).toHaveBeenCalledWith(
          'git ls-remote --heads origin feature/new-branch',
          expect.objectContaining({ stdio: ['ignore', 'pipe', 'ignore'] })
        );

        // Then: 自動プッシュが実行された
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '\n⚠️  ブランチがリモートにプッシュされていません。自動プッシュを実行します...'
        );
        expect(mockExecSync).toHaveBeenCalledWith(
          'git push -u origin feature/new-branch',
          expect.objectContaining({
            stdio: 'inherit',
            env: expect.objectContaining({
              GIT_ASKPASS: 'echo',
              GIT_TERMINAL_PROMPT: '0',
            }),
          })
        );

        // Then: プッシュ成功メッセージが表示された
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '\n✓ ブランチをリモートにプッシュしました: feature/new-branch'
        );

        // Then: PR作成が実行された
        expect(mockCreatePullRequest).toHaveBeenCalledWith(lifecycle.db, {
          specId,
          branchName: 'feature/new-branch',
          defaultBaseBranch: 'develop',
        });

        consoleLogSpy.mockRestore();
      });
    });

    describe('異常系: 不正なブランチ名の場合', () => {
      test('ブランチ名に不正な文字が含まれる場合、checkRemoteBranchExists() が例外をスローし、エラーハンドリングされる', async () => {
        // Given: Git リポジトリは初期化済み
        mockExecSync.mockImplementation((cmd: string | Buffer) => {
          if (cmd === 'git rev-parse --git-dir') {
            return '' as never;
          }
          if (cmd === 'git rev-parse --abbrev-ref HEAD') {
            return 'feature/test; rm -rf /' as never; // 不正なブランチ名（セミコロンを含む）
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
            branch_name: 'feature/test; rm -rf /',
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

        // Then: エラーハンドリングされ、警告メッセージが表示される（catchブロック内のprintPullRequestError）
        expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  Failed to create pull request');

        // Then: PR作成は実行されていない
        expect(mockCreatePullRequest).not.toHaveBeenCalled();

        consoleWarnSpy.mockRestore();
      });
    });
  });

  describe('handlePullRequestCreationOnCompleted()', () => {
    describe('正常系: ブランチプッシュ失敗時、PR 作成をスキップする', () => {
      test('git push が失敗した場合、エラーメッセージが表示され、PR 作成がスキップされる', async () => {
        // Given: Git リポジトリは初期化済み
        mockExecSync.mockImplementation((cmd: string | Buffer) => {
          if (cmd === 'git rev-parse --git-dir') {
            return '' as never;
          }
          if (cmd === 'git rev-parse --abbrev-ref HEAD') {
            return 'feature/push-failed' as never;
          }
          if (typeof cmd === 'string' && cmd.startsWith('git ls-remote --heads origin')) {
            throw new Error('Branch not found');
          }
          if (typeof cmd === 'string' && cmd.includes('git push -u origin')) {
            throw new Error('Push failed: Authentication failed');
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
            branch_name: 'feature/push-failed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute();

        // スパイでコンソール出力をキャプチャ
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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

        // Then: 自動プッシュが試行された
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '\n⚠️  ブランチがリモートにプッシュされていません。自動プッシュを実行します...'
        );

        // Then: プッシュ失敗エラーメッセージが表示された
        expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ ブランチのプッシュに失敗しました');
        expect(consoleErrorSpy).toHaveBeenCalledWith('\n対応策: 以下のコマンドで手動プッシュしてください:');
        expect(consoleErrorSpy).toHaveBeenCalledWith('  git push -u origin feature/push-failed\n');

        // Then: PR作成は実行されていない
        expect(mockCreatePullRequest).not.toHaveBeenCalled();

        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      });
    });

    describe('正常系: ブランチがリモートにプッシュ済みの場合、即座に PR 作成する', () => {
      test('git ls-remote が成功し、即座に PR 作成が実行される', async () => {
        // Given: Git リポジトリは初期化済み
        mockExecSync.mockImplementation((cmd: string | Buffer) => {
          if (cmd === 'git rev-parse --git-dir') {
            return '' as never;
          }
          if (cmd === 'git rev-parse --abbrev-ref HEAD') {
            return 'feature/already-pushed' as never;
          }
          if (typeof cmd === 'string' && cmd.startsWith('git ls-remote --heads origin')) {
            return 'def456 refs/heads/feature/already-pushed\n' as never;
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
            branch_name: 'feature/already-pushed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute();

        // Given: GitHub 同期レコードが存在する
        await lifecycle.db
          .insertInto('github_sync')
          .values({
            entity_type: 'spec',
            entity_id: specId,
            github_id: '789',
            issue_number: 789,
            issue_url: 'https://github.com/owner/repo/issues/789',
            sync_status: 'success',
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute();

        // Given: createPullRequest が成功を返す
        mockCreatePullRequest.mockResolvedValue({
          success: true,
          pullRequestUrl: 'https://github.com/owner/repo/pull/300',
          pullRequestNumber: 300,
        });

        mockRecordPullRequestToIssue.mockResolvedValue(undefined);

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

        // Then: ブランチプッシュは実行されていない（既にリモートに存在するため）
        expect(consoleLogSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('ブランチがリモートにプッシュされていません')
        );

        // Then: PR作成が実行された
        expect(consoleLogSpy).toHaveBeenCalledWith(
          "\nℹ Creating pull request from 'feature/already-pushed' to 'develop'..."
        );
        expect(mockCreatePullRequest).toHaveBeenCalledWith(lifecycle.db, {
          specId,
          branchName: 'feature/already-pushed',
          defaultBaseBranch: 'develop',
        });

        // Then: PR URL が記録された
        expect(mockRecordPullRequestToIssue).toHaveBeenCalledWith(
          lifecycle.db,
          specId,
          'https://github.com/owner/repo/pull/300'
        );

        consoleLogSpy.mockRestore();
      });
    });

    describe('異常系: 不正なブランチ名の場合、PR 作成をスキップする', () => {
      test('ブランチ名が不正な場合、PR 作成がスキップされ、エラーハンドリングされる', async () => {
        // Given: Git リポジトリは初期化済み
        mockExecSync.mockImplementation((cmd: string | Buffer) => {
          if (cmd === 'git rev-parse --git-dir') {
            return '' as never;
          }
          if (cmd === 'git rev-parse --abbrev-ref HEAD') {
            return 'feature/invalid@branch' as never; // 不正なブランチ名（@ を含む）
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
            branch_name: 'feature/invalid@branch',
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

        // Then: エラーハンドリングされ、警告メッセージが表示される
        expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  Failed to create pull request');

        // Then: PR作成は実行されていない
        expect(mockCreatePullRequest).not.toHaveBeenCalled();

        consoleWarnSpy.mockRestore();
      });
    });

    describe('異常系: github_sync レコードが存在しない場合、警告が表示される', () => {
      test('PR 作成成功後、github_sync レコードがない場合、警告メッセージが表示される', async () => {
        // Given: Git リポジトリは初期化済み
        mockExecSync.mockImplementation((cmd: string | Buffer) => {
          if (cmd === 'git rev-parse --git-dir') {
            return '' as never;
          }
          if (cmd === 'git rev-parse --abbrev-ref HEAD') {
            return 'feature/no-sync-record' as never;
          }
          if (typeof cmd === 'string' && cmd.startsWith('git ls-remote --heads origin')) {
            return 'ghi789 refs/heads/feature/no-sync-record\n' as never;
          }
          throw new Error('Unexpected command');
        });

        // Given: 仕様書が存在するが、github_sync レコードは存在しない
        const specId = randomUUID();
        await lifecycle.db
          .insertInto('specs')
          .values({
            id: specId,
            name: 'Test Spec',
            description: 'Test description',
            phase: 'implementation',
            branch_name: 'feature/no-sync-record',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute();

        // Given: createPullRequest が成功を返す
        mockCreatePullRequest.mockResolvedValue({
          success: true,
          pullRequestUrl: 'https://github.com/owner/repo/pull/400',
          pullRequestNumber: 400,
        });

        mockRecordPullRequestToIssue.mockResolvedValue(undefined);

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

        // Then: PR作成が実行された
        expect(mockCreatePullRequest).toHaveBeenCalledWith(lifecycle.db, {
          specId,
          branchName: 'feature/no-sync-record',
          defaultBaseBranch: 'develop',
        });

        // Then: 成功メッセージが表示された
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '✓ Pull request created: https://github.com/owner/repo/pull/400\n'
        );

        // Then: github_sync レコードがないため、警告メッセージが表示された
        expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  Failed to record PR info to github_sync table');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          `   Spec ID: ${specId} does not have a github_sync record`
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '   Please check if the GitHub Issue was created for this spec\n'
        );

        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
      });
    });

    describe('異常系: PR作成失敗時、printPullRequestError のエラーメッセージ分岐を確認', () => {
      test('GitHub client not initialized エラーの場合、専用のエラーメッセージが表示される', async () => {
        // Given: Git リポジトリは初期化済み
        mockExecSync.mockImplementation((cmd: string | Buffer) => {
          if (cmd === 'git rev-parse --git-dir') {
            return '' as never;
          }
          if (cmd === 'git rev-parse --abbrev-ref HEAD') {
            return 'feature/test' as never;
          }
          if (typeof cmd === 'string' && cmd.startsWith('git ls-remote --heads origin')) {
            return 'abc123 refs/heads/feature/test\n' as never;
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
            branch_name: 'feature/test',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute();

        // Given: createPullRequest が GitHub client not initialized エラーを返す
        mockCreatePullRequest.mockResolvedValue({
          success: false,
          error: 'GitHub client not initialized',
        });

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

        // Then: 専用のエラーメッセージが表示された
        expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  Failed to create pull request');
        expect(consoleWarnSpy).toHaveBeenCalledWith('   Reason: GitHub client not initialized');
        expect(consoleWarnSpy).toHaveBeenCalledWith('\n   対応策: GitHub クライアントを初期化してください');
        expect(consoleWarnSpy).toHaveBeenCalledWith('   /cft:github-init <owner> <repo>');

        consoleWarnSpy.mockRestore();
      });

      test('Repository owner or name not found エラーの場合、専用のエラーメッセージが表示される', async () => {
        // Given: Git リポジトリは初期化済み
        mockExecSync.mockImplementation((cmd: string | Buffer) => {
          if (cmd === 'git rev-parse --git-dir') {
            return '' as never;
          }
          if (cmd === 'git rev-parse --abbrev-ref HEAD') {
            return 'feature/test' as never;
          }
          if (typeof cmd === 'string' && cmd.startsWith('git ls-remote --heads origin')) {
            return 'abc123 refs/heads/feature/test\n' as never;
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
            branch_name: 'feature/test',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute();

        // Given: createPullRequest が Repository owner or name not found エラーを返す
        mockCreatePullRequest.mockResolvedValue({
          success: false,
          error: 'Repository owner or name not found',
        });

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

        // Then: 専用のエラーメッセージが表示された
        expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  Failed to create pull request');
        expect(consoleWarnSpy).toHaveBeenCalledWith('   Reason: Repository owner or name not found');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '\n   対応策: .env ファイルに GITHUB_OWNER と GITHUB_REPO を設定してください'
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith('   例:');
        expect(consoleWarnSpy).toHaveBeenCalledWith('     GITHUB_OWNER=your-username');
        expect(consoleWarnSpy).toHaveBeenCalledWith('     GITHUB_REPO=your-repo-name');

        consoleWarnSpy.mockRestore();
      });

      test('Push 関連のエラーの場合、専用のエラーメッセージが表示される', async () => {
        // Given: Git リポジトリは初期化済み
        mockExecSync.mockImplementation((cmd: string | Buffer) => {
          if (cmd === 'git rev-parse --git-dir') {
            return '' as never;
          }
          if (cmd === 'git rev-parse --abbrev-ref HEAD') {
            return 'feature/test' as never;
          }
          if (typeof cmd === 'string' && cmd.startsWith('git ls-remote --heads origin')) {
            return 'abc123 refs/heads/feature/test\n' as never;
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
            branch_name: 'feature/test',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute();

        // Given: createPullRequest が Push エラーを返す
        mockCreatePullRequest.mockResolvedValue({
          success: false,
          error: 'Failed to push branch',
        });

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

        // Then: 専用のエラーメッセージが表示された
        expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  Failed to create pull request');
        expect(consoleWarnSpy).toHaveBeenCalledWith('   Reason: Failed to push branch');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '\n   対応策: ブランチを手動でプッシュしてから、再度 PR 作成を試してください'
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith('   git push -u origin <branch-name>');

        consoleWarnSpy.mockRestore();
      });
    });
  });
});
