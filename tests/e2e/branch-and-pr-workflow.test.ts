/**
 * ブランチ自動作成とPR自動作成のE2Eテスト
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/test-database.js';
import type { Kysely } from 'kysely';
import type { Database, SpecPhase } from '../../src/core/database/schema.js';
import { createMockGitHubClient, createMockOctokitResponse } from '../helpers/index.js';
import { EventBus } from '../../src/core/workflow/event-bus.js';
import { registerBranchManagementHandlers } from '../../src/core/workflow/branch-management.js';
import { getCurrentDateTimeForSpec } from '../../src/core/utils/date-format.js';
import { randomUUID } from 'node:crypto';

// GitHub クライアントのモック
jest.mock('../../src/integrations/github/client.js', () => ({
  getGitHubClient: jest.fn(),
}));

// Git コマンドのモック
jest.mock('node:child_process', () => ({
  execSync: jest.fn(),
  spawnSync: jest.fn(),
}));

import { getGitHubClient } from '../../src/integrations/github/client.js';
import { execSync, spawnSync } from 'node:child_process';

describe('Branch and PR Workflow E2E', () => {
  let db: Kysely<Database>;
  let mockClient: ReturnType<typeof createMockGitHubClient>;
  let eventBus: EventBus;

  // ヘルパー関数: 仕様書作成
  async function createSpec(
    name: string,
    description: string
  ): Promise<{ success: boolean; specId?: string }> {
    try {
      const specId = randomUUID();
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name,
          description,
          phase: 'requirements',
          created_at: getCurrentDateTimeForSpec(),
          updated_at: getCurrentDateTimeForSpec(),
        })
        .execute();

      await eventBus.emit(eventBus.createEvent('spec.created', specId, { name, description }));

      return { success: true, specId };
    } catch (error) {
      console.error('createSpec error:', error);
      return { success: false };
    }
  }

  // ヘルパー関数: フェーズ更新
  async function updateSpecPhase(
    specId: string,
    newPhase: SpecPhase
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const spec = await db.selectFrom('specs').where('id', '=', specId).selectAll().executeTakeFirst();
      if (!spec) {
        return { success: false, error: 'Spec not found' };
      }

      const oldPhase = spec.phase;

      await db
        .updateTable('specs')
        .set({ phase: newPhase, updated_at: getCurrentDateTimeForSpec() })
        .where('id', '=', specId)
        .execute();

      await eventBus.emit(eventBus.createEvent('spec.phase_changed', specId, { oldPhase, newPhase }));

      return { success: true };
    } catch (error) {
      console.error('updateSpecPhase error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  beforeEach(async () => {
    db = await createTestDatabase();
    mockClient = createMockGitHubClient();
    (getGitHubClient as jest.MockedFunction<typeof getGitHubClient>).mockReturnValue(mockClient);

    // EventBusを初期化してハンドラーを登録
    eventBus = new EventBus();
    registerBranchManagementHandlers(eventBus, db);

    // Git リポジトリ情報のモック
    (execSync as jest.MockedFunction<typeof execSync>).mockImplementation((cmd: string, options?: any) => {
      // git rev-parse --verify でベースブランチ (develop, main) の場合は成功
      if (cmd === 'git rev-parse --verify develop' || cmd === 'git rev-parse --verify main') {
        return '';
      }
      // その他のブランチは存在しない（例外をスロー）
      if (cmd.startsWith('git rev-parse --verify')) {
        throw new Error('fatal: Needed a single revision');
      }
      if (cmd === 'git config --get remote.origin.url') {
        return 'git@github.com:testowner/testrepo.git\n';
      }
      if (cmd === 'git rev-parse --abbrev-ref HEAD') {
        return 'develop\n';
      }
      if (cmd === 'git rev-parse --git-dir') {
        return '.git\n';
      }
      if (cmd.startsWith('git checkout -b')) {
        return '';
      }
      if (cmd === 'git add .') {
        return '';
      }
      if (cmd.startsWith('git commit')) {
        return '';
      }
      if (options?.stdio === 'ignore') {
        return Buffer.from('');
      }
      return '';
    });

    // spawnSyncのモック
    (spawnSync as jest.MockedFunction<typeof spawnSync>).mockImplementation((cmd: string, args?: readonly string[]) => {
      if (cmd === 'git' && args) {
        if (args[0] === 'checkout' && args[1] === '-b') {
          // git checkout -b <branchName> <baseBranch>
          return { status: 0, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 1, signal: null, output: [] } as any;
        }
        if (args[0] === 'checkout') {
          // git checkout <branchName>
          return { status: 0, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 1, signal: null, output: [] } as any;
        }
        if (args[0] === 'rev-parse' && args[1] === '--verify') {
          // git rev-parse --verify <branchName>
          // ブランチが存在しないことを示すために status: 1 を返す
          return { status: 1, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 1, signal: null, output: [] } as any;
        }
      }
      return { status: 1, stdout: Buffer.from(''), stderr: Buffer.from('Unknown command'), pid: 1, signal: null, output: [] } as any;
    });
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
    jest.clearAllMocks();
  });

  // Note: Feature開発フローのテストは handleBranchCreationOnImplementation 削除により不要になったため削除
  // ブランチ作成は仕様書作成時のみ実行されるようになった

  describe.skip('Feature開発フロー (廃止)', () => {
    test('仕様書作成 → tasks → implementation → completed の完全フロー', async () => {
      // 環境変数をクリア
      delete process.env.GITHUB_OWNER;

      // 1. 仕様書作成（requirements フェーズ）
      const createResult = await createSpec('ユーザー認証機能を追加', 'ユーザー認証機能の実装');

      expect(createResult.success).toBe(true);
      const specId = createResult.specId!;

      // 2. requirements → design
      const designResult = await updateSpecPhase(specId, 'design');
      expect(designResult.success).toBe(true);

      // 3. design → tasks
      const tasksResult = await updateSpecPhase(specId, 'tasks');
      expect(tasksResult.success).toBe(true);

      // 4. tasks → implementation（ブランチ自動作成）
      const implResult = await updateSpecPhase(specId, 'implementation');
      expect(implResult.success).toBe(true);

      // ブランチ作成コマンドが実行されたことを確認
      expect(spawnSync).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['checkout', '-b', expect.stringContaining('feature/')]),
        expect.anything()
      );

      // ブランチ作成後、現在のブランチを feature/ に変更
      (execSync as jest.MockedFunction<typeof execSync>).mockImplementation((cmd: string, options?: any) => {
        if (cmd === 'git rev-parse --verify develop' || cmd === 'git rev-parse --verify main') {
          return '';
        }
        if (cmd.startsWith('git rev-parse --verify')) {
          throw new Error('fatal: Needed a single revision');
        }
        if (cmd === 'git config --get remote.origin.url') {
          return 'git@github.com:testowner/testrepo.git\n';
        }
        if (cmd === 'git rev-parse --abbrev-ref HEAD') {
          return 'feature/userauthfeatureadd\n'; // 作成されたブランチ名
        }
        if (cmd === 'git rev-parse --git-dir') {
          return '.git\n';
        }
        if (cmd.startsWith('git checkout -b')) {
          return '';
        }
        if (cmd === 'git add .') {
          return '';
        }
        if (cmd.startsWith('git commit')) {
          return '';
        }
        if (options?.stdio === 'ignore') {
          return Buffer.from('');
        }
        return '';
      });

      // 5. implementation → completed（PR自動作成）
      mockClient.rest.pulls.create = jest.fn().mockResolvedValue(
        createMockOctokitResponse({
          number: 123,
          html_url: 'https://github.com/testowner/testrepo/pull/123',
          title: 'ユーザー認証機能を追加',
        })
      );

      const completedResult = await updateSpecPhase(specId, 'completed');
      expect(completedResult.success).toBe(true);

      // PR作成が実行されたことを確認
      expect(mockClient.rest.pulls.create).toHaveBeenCalled();

      // PR作成のパラメータを確認
      expect(mockClient.rest.pulls.create).toHaveBeenCalledWith(
        expect.objectContaining({
          base: 'develop',
          head: expect.stringContaining('feature/'),
        })
      );
    }, 30000);
  });

  describe.skip('Hotfix緊急修正フロー (廃止)', () => {
    test('緊急修正はmainブランチから分岐する', async () => {
      // 環境変数をクリア
      delete process.env.GITHUB_OWNER;

      // 現在のブランチをmainに設定
      (execSync as jest.MockedFunction<typeof execSync>).mockImplementation((cmd: string, options?: any) => {
        // git rev-parse --verify でベースブランチ (develop, main) の場合は成功
        if (cmd === 'git rev-parse --verify develop' || cmd === 'git rev-parse --verify main') {
          return '';
        }
        // その他のブランチは存在しない（例外をスロー）
        if (cmd.startsWith('git rev-parse --verify')) {
          throw new Error('fatal: Needed a single revision');
        }
        if (cmd === 'git config --get remote.origin.url') {
          return 'git@github.com:testowner/testrepo.git\n';
        }
        if (cmd === 'git rev-parse --abbrev-ref HEAD') {
          return 'main\n';
        }
        if (cmd === 'git rev-parse --git-dir') {
          return '.git\n';
        }
        if (cmd.startsWith('git checkout -b')) {
          return '';
        }
        if (cmd === 'git add .') {
          return '';
        }
        if (cmd.startsWith('git commit')) {
          return '';
        }
        if (options?.stdio === 'ignore') {
          return Buffer.from('');
        }
        return '';
      });

      // 1. 緊急修正の仕様書作成
      const createResult = await createSpec(
        '緊急対応: 本番環境の重大なバグ修正',
        '本番環境で発生した重大なバグの緊急修正'
      );

      expect(createResult.success).toBe(true);
      const specId = createResult.specId!;

      // 2. requirements → design → tasks
      await updateSpecPhase(specId, 'design');
      await updateSpecPhase(specId, 'tasks');

      // 3. tasks → implementation（hotfixブランチ自動作成）
      const implResult = await updateSpecPhase(specId, 'implementation');
      expect(implResult.success).toBe(true);

      // hotfix/ プレフィックスのブランチが作成されたことを確認
      expect(spawnSync).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['checkout', '-b', expect.stringContaining('hotfix/')]),
        expect.anything()
      );

      // ブランチ作成後、現在のブランチを hotfix/ に変更
      (execSync as jest.MockedFunction<typeof execSync>).mockImplementation((cmd: string, options?: any) => {
        if (cmd === 'git rev-parse --verify develop' || cmd === 'git rev-parse --verify main') {
          return '';
        }
        if (cmd.startsWith('git rev-parse --verify')) {
          throw new Error('fatal: Needed a single revision');
        }
        if (cmd === 'git config --get remote.origin.url') {
          return 'git@github.com:testowner/testrepo.git\n';
        }
        if (cmd === 'git rev-parse --abbrev-ref HEAD') {
          return 'hotfix/productionenvbug\n'; // 作成されたhotfixブランチ名
        }
        if (cmd === 'git rev-parse --git-dir') {
          return '.git\n';
        }
        if (cmd.startsWith('git checkout -b')) {
          return '';
        }
        if (cmd === 'git add .') {
          return '';
        }
        if (cmd.startsWith('git commit')) {
          return '';
        }
        if (options?.stdio === 'ignore') {
          return Buffer.from('');
        }
        return '';
      });

      // 4. implementation → completed（mainへのPR作成）
      mockClient.rest.pulls.create = jest.fn().mockResolvedValue(
        createMockOctokitResponse({
          number: 456,
          html_url: 'https://github.com/testowner/testrepo/pull/456',
          title: '緊急対応: 本番環境の重大なバグ修正',
        })
      );

      const completedResult = await updateSpecPhase(specId, 'completed');
      expect(completedResult.success).toBe(true);

      // mainブランチへのPR作成が実行されたことを確認
      expect(mockClient.rest.pulls.create).toHaveBeenCalledWith(
        expect.objectContaining({
          base: 'main',
          head: expect.stringContaining('hotfix/'),
        })
      );
    }, 30000);
  });

  describe('エラーハンドリング', () => {
    test.skip('ブランチ作成失敗時、フェーズをロールバックする (廃止: ブランチ作成は仕様書作成時のみ)', async () => {
      // spawnSyncのモックをオーバーライドしてブランチ作成を失敗させる
      (spawnSync as jest.MockedFunction<typeof spawnSync>).mockImplementation((cmd: string, args?: readonly string[]) => {
        if (cmd === 'git' && args) {
          if (args[0] === 'checkout' && args[1] === '-b') {
            // ブランチ作成失敗をシミュレート
            return { status: 1, stdout: Buffer.from(''), stderr: Buffer.from('Failed to create branch'), pid: 1, signal: null, output: [] } as any;
          }
          if (args[0] === 'rev-parse' && args[1] === '--verify') {
            // ブランチが存在しない
            return { status: 1, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 1, signal: null, output: [] } as any;
          }
        }
        return { status: 1, stdout: Buffer.from(''), stderr: Buffer.from('Unknown command'), pid: 1, signal: null, output: [] } as any;
      });

      // 仕様書作成
      const createResult = await createSpec('テスト仕様書', 'テスト用の仕様書');
      const specId = createResult.specId!;

      // requirements → design → tasks
      await updateSpecPhase(specId, 'design');
      await updateSpecPhase(specId, 'tasks');

      // tasks → implementation（ブランチ作成失敗）
      const implResult = await updateSpecPhase(specId, 'implementation');

      // ヘルパー関数は成功を返す（イベントハンドラー内のエラーはキャッチされる）
      expect(implResult.success).toBe(true);

      // しかし、フェーズはロールバックされてtasksのまま
      const spec = await db.selectFrom('specs').where('id', '=', specId).selectAll().executeTakeFirst();
      expect(spec?.phase).toBe('tasks');
    }, 30000);

    test('PR作成失敗時でも、フェーズはcompletedに移行する', async () => {
      // 環境変数をクリア
      delete process.env.GITHUB_OWNER;

      // 仕様書作成
      const createResult = await createSpec('テスト仕様書', 'テスト用の仕様書');
      const specId = createResult.specId!;

      // requirements → design → tasks → implementation
      await updateSpecPhase(specId, 'design');
      await updateSpecPhase(specId, 'tasks');
      await updateSpecPhase(db, specId, 'implementation');

      // PR作成を失敗させる
      mockClient.rest.pulls.create = jest.fn().mockRejectedValue(new Error('API Error'));

      // implementation → completed
      const completedResult = await updateSpecPhase(specId, 'completed');

      // フェーズ更新は成功（PR作成失敗してもcompletedに移行）
      expect(completedResult.success).toBe(true);

      const spec = await db.selectFrom('specs').where('id', '=', specId).selectAll().executeTakeFirst();
      expect(spec?.phase).toBe('completed');
    }, 30000);
  });

  describe.skip('保護ブランチチェック (廃止)', () => {
    test('mainブランチで直接作業している場合、警告を表示する', async () => {
      // 現在のブランチをmainに設定
      (execSync as jest.MockedFunction<typeof execSync>).mockImplementation((cmd: string, options?: any) => {
        // git rev-parse --verify でベースブランチ (develop, main) の場合は成功
        if (cmd === 'git rev-parse --verify develop' || cmd === 'git rev-parse --verify main') {
          return '';
        }
        // その他のブランチは存在しない（例外をスロー）
        if (cmd.startsWith('git rev-parse --verify')) {
          throw new Error('fatal: Needed a single revision');
        }
        if (cmd === 'git rev-parse --abbrev-ref HEAD') {
          return 'main\n';
        }
        if (cmd === 'git rev-parse --git-dir') {
          return '.git\n';
        }
        if (options?.stdio === 'ignore') {
          return Buffer.from('');
        }
        return '';
      });

      // 仕様書作成（hotfixではない通常の機能開発）
      const createResult = await createSpec('新機能の追加', '通常の機能開発');
      const specId = createResult.specId!;

      // requirements → design → tasks
      await updateSpecPhase(specId, 'design');
      await updateSpecPhase(specId, 'tasks');

      // tasks → implementation
      // 保護ブランチで作業していることを警告するが、処理は続行
      const implResult = await updateSpecPhase(specId, 'implementation');
      expect(implResult.success).toBe(true);

      // ブランチ作成は実行される
      expect(spawnSync).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['checkout', '-b', expect.stringContaining('feature/')]),
        expect.anything()
      );
    }, 30000);
  });
});
