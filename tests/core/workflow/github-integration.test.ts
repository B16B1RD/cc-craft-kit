/**
 * GitHub統合イベントハンドラーのテスト
 */
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { EventBus } from '../../../src/core/workflow/event-bus.js';
import { registerGitHubIntegrationHandlers } from '../../../src/core/workflow/github-integration.js';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';

// モックインスタンスを定義（const ではなく let を使用）
let mockGitHubIssues: {
  create: jest.Mock;
  get: jest.Mock;
  update: jest.Mock;
  addComment: jest.Mock;
  close: jest.Mock;
};

let mockGitHubProjects: {
  get: jest.Mock;
  getIssueNodeId: jest.Mock;
  addItem: jest.Mock;
  updateProjectStatus: jest.Mock;
  verifyProjectStatusUpdate: jest.Mock;
};

let mockSubIssueManager: {
  createSubIssuesFromTaskList: jest.Mock;
  updateSubIssueStatus: jest.Mock;
};

let mockResolveProjectId: jest.Mock;
let mockParseTaskListFromSpec: jest.Mock;

// モックファクトリー関数を定義
const createMockGitHubIssues = () => ({
  create: jest.fn(),
  get: jest.fn(),
  update: jest.fn(),
  addComment: jest.fn(),
  close: jest.fn(),
});

const createMockGitHubProjects = () => ({
  get: jest.fn(),
  getIssueNodeId: jest.fn(),
  addItem: jest.fn(),
  updateProjectStatus: jest.fn(),
  verifyProjectStatusUpdate: jest.fn(),
});

const createMockSubIssueManager = () => ({
  createSubIssuesFromTaskList: jest.fn(),
  updateSubIssueStatus: jest.fn(),
});

// GitHub API クライアントのモック
jest.mock('../../../src/integrations/github/client.js', () => ({
  GitHubClient: jest.fn().mockImplementation(() => ({})),
}));

// グローバルスコープでモックオブジェクトを定義
const sharedMockGitHubIssues = {
  create: jest.fn(),
  get: jest.fn(),
  update: jest.fn(),
  addComment: jest.fn(),
  close: jest.fn(),
};

const sharedMockGitHubProjects = {
  get: jest.fn(),
  getIssueNodeId: jest.fn(),
  addItem: jest.fn(),
  updateProjectStatus: jest.fn(),
  verifyProjectStatusUpdate: jest.fn(),
};

jest.mock('../../../src/integrations/github/issues.js', () => ({
  GitHubIssues: jest.fn().mockImplementation(() => sharedMockGitHubIssues),
}));

jest.mock('../../../src/integrations/github/projects.js', () => ({
  GitHubProjects: jest.fn().mockImplementation(() => sharedMockGitHubProjects),
}));

jest.mock('../../../src/integrations/github/project-resolver.js', () => ({
  resolveProjectId: (...args: unknown[]) => mockResolveProjectId(...args),
}));

jest.mock('../../../src/integrations/github/sub-issues.js', () => ({
  SubIssueManager: jest.fn().mockImplementation(() => mockSubIssueManager),
}));

// GitHubSyncService のモック
jest.mock('../../../src/integrations/github/sync.js', () => ({
  GitHubSyncService: jest.fn().mockImplementation((db, issues, projects) => ({
    syncSpecToIssue: async ({ specId, owner, repo, createIfNotExists }: { specId: string; owner: string; repo: string; createIfNotExists: boolean }) => {
      // モックの create メソッドを呼び出す
      const spec = await db.selectFrom('specs').where('id', '=', specId).selectAll().executeTakeFirst();
      if (!spec) throw new Error('Spec not found');

      const specFilePath = join(process.cwd(), 'specs', `${specId}.md`);
      const specContent = existsSync(specFilePath) ? require('fs').readFileSync(specFilePath, 'utf-8') : `# ${spec.name}`;

      const mockIssue = await issues.create({
        owner,
        repo,
        title: spec.name,
        body: specContent,
        labels: [`phase:${spec.phase}`],
      });

      // github_sync レコード作成
      await db.insertInto('github_sync').values({
        entity_type: 'spec',
        entity_id: specId,
        github_id: String(mockIssue.number),
        github_number: mockIssue.number,
        github_node_id: mockIssue.node_id,
        sync_status: 'success',
        synced_at: new Date().toISOString(),
      }).execute();

      return mockIssue.number;
    },
    addSpecToProject: async ({ specId, owner, projectNumber }: { specId: string; owner: string; projectNumber: number }) => {
      const spec = await db.selectFrom('specs').where('id', '=', specId).selectAll().executeTakeFirst();
      if (!spec) throw new Error('Spec not found');

      const syncRecord = await db.selectFrom('github_sync').where('entity_id', '=', specId).where('entity_type', '=', 'spec').selectAll().executeTakeFirst();
      if (!syncRecord) throw new Error('Sync record not found');

      const project = await projects.get(owner, projectNumber);
      const nodeId = await projects.getIssueNodeId(owner, String(syncRecord.github_number));
      const item = await projects.addItem(project.id, nodeId);

      return item.id;
    },
    updateIssueLabels: async ({ specId, owner, repo, labels }: { specId: string; owner: string; repo: string; labels: string[] }) => {
      const syncRecord = await db.selectFrom('github_sync').where('entity_id', '=', specId).where('entity_type', '=', 'spec').selectAll().executeTakeFirst();
      if (!syncRecord) throw new Error('Sync record not found');

      await issues.update({
        owner,
        repo,
        issueNumber: syncRecord.github_number,
        labels,
      });
    },
  })),
}));

jest.mock('../../../src/core/utils/task-parser.js', () => ({
  parseTaskListFromSpec: (...args: unknown[]) => mockParseTaskListFromSpec(...args),
}));

describe.skip('GitHub Integration Event Handlers', () => {
  let eventBus: EventBus;
  let lifecycle: DatabaseLifecycle;
  let testDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // 環境変数をバックアップ
    originalEnv = { ...process.env };

    // テスト用ディレクトリ作成
    testDir = join(process.cwd(), 'test-workspace-github-integration');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // 両方のディレクトリ構造をサポート
    mkdirSync(join(testDir, 'specs'), { recursive: true }); // spec.created テスト用
    const ccCraftKitDir = join(testDir, '.cc-craft-kit');
    mkdirSync(ccCraftKitDir, { recursive: true });
    mkdirSync(join(ccCraftKitDir, 'specs'), { recursive: true });

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
    writeFileSync(join(ccCraftKitDir, 'config.json'), JSON.stringify(config, null, 2));

    // テスト用データベース作成
    lifecycle = await setupDatabaseLifecycle();

    // モックインスタンスを初期化（共有モックを使用）
    mockGitHubIssues = sharedMockGitHubIssues;
    mockGitHubProjects = sharedMockGitHubProjects;
    mockSubIssueManager = createMockSubIssueManager();
    mockResolveProjectId = jest.fn();
    mockParseTaskListFromSpec = jest.fn();

    // 共有モックをクリア
    Object.values(sharedMockGitHubIssues).forEach((mock) => mock.mockClear());
    Object.values(sharedMockGitHubProjects).forEach((mock) => mock.mockClear());

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

      mockGitHubIssues.create.mockResolvedValue(mockIssue);

      // 仕様書をデータベースに追加
      const specId = 'spec-test-123';
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
      expect(mockGitHubIssues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test Spec',
        body: specContent,
        labels: ['phase:requirements'],
      });

      // github_sync レコードを確認
      const syncRecord = await lifecycle.db
        .selectFrom('github_sync')
        .where('entity_id', '=', specId)
        .where('entity_type', '=', 'spec')
        .selectAll()
        .executeTakeFirst();

      expect(syncRecord?.github_number).toBe(123);

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

      mockGitHubIssues.create.mockResolvedValue(mockIssue);
      mockResolveProjectId.mockResolvedValue(1);
      mockGitHubProjects.get.mockResolvedValue(mockProject);
      mockGitHubProjects.getIssueNodeId.mockResolvedValue('I_test456');
      mockGitHubProjects.addItem.mockResolvedValue({ id: 'PVTI_item123' });

      // 仕様書をデータベースに追加
      const specId = 'spec-test-456';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec with Project',
          description: 'Test description',
          phase: 'requirements',
          branch_name: 'feature/test',
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
      expect(mockGitHubIssues.create).toHaveBeenCalled();

      // Project追加が呼ばれたことを確認
      expect(mockResolveProjectId).toHaveBeenCalled();
      expect(mockGitHubProjects.get).toHaveBeenCalledWith('test-owner', 1);
      expect(mockGitHubProjects.getIssueNodeId).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        456
      );
      expect(mockGitHubProjects.addItem).toHaveBeenCalledWith({
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

      mockGitHubIssues.create.mockResolvedValue(mockIssue);
      mockResolveProjectId.mockResolvedValue(1);
      mockGitHubProjects.get.mockResolvedValue({ id: 'PVT_test', number: 1 });
      mockGitHubProjects.getIssueNodeId.mockResolvedValue('I_test789');
      mockGitHubProjects.addItem.mockRejectedValue(new Error('Project access denied'));

      // 仕様書をデータベースに追加
      const specId = 'spec-test-789';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec with Project Error',
          description: 'Test description',
          phase: 'requirements',
          branch_name: 'feature/test',
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
      expect(mockGitHubIssues.create).toHaveBeenCalled();

      // github_sync レコードを確認（Issue IDは記録されている）
      const syncRecord = await lifecycle.db
        .selectFrom('github_sync')
        .where('entity_id', '=', specId)
        .where('entity_type', '=', 'spec')
        .selectAll()
        .executeTakeFirst();

      expect(syncRecord?.github_number).toBe(789);

      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    test('GITHUB_TOKENが未設定の場合はスキップ', async () => {
      // GITHUB_TOKENを削除
      delete process.env.GITHUB_TOKEN;

      mockGitHubIssues.create.mockClear();

      // 仕様書をデータベースに追加
      const specId = 'spec-test-no-token';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec No Token',
          description: 'Test description',
          phase: 'requirements',
          branch_name: 'feature/test',
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
      expect(mockGitHubIssues.create).not.toHaveBeenCalled();
    });
  });

  describe('spec.phase_changed イベント - Issueラベル更新', () => {
    test('フェーズ変更時にGitHub Issueのラベルが更新される', async () => {
      mockGitHubIssues.update.mockResolvedValue({});

      // 仕様書をデータベースに追加（既にIssueが作成されている状態）
      const specId = 'spec-test-phase-change';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec Phase Change',
          description: 'Test description',
          phase: 'design',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: specId,
          github_id: '100',
          github_number: 100,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // console.logをモック
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // イベント発行
      const event = eventBus.createEvent('spec.phase_changed', specId, {
        oldPhase: 'requirements',
        newPhase: 'design',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Issueラベル更新が呼ばれたことを確認
      expect(mockGitHubIssues.update).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          issueNumber: 100,
          labels: ['phase:design'],
        })
      );

      consoleLogSpy.mockRestore();
    });

    test('GitHub Issueが未作成の場合はスキップ', async () => {
      mockGitHubIssues.update.mockClear();

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
      expect(mockGitHubIssues.update).not.toHaveBeenCalled();
    });

    test('フェーズ変更時に仕様書ファイルから Issue 本文が更新される', async () => {
      // 既存の Issue 本文をモック
      const oldContent = '# Test Spec\n\nOld content.';
      mockGitHubIssues.get.mockResolvedValue({ body: oldContent });
      mockGitHubIssues.update.mockResolvedValue({});
      mockGitHubIssues.addComment.mockResolvedValue({});

      // 仕様書をデータベースに追加
      const specId = 'spec-test-body-update';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec Body Update',
          description: 'Test description',
          phase: 'design',
          branch_name: 'feature/test-body',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: specId,
          github_id: '101',
          github_number: 101,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // 仕様書ファイルを作成
      const ccCraftKitDir = join(process.cwd(), '.cc-craft-kit');
      const specsDir = join(ccCraftKitDir, 'specs');
      if (!existsSync(specsDir)) {
        mkdirSync(specsDir, { recursive: true });
      }
      const specPath = join(specsDir, `${specId}.md`);
      const specContent = '# Test Spec\n\nThis is the updated spec content.';
      writeFileSync(specPath, specContent, 'utf-8');

      // console.logをモック
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // イベント発行
      const event = eventBus.createEvent('spec.phase_changed', specId, {
        oldPhase: 'requirements',
        newPhase: 'design',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Issueラベル・本文更新が呼ばれたことを確認
      expect(mockGitHubIssues.update).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          issueNumber: 101,
          title: '[design] Test Spec Body Update',
          labels: ['phase:design'],
          body: specContent,
        })
      );

      // addComment が呼ばれたことを確認（フェーズ移行コメント + 変更履歴コメント）
      // 変更があるので、2回呼ばれるはず
      expect(mockGitHubIssues.addComment).toHaveBeenCalled();

      // クリーンアップ
      rmSync(specPath);
      consoleLogSpy.mockRestore();
    });

    test('フェーズ変更時に変更履歴コメントが追加される', async () => {
      // 既存の Issue 本文をモック（変更あり）
      const oldContent = '# Test Spec\n\n## 1. 背景と目的\n\nOld background.';
      const newContent = '# Test Spec\n\n## 1. 背景と目的\n\nNew background with changes.';
      mockGitHubIssues.get.mockResolvedValue({ body: oldContent });
      mockGitHubIssues.update.mockResolvedValue({});
      mockGitHubIssues.addComment.mockResolvedValue({});

      // 仕様書をデータベースに追加
      const specId = 'spec-test-changelog';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec Changelog',
          description: 'Test description',
          phase: 'design',
          branch_name: 'feature/test-changelog',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: specId,
          github_id: '103',
          github_number: 103,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // 仕様書ファイルを作成
      const ccCraftKitDir = join(process.cwd(), '.cc-craft-kit');
      const specsDir = join(ccCraftKitDir, 'specs');
      if (!existsSync(specsDir)) {
        mkdirSync(specsDir, { recursive: true });
      }
      const specPath = join(specsDir, `${specId}.md`);
      writeFileSync(specPath, newContent, 'utf-8');

      // console.logをモック
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // イベント発行
      const event = eventBus.createEvent('spec.phase_changed', specId, {
        oldPhase: 'requirements',
        newPhase: 'design',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // addComment が2回呼ばれたことを確認（フェーズ移行 + 変更履歴）
      expect(mockGitHubIssues.addComment).toHaveBeenCalledTimes(2);

      // 1回目: フェーズ移行コメント
      expect(mockGitHubIssues.addComment).toHaveBeenNthCalledWith(
        1,
        'test-owner',
        'test-repo',
        103,
        expect.stringContaining('🔄 フェーズ移行')
      );

      // 2回目: 変更履歴コメント
      expect(mockGitHubIssues.addComment).toHaveBeenNthCalledWith(
        2,
        'test-owner',
        'test-repo',
        103,
        expect.stringContaining('📝 仕様書更新')
      );

      // クリーンアップ
      rmSync(specPath);
      consoleLogSpy.mockRestore();
    });

    test('変更がない場合は変更履歴コメントが追加されない', async () => {
      // 既存の Issue 本文と同じ内容をモック
      const sameContent = '# Test Spec\n\nSame content.';
      mockGitHubIssues.get.mockResolvedValue({ body: sameContent });
      mockGitHubIssues.update.mockResolvedValue({});
      mockGitHubIssues.addComment.mockResolvedValue({});

      // 仕様書をデータベースに追加
      const specId = 'spec-test-no-changelog';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec No Changelog',
          description: 'Test description',
          phase: 'design',
          branch_name: 'feature/test-no-changelog',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: specId,
          github_id: '104',
          github_number: 104,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // 仕様書ファイルを作成（同じ内容）
      const ccCraftKitDir = join(process.cwd(), '.cc-craft-kit');
      const specsDir = join(ccCraftKitDir, 'specs');
      if (!existsSync(specsDir)) {
        mkdirSync(specsDir, { recursive: true });
      }
      const specPath = join(specsDir, `${specId}.md`);
      writeFileSync(specPath, sameContent, 'utf-8');

      // console.logをモック
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // イベント発行
      const event = eventBus.createEvent('spec.phase_changed', specId, {
        oldPhase: 'requirements',
        newPhase: 'design',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // addComment が1回のみ呼ばれたことを確認（フェーズ移行コメントのみ）
      expect(mockGitHubIssues.addComment).toHaveBeenCalledTimes(1);

      // フェーズ移行コメントのみ
      expect(mockGitHubIssues.addComment).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        104,
        expect.stringContaining('🔄 フェーズ移行')
      );

      // クリーンアップ
      rmSync(specPath);
      consoleLogSpy.mockRestore();
    });

    test('仕様書ファイルが存在しない場合は既存の Issue 本文を維持する', async () => {
      const existingBody = '# Existing Spec Content\n\nOriginal content.';
      mockGitHubIssues.get.mockResolvedValue({ body: existingBody });
      mockGitHubIssues.update.mockResolvedValue({});

      // 仕様書をデータベースに追加
      const specId = 'spec-test-no-file';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec No File',
          description: 'Test description',
          phase: 'design',
          branch_name: 'feature/test-no-file',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: specId,
          github_id: '102',
          github_number: 102,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // console.logをモック
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // イベント発行
      const event = eventBus.createEvent('spec.phase_changed', specId, {
        oldPhase: 'requirements',
        newPhase: 'design',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Issueラベル更新が呼ばれたことを確認（body は既存の内容を維持）
      expect(mockGitHubIssues.update).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          issueNumber: 102,
          title: '[design] Test Spec No File',
          labels: ['phase:design'],
          body: existingBody,
        })
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('spec.deleted イベント - GitHub Projects ステータス更新', () => {
    test('仕様書削除時にGitHub Projectsのステータスが"Done"に更新される', async () => {
      mockGitHubProjects.updateProjectStatus.mockResolvedValue(undefined);
      mockGitHubProjects.verifyProjectStatusUpdate.mockResolvedValue({
        success: true,
        attempts: 1,
      });
      mockResolveProjectId.mockResolvedValue(1);

      // 仕様書をデータベースに追加
      const specId = 'spec-test-deleted';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec Deleted',
          description: 'Test description',
          phase: 'implementation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成（project）
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'project',
          entity_id: specId,
          github_id: 'PVTI_project_item_id',
          github_number: null,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // console.logをモック
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // イベント発行
      const event = eventBus.createEvent('spec.deleted', specId, {
        name: 'Test Spec Deleted',
        phase: 'implementation',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Project ステータス更新が呼ばれたことを確認
      expect(mockGitHubProjects.updateProjectStatus).toHaveBeenCalledWith({
        owner: 'test-owner',
        projectNumber: 1,
        itemId: 'PVTI_project_item_id',
        status: 'Done',
      });

      // ステータス更新検証が呼ばれたことを確認
      expect(mockGitHubProjects.verifyProjectStatusUpdate).toHaveBeenCalledWith({
        owner: 'test-owner',
        projectNumber: 1,
        itemId: 'PVTI_project_item_id',
        expectedStatus: 'Done',
        maxRetries: 3,
      });

      consoleLogSpy.mockRestore();
    });

    test('GitHub Projectに追加されていない場合はスキップ', async () => {
      mockGitHubProjects.updateProjectStatus.mockClear();
      mockGitHubProjects.verifyProjectStatusUpdate.mockClear();

      // 仕様書をデータベースに追加（Projectなし）
      const specId = 'spec-test-no-project';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec No Project',
          description: 'Test description',
          phase: 'implementation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // イベント発行
      const event = eventBus.createEvent('spec.deleted', specId, {
        name: 'Test Spec No Project',
        phase: 'implementation',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Project ステータス更新が呼ばれていないことを確認
      expect(mockGitHubProjects.updateProjectStatus).not.toHaveBeenCalled();
      expect(mockGitHubProjects.verifyProjectStatusUpdate).not.toHaveBeenCalled();
    });

    test('Project番号が解決できない場合はスキップ', async () => {
      mockGitHubProjects.updateProjectStatus.mockClear();
      mockGitHubProjects.verifyProjectStatusUpdate.mockClear();
      mockResolveProjectId.mockResolvedValue(null);

      // 仕様書をデータベースに追加
      const specId = 'spec-test-no-project-number';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec No Project Number',
          description: 'Test description',
          phase: 'implementation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成（project）
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'project',
          entity_id: specId,
          github_id: 'PVTI_project_item_id',
          github_number: null,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // イベント発行
      const event = eventBus.createEvent('spec.deleted', specId, {
        name: 'Test Spec No Project Number',
        phase: 'implementation',
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Project ステータス更新が呼ばれていないことを確認
      expect(mockGitHubProjects.updateProjectStatus).not.toHaveBeenCalled();
      expect(mockGitHubProjects.verifyProjectStatusUpdate).not.toHaveBeenCalled();
    });

    test('GitHub API エラー時も処理を続行', async () => {
      mockGitHubProjects.updateProjectStatus.mockRejectedValue(
        new Error('GitHub API error')
      );
      mockResolveProjectId.mockResolvedValue(1);

      // 仕様書をデータベースに追加
      const specId = 'spec-test-api-error';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec API Error',
          description: 'Test description',
          phase: 'implementation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成（project）
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'project',
          entity_id: specId,
          github_id: 'PVTI_project_item_id',
          github_number: null,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // イベント発行（エラーがスローされないことを確認）
      const event = eventBus.createEvent('spec.deleted', specId, {
        name: 'Test Spec API Error',
        phase: 'implementation',
      });
      await expect(eventBus.emit(event)).resolves.not.toThrow();

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Project ステータス更新が呼ばれたことを確認（エラーでも試行される）
      expect(mockGitHubProjects.updateProjectStatus).toHaveBeenCalled();
    });
  });

  describe('spec.pr_merged イベント - GitHub Projects ステータスを Done に更新', () => {
    test('PR マージ時に GitHub Projects のステータスが "Done" に更新される', async () => {
      mockGitHubProjects.updateProjectStatus.mockResolvedValue(undefined);
      mockGitHubProjects.verifyProjectStatusUpdate.mockResolvedValue({
        success: true,
        actualStatus: 'Done',
        attempts: 1,
      });
      mockResolveProjectId.mockResolvedValue(1);

      // 仕様書をデータベースに追加
      const specId = 'spec-test-pr-merged';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec PR Merged',
          description: 'Test description',
          phase: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成（project）
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'project',
          entity_id: specId,
          github_id: 'PVTI_pr_merged_item_id',
          github_number: null,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // console.logをモック
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // イベント発行
      const event = eventBus.createEvent('spec.pr_merged', specId, {
        prNumber: 42,
        branchName: 'feature/test',
        mergedAt: new Date().toISOString(),
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Project ステータス更新が呼ばれたことを確認
      expect(mockGitHubProjects.updateProjectStatus).toHaveBeenCalledWith({
        owner: 'test-owner',
        projectNumber: 1,
        itemId: 'PVTI_pr_merged_item_id',
        status: 'Done',
      });

      // ステータス更新検証が呼ばれたことを確認
      expect(mockGitHubProjects.verifyProjectStatusUpdate).toHaveBeenCalledWith({
        owner: 'test-owner',
        projectNumber: 1,
        itemId: 'PVTI_pr_merged_item_id',
        expectedStatus: 'Done',
        maxRetries: 3,
      });

      consoleLogSpy.mockRestore();
    });

    test('GitHub Project に追加されていない場合はスキップ', async () => {
      mockGitHubProjects.updateProjectStatus.mockClear();
      mockGitHubProjects.verifyProjectStatusUpdate.mockClear();

      // 仕様書をデータベースに追加（Project なし）
      const specId = 'spec-test-pr-merged-no-project';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec PR Merged No Project',
          description: 'Test description',
          phase: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // イベント発行
      const event = eventBus.createEvent('spec.pr_merged', specId, {
        prNumber: 43,
        branchName: 'feature/test-no-project',
        mergedAt: new Date().toISOString(),
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Project ステータス更新が呼ばれていないことを確認
      expect(mockGitHubProjects.updateProjectStatus).not.toHaveBeenCalled();
      expect(mockGitHubProjects.verifyProjectStatusUpdate).not.toHaveBeenCalled();
    });

    test('Project 番号が解決できない場合はスキップ', async () => {
      mockGitHubProjects.updateProjectStatus.mockClear();
      mockGitHubProjects.verifyProjectStatusUpdate.mockClear();
      mockResolveProjectId.mockResolvedValue(null);

      // 仕様書をデータベースに追加
      const specId = 'spec-test-pr-merged-no-project-number';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec PR Merged No Project Number',
          description: 'Test description',
          phase: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成（project）
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'project',
          entity_id: specId,
          github_id: 'PVTI_pr_merged_item_id',
          github_number: null,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // イベント発行
      const event = eventBus.createEvent('spec.pr_merged', specId, {
        prNumber: 44,
        branchName: 'feature/test-no-project-number',
        mergedAt: new Date().toISOString(),
      });
      await eventBus.emit(event);

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Project ステータス更新が呼ばれていないことを確認
      expect(mockGitHubProjects.updateProjectStatus).not.toHaveBeenCalled();
      expect(mockGitHubProjects.verifyProjectStatusUpdate).not.toHaveBeenCalled();
    });

    test('GitHub API エラー時も処理を続行', async () => {
      mockGitHubProjects.updateProjectStatus.mockRejectedValue(
        new Error('GitHub API error')
      );
      mockResolveProjectId.mockResolvedValue(1);

      // 仕様書をデータベースに追加
      const specId = 'spec-test-pr-merged-api-error';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec PR Merged API Error',
          description: 'Test description',
          phase: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成（project）
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'project',
          entity_id: specId,
          github_id: 'PVTI_pr_merged_api_error',
          github_number: null,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // イベント発行（エラーがスローされないことを確認）
      const event = eventBus.createEvent('spec.pr_merged', specId, {
        prNumber: 45,
        branchName: 'feature/test-api-error',
        mergedAt: new Date().toISOString(),
      });
      await expect(eventBus.emit(event)).resolves.not.toThrow();

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Project ステータス更新が呼ばれたことを確認（エラーでも試行される）
      expect(mockGitHubProjects.updateProjectStatus).toHaveBeenCalled();
    });

    test('検証失敗時も警告のみで処理を続行', async () => {
      mockGitHubProjects.updateProjectStatus.mockResolvedValue(undefined);
      mockGitHubProjects.verifyProjectStatusUpdate.mockResolvedValue({
        success: false,
        actualStatus: 'In Review',
        attempts: 3,
      });
      mockResolveProjectId.mockResolvedValue(1);

      // 仕様書をデータベースに追加
      const specId = 'spec-test-pr-merged-verify-fail';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec PR Merged Verify Fail',
          description: 'Test description',
          phase: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成（project）
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'project',
          entity_id: specId,
          github_id: 'PVTI_pr_merged_verify_fail',
          github_number: null,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // console.warnをモック
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // イベント発行（エラーがスローされないことを確認）
      const event = eventBus.createEvent('spec.pr_merged', specId, {
        prNumber: 46,
        branchName: 'feature/test-verify-fail',
        mergedAt: new Date().toISOString(),
      });
      await expect(eventBus.emit(event)).resolves.not.toThrow();

      // 少し待つ（非同期処理完了待ち）
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 検証が呼ばれたことを確認
      expect(mockGitHubProjects.verifyProjectStatusUpdate).toHaveBeenCalled();

      // 警告が出力されたことを確認
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to verify project status update')
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
