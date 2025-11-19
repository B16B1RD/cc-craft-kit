/**
 * GitHub統合イベントハンドラーのテスト
 */
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { EventBus } from '../../../src/core/workflow/event-bus.js';
import { registerGitHubIntegrationHandlers } from '../../../src/core/workflow/github-integration.js';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';

// GitHub API クライアントのモック
jest.mock('../../../src/integrations/github/client.js');
jest.mock('../../../src/integrations/github/issues.js');
jest.mock('../../../src/integrations/github/projects.js');
jest.mock('../../../src/integrations/github/project-resolver.js');

import { GitHubIssues } from '../../../src/integrations/github/issues.js';
import { GitHubProjects } from '../../../src/integrations/github/projects.js';
import { resolveProjectId } from '../../../src/integrations/github/project-resolver.js';

describe('GitHub Integration Event Handlers', () => {
  let eventBus: EventBus;
  let lifecycle: DatabaseLifecycle;
  let testDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // 環境変数をバックアップ
    originalEnv = { ...process.env };

    // テスト用ディレクトリ作成
    testDir = join(process.cwd(), '.cc-craft-kit-test');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, 'specs'), { recursive: true });

    // テスト用設定ファイル作成
    const config = {
      project: {
        name: 'Test Project',
        initialized_at: new Date().toISOString(),
      },
      github: {
        owner: 'test-owner',
        repo: 'test-repo',
      },
    };
    writeFileSync(join(testDir, 'config.json'), JSON.stringify(config, null, 2));

    // テスト用データベース作成
    lifecycle = await setupDatabaseLifecycle();

    // EventBus作成
    eventBus = new EventBus();

    // ハンドラー登録
    registerGitHubIntegrationHandlers(eventBus, lifecycle.db);

    // 環境変数設定
    process.env.GITHUB_TOKEN = 'test-token';

    // process.cwd() をモック
    jest.spyOn(process, 'cwd').mockReturnValue(testDir);
  });

  afterEach(async () => {
    // EventBus クリア
    eventBus.clear();

    // データベースクリーンアップ
    await lifecycle.cleanup();
    await lifecycle.close();

    // テストディレクトリ削除
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }

    // 環境変数を復元
    process.env = originalEnv;

    // モックをリセット
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('spec.created イベント - Issue自動作成', () => {
    test('仕様書作成時にGitHub Issueが自動作成される', async () => {
      // モックの設定
      const mockIssue = {
        number: 123,
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
        node_id: 'I_test123',
      };

      const MockGitHubIssues = GitHubIssues as jest.MockedClass<typeof GitHubIssues>;
      MockGitHubIssues.prototype.create = jest.fn().mockResolvedValue(mockIssue);

      // 仕様書をデータベースに追加
      const specId = 'spec-test-123';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'requirements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 仕様書ファイル作成
      const specContent = '# Test Spec\n\nTest content';
      writeFileSync(join(testDir, 'specs', `${specId}.md`), specContent);

      // console.logをモック
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // イベント発行
      const event = eventBus.createEvent('spec.created', specId, {
        name: 'Test Spec',
        description: 'Test description',
        phase: 'requirements',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Issue作成が呼ばれたことを確認
      expect(MockGitHubIssues.prototype.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test Spec',
        body: specContent,
        labels: ['phase:requirements'],
      });

      // データベース更新を確認
      const updatedSpec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(updatedSpec?.github_issue_id).toBe(123);

      // 同期ログ記録を確認
      const syncLog = await lifecycle.db
        .selectFrom('github_sync')
        .where('entity_id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(syncLog).toBeDefined();
      expect(syncLog?.github_id).toBe('123');
      expect(syncLog?.sync_status).toBe('success');

      consoleLogSpy.mockRestore();
    });

    test('Issue作成後、Project IDが設定されている場合はProjectに自動追加される', async () => {
      // モックの設定
      const mockIssue = {
        number: 456,
        html_url: 'https://github.com/test-owner/test-repo/issues/456',
        node_id: 'I_test456',
      };

      const mockProject = {
        id: 'PVT_test789',
        number: 1,
      };

      const MockGitHubIssues = GitHubIssues as jest.MockedClass<typeof GitHubIssues>;
      const MockGitHubProjects = GitHubProjects as jest.MockedClass<typeof GitHubProjects>;
      const mockResolveProjectId = resolveProjectId as jest.MockedFunction<typeof resolveProjectId>;

      MockGitHubIssues.prototype.create = jest.fn().mockResolvedValue(mockIssue);
      mockResolveProjectId.mockResolvedValue(1);
      MockGitHubProjects.prototype.get = jest.fn().mockResolvedValue(mockProject);
      MockGitHubProjects.prototype.getIssueNodeId = jest.fn().mockResolvedValue('I_test456');
      MockGitHubProjects.prototype.addItem = jest.fn().mockResolvedValue('PVTI_item123');

      // 仕様書をデータベースに追加
      const specId = 'spec-test-456';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec with Project',
          description: 'Test description',
          phase: 'requirements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 仕様書ファイル作成
      writeFileSync(join(testDir, 'specs', `${specId}.md`), '# Test Spec\n\nTest content');

      // console.logをモック
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // イベント発行
      const event = eventBus.createEvent('spec.created', specId, {
        name: 'Test Spec with Project',
        description: 'Test description',
        phase: 'requirements',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Issue作成が呼ばれたことを確認
      expect(MockGitHubIssues.prototype.create).toHaveBeenCalled();

      // Project追加が呼ばれたことを確認
      expect(mockResolveProjectId).toHaveBeenCalled();
      expect(MockGitHubProjects.prototype.get).toHaveBeenCalledWith('test-owner', 1);
      expect(MockGitHubProjects.prototype.getIssueNodeId).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        456
      );
      expect(MockGitHubProjects.prototype.addItem).toHaveBeenCalledWith({
        projectId: 'PVT_test789',
        contentId: 'I_test456',
      });

      consoleLogSpy.mockRestore();
    });

    test('Project追加失敗時もIssue作成は成功する', async () => {
      // モックの設定
      const mockIssue = {
        number: 789,
        html_url: 'https://github.com/test-owner/test-repo/issues/789',
        node_id: 'I_test789',
      };

      const MockGitHubIssues = GitHubIssues as jest.MockedClass<typeof GitHubIssues>;
      const MockGitHubProjects = GitHubProjects as jest.MockedClass<typeof GitHubProjects>;
      const mockResolveProjectId = resolveProjectId as jest.MockedFunction<typeof resolveProjectId>;

      MockGitHubIssues.prototype.create = jest.fn().mockResolvedValue(mockIssue);
      mockResolveProjectId.mockResolvedValue(1);
      MockGitHubProjects.prototype.get = jest.fn().mockResolvedValue({ id: 'PVT_test', number: 1 });
      MockGitHubProjects.prototype.getIssueNodeId = jest.fn().mockResolvedValue('I_test789');
      MockGitHubProjects.prototype.addItem = jest
        .fn()
        .mockRejectedValue(new Error('Project access denied'));

      // 仕様書をデータベースに追加
      const specId = 'spec-test-789';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec with Project Error',
          description: 'Test description',
          phase: 'requirements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 仕様書ファイル作成
      writeFileSync(join(testDir, 'specs', `${specId}.md`), '# Test Spec\n\nTest content');

      // console.log/warnをモック
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // イベント発行
      const event = eventBus.createEvent('spec.created', specId, {
        name: 'Test Spec with Project Error',
        description: 'Test description',
        phase: 'requirements',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Issue作成が呼ばれたことを確認
      expect(MockGitHubIssues.prototype.create).toHaveBeenCalled();

      // データベース更新を確認（Issue IDは記録されている）
      const updatedSpec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(updatedSpec?.github_issue_id).toBe(789);

      // 警告が表示されたことを確認
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    test('GITHUB_TOKENが未設定の場合はスキップ', async () => {
      // GITHUB_TOKENを削除
      delete process.env.GITHUB_TOKEN;

      const MockGitHubIssues = GitHubIssues as jest.MockedClass<typeof GitHubIssues>;
      MockGitHubIssues.prototype.create = jest.fn();

      // 仕様書をデータベースに追加
      const specId = 'spec-test-no-token';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec No Token',
          description: 'Test description',
          phase: 'requirements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // イベント発行
      const event = eventBus.createEvent('spec.created', specId, {
        name: 'Test Spec No Token',
        description: 'Test description',
        phase: 'requirements',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Issue作成が呼ばれていないことを確認
      expect(MockGitHubIssues.prototype.create).not.toHaveBeenCalled();
    });
  });

  describe('spec.phase_changed イベント - Issueラベル更新', () => {
    test('フェーズ変更時にGitHub Issueのラベルが更新される', async () => {
      const MockGitHubIssues = GitHubIssues as jest.MockedClass<typeof GitHubIssues>;
      MockGitHubIssues.prototype.update = jest.fn().mockResolvedValue({});

      // 仕様書をデータベースに追加（既にIssueが作成されている状態）
      const specId = 'spec-test-phase-change';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec Phase Change',
          description: 'Test description',
          phase: 'design',
          github_issue_id: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // イベント発行
      const event = eventBus.createEvent('spec.phase_changed', specId, {
        oldPhase: 'requirements',
        newPhase: 'design',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Issueラベル更新が呼ばれたことを確認
      expect(MockGitHubIssues.prototype.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 100,
        labels: ['phase:design'],
      });
    });

    test('GitHub Issueが未作成の場合はスキップ', async () => {
      const MockGitHubIssues = GitHubIssues as jest.MockedClass<typeof GitHubIssues>;
      MockGitHubIssues.prototype.update = jest.fn();

      // 仕様書をデータベースに追加（Issueなし）
      const specId = 'spec-test-no-issue';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec No Issue',
          description: 'Test description',
          phase: 'design',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // イベント発行
      const event = eventBus.createEvent('spec.phase_changed', specId, {
        oldPhase: 'requirements',
        newPhase: 'design',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Issueラベル更新が呼ばれていないことを確認
      expect(MockGitHubIssues.prototype.update).not.toHaveBeenCalled();
    });
  });
});
