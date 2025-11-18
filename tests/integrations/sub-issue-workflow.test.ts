/**
 * Sub Issue ワークフロー E2E 統合テスト
 * 仕様書フェーズ移行から Sub Issue 作成までの完全なワークフローを検証
 */
import 'reflect-metadata';
import { Kysely } from 'kysely';
import { Database } from '../../src/core/database/schema.js';
import { createTestDatabase, cleanupTestDatabase, clearAllTables } from '../helpers/test-database.js';
import { EventBus } from '../../src/core/workflow/event-bus.js';
import { SubIssueManager } from '../../src/integrations/github/sub-issues.js';
import { registerGitHubIntegrationHandlers } from '../../src/core/workflow/github-integration.js';
import { randomUUID } from 'crypto';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// fetch と globalThis.setTimeout のモック
const mockFetch = jest.fn();
const mockSetTimeout = jest.fn();

// graphql のモック
const mockGraphqlClient = jest.fn();
jest.mock('@octokit/graphql', () => ({
  graphql: {
    defaults: jest.fn(() => mockGraphqlClient),
  },
}));

describe('Sub Issue Workflow E2E Integration Tests', () => {
  let db: Kysely<Database>;
  let eventBus: EventBus;
  let testSpecsDir: string;
  let testConfigDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    db = await createTestDatabase();
    originalEnv = { ...process.env };
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
    process.env = originalEnv;
  });

  beforeEach(async () => {
    await clearAllTables(db);

    // 新しい EventBus を作成（グローバルインスタンスを使用しない）
    eventBus = new EventBus();

    // GitHub 統合ハンドラーを登録
    registerGitHubIntegrationHandlers(eventBus, db);

    // テスト用ディレクトリ作成
    testConfigDir = join(process.cwd(), '.cc-craft-kit-test', `test-${Date.now()}`);
    testSpecsDir = join(testConfigDir, 'specs');
    await mkdir(testSpecsDir, { recursive: true });

    // GitHub トークン設定
    process.env.GITHUB_TOKEN = 'ghp_test_token';

    // GitHub 設定ファイル作成
    const config = {
      github: {
        owner: 'test-owner',
        repo: 'test-repo',
      },
    };
    await writeFile(join(testConfigDir, 'config.json'), JSON.stringify(config, null, 2));

    // グローバル fetch と setTimeout をモック
    global.fetch = mockFetch as unknown as typeof fetch;
    global.globalThis.setTimeout = mockSetTimeout as unknown as typeof setTimeout;

    // デフォルトのモック動作を設定
    mockFetch.mockReset();
    mockGraphqlClient.mockReset();
    mockSetTimeout.mockImplementation((callback: () => void) => {
      callback();
      return 1 as unknown as NodeJS.Timeout;
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();

    // テスト用ディレクトリクリーンアップ
    if (existsSync(testConfigDir)) {
      await rm(testConfigDir, { recursive: true, force: true });
    }

    delete process.env.GITHUB_TOKEN;
  });

  describe('Happy Path: Spec with tasks moves through phases', () => {
    it('仕様書作成 → tasks フェーズ移行 → Sub Issue 自動作成', async () => {
      const specId = randomUUID();

      // 1. 仕様書作成
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様書',
          description: 'Sub Issue テスト用',
          phase: 'requirements',
          github_issue_id: 100,
          github_project_id: null,
          github_milestone_id: null,
          github_project_item_id: 'project_item_node_id',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 2. 仕様書ファイルを作成（タスクリスト付き）
      const specContent = `# テスト仕様書

## 1. 概要
テスト用の仕様書です。

## 8. 実装タスクリスト

- [ ] **タスク 1**: データベーススキーマ設計
- [ ] **タスク 2**: API エンドポイント実装
- [ ] **タスク 3**: フロントエンド UI 実装
`;

      const specFilePath = join(testSpecsDir, `${specId}.md`);
      await writeFile(specFilePath, specContent);

      // 3. GitHub API モック設定

      // Issue 取得（親 Issue の Node ID 取得）
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          node_id: 'parent_issue_node_id',
          number: 100,
          title: 'テスト仕様書',
        }),
        text: async () => '',
      });

      // Sub Issue 1 作成
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({
          node_id: 'sub_issue_1_node_id',
          number: 101,
          html_url: 'https://github.com/test-owner/test-repo/issues/101',
        }),
        text: async () => '',
      });

      // Sub Issue 1 の Node ID 取得
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          node_id: 'sub_issue_1_node_id',
          number: 101,
        }),
        text: async () => '',
      });

      // Sub Issue 2 作成
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({
          node_id: 'sub_issue_2_node_id',
          number: 102,
          html_url: 'https://github.com/test-owner/test-repo/issues/102',
        }),
        text: async () => '',
      });

      // Sub Issue 2 の Node ID 取得
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          node_id: 'sub_issue_2_node_id',
          number: 102,
        }),
        text: async () => '',
      });

      // Sub Issue 3 作成
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({
          node_id: 'sub_issue_3_node_id',
          number: 103,
          html_url: 'https://github.com/test-owner/test-repo/issues/103',
        }),
        text: async () => '',
      });

      // Sub Issue 3 の Node ID 取得
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          node_id: 'sub_issue_3_node_id',
          number: 103,
        }),
        text: async () => '',
      });

      // GraphQL による親 Issue への Sub Issue 追加（3回）
      mockGraphqlClient.mockResolvedValue({
        addSubIssue: {
          issue: { title: 'テスト仕様書', subIssues: { totalCount: 1 } },
          subIssue: { title: 'Task', number: 101 },
        },
      });

      // Issue 更新（ラベル変更）のモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          number: 100,
          title: '[tasks] テスト仕様書',
          labels: [{ name: 'phase:tasks' }],
        }),
        text: async () => '',
      });

      // Issue コメント追加（フェーズ移行記録）のモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({
          id: 1,
          body: 'フェーズ移行コメント',
        }),
        text: async () => '',
      });

      // GraphQL による Project ステータス更新のモック
      mockGraphqlClient.mockResolvedValueOnce({
        updateProjectV2ItemFieldValue: {
          projectV2Item: {
            id: 'project_item_node_id',
          },
        },
      });

      // GraphQL による Project 取得のモック
      mockGraphqlClient.mockResolvedValueOnce({
        user: {
          projectV2: {
            id: 'project_node_id',
            field: {
              id: 'status_field_id',
              options: [
                { id: 'option_1', name: 'Todo' },
                { id: 'option_2', name: 'In Progress' },
                { id: 'option_3', name: 'Done' },
              ],
            },
          },
        },
      });

      // 4. spec.phase_changed イベントを発火（tasks フェーズに移行）
      // process.cwd() を一時的に変更
      const originalCwd = process.cwd();
      jest.spyOn(process, 'cwd').mockReturnValue(testConfigDir.replace('/.cc-craft-kit-test/' + testConfigDir.split('/').pop()!, ''));

      await db
        .updateTable('specs')
        .set({ phase: 'tasks', updated_at: new Date().toISOString() })
        .where('id', '=', specId)
        .execute();

      await eventBus.emit(
        eventBus.createEvent('spec.phase_changed', specId, {
          oldPhase: 'requirements',
          newPhase: 'tasks',
        })
      );

      // モック復元
      (process.cwd as jest.Mock).mockReturnValue(originalCwd);

      // 5. 検証: github_sync テーブルに Sub Issue レコードが作成されているか
      const syncRecords = await db
        .selectFrom('github_sync')
        .selectAll()
        .where('entity_type', '=', 'sub_issue')
        .execute();

      expect(syncRecords).toHaveLength(3);
      expect(syncRecords[0].github_id).toBe('test-owner/test-repo');
      expect(syncRecords[0].github_number).toBe(101);
      expect(syncRecords[0].github_node_id).toBe('sub_issue_1_node_id');
      expect(syncRecords[0].sync_status).toBe('success');
      expect(syncRecords[1].github_number).toBe(102);
      expect(syncRecords[2].github_number).toBe(103);

      // 6. 検証: fetch と GraphQL が正しく呼ばれたか
      // 親NodeID取得 + (Sub作成 + NodeID取得) x 3 + Issue更新 + コメント追加 = 9回
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(9);

      // GraphQL: Sub Issue追加 x 3 + Projectステータス更新 + Project取得 = 5回
      expect(mockGraphqlClient.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('タスク完了 → Sub Issue ステータス自動更新（closed）', async () => {
      const specId = randomUUID();
      const taskId = randomUUID();

      // 1. 仕様書作成
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'タスク完了テスト',
          description: null,
          phase: 'implementation',
          github_issue_id: 200,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 2. タスク作成
      await db
        .insertInto('tasks')
        .values({
          id: taskId,
          spec_id: specId,
          title: 'テストタスク',
          description: null,
          status: 'in_progress',
          priority: 1,
          github_issue_id: null,
          github_issue_number: null,
          assignee: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 3. github_sync に Sub Issue レコードを作成
      await db
        .insertInto('github_sync')
        .values({
          id: randomUUID(),
          entity_type: 'sub_issue',
          entity_id: taskId,
          github_id: 'test-owner/test-repo',
          github_number: 201,
          github_node_id: 'sub_issue_node_id',
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // 4. Issue ステータス更新のモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          node_id: 'sub_issue_node_id',
          number: 201,
          state: 'closed',
        }),
        text: async () => '',
      });

      // 5. task.completed イベントを発火
      await db
        .updateTable('tasks')
        .set({ status: 'done', updated_at: new Date().toISOString() })
        .where('id', '=', taskId)
        .execute();

      await eventBus.emit(
        eventBus.createEvent('task.completed', specId, { taskId }, taskId)
      );

      // 6. 検証: fetch が正しく呼ばれたか
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/issues/201',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            Authorization: 'Bearer ghp_test_token',
          }),
          body: JSON.stringify({ state: 'closed' }),
        })
      );

      // 7. 検証: last_synced_at が更新されたか
      const syncRecord = await db
        .selectFrom('github_sync')
        .selectAll()
        .where('entity_id', '=', taskId)
        .executeTakeFirst();

      expect(syncRecord).toBeDefined();
      expect(syncRecord?.sync_status).toBe('success');
    });

    it('完全ワークフロー: requirements → design → tasks → implementation with Sub Issues', async () => {
      const specId = randomUUID();

      // 1. 仕様書作成（requirements）
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: '完全ワークフローテスト',
          description: 'フェーズ移行の完全テスト',
          phase: 'requirements',
          github_issue_id: 300,
          github_project_id: null,
          github_milestone_id: null,
          github_project_item_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 2. requirements → design
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ number: 300, title: '[design] 完全ワークフローテスト' }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({ id: 1 }),
        text: async () => '',
      });

      await db
        .updateTable('specs')
        .set({ phase: 'design', updated_at: new Date().toISOString() })
        .where('id', '=', specId)
        .execute();

      await eventBus.emit(
        eventBus.createEvent('spec.phase_changed', specId, {
          oldPhase: 'requirements',
          newPhase: 'design',
        })
      );

      // 3. design → tasks（Sub Issue 作成）
      const specContent = `# 完全ワークフローテスト

## 8. 実装タスクリスト

- [ ] **タスク 1**: 設計実装
- [ ] **タスク 2**: テスト実装
`;

      const specFilePath = join(testSpecsDir, `${specId}.md`);
      await writeFile(specFilePath, specContent);

      // 親 Issue Node ID 取得
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'parent_node_id', number: 300 }),
        text: async () => '',
      });

      // Sub Issue 1 作成
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_1_node_id', number: 301 }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_1_node_id', number: 301 }),
        text: async () => '',
      });

      // Sub Issue 2 作成
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_2_node_id', number: 302 }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_2_node_id', number: 302 }),
        text: async () => '',
      });

      mockGraphqlClient.mockResolvedValue({
        addSubIssue: {
          issue: { title: 'Parent', subIssues: { totalCount: 1 } },
          subIssue: { title: 'Task', number: 301 },
        },
      });

      // Issue 更新
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ number: 300, title: '[tasks] 完全ワークフローテスト' }),
        text: async () => '',
      });

      // コメント追加
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({ id: 2 }),
        text: async () => '',
      });

      const originalCwd = process.cwd();
      jest.spyOn(process, 'cwd').mockReturnValue(testConfigDir.replace('/.cc-craft-kit-test/' + testConfigDir.split('/').pop()!, ''));

      await db
        .updateTable('specs')
        .set({ phase: 'tasks', updated_at: new Date().toISOString() })
        .where('id', '=', specId)
        .execute();

      await eventBus.emit(
        eventBus.createEvent('spec.phase_changed', specId, {
          oldPhase: 'design',
          newPhase: 'tasks',
        })
      );

      (process.cwd as jest.Mock).mockReturnValue(originalCwd);

      // 4. 検証: Sub Issue が作成されたか
      const syncRecords = await db
        .selectFrom('github_sync')
        .selectAll()
        .where('entity_type', '=', 'sub_issue')
        .execute();

      expect(syncRecords).toHaveLength(2);
      expect(syncRecords[0].github_number).toBe(301);
      expect(syncRecords[1].github_number).toBe(302);
    });
  });

  describe('Edge Cases', () => {
    it('仕様書にタスクがない場合、Sub Issue は作成されない', async () => {
      const specId = randomUUID();

      // 1. 仕様書作成
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'タスクなし仕様書',
          description: null,
          phase: 'requirements',
          github_issue_id: 400,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 2. タスクリストなしの仕様書ファイルを作成
      const specContent = `# タスクなし仕様書

## 1. 概要
タスクリストがない仕様書です。
`;

      const specFilePath = join(testSpecsDir, `${specId}.md`);
      await writeFile(specFilePath, specContent);

      // 3. Issue 更新のモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ number: 400, title: '[tasks] タスクなし仕様書' }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({ id: 1 }),
        text: async () => '',
      });

      const originalCwd = process.cwd();
      jest.spyOn(process, 'cwd').mockReturnValue(testConfigDir.replace('/.cc-craft-kit-test/' + testConfigDir.split('/').pop()!, ''));

      await db
        .updateTable('specs')
        .set({ phase: 'tasks', updated_at: new Date().toISOString() })
        .where('id', '=', specId)
        .execute();

      await eventBus.emit(
        eventBus.createEvent('spec.phase_changed', specId, {
          oldPhase: 'requirements',
          newPhase: 'tasks',
        })
      );

      (process.cwd as jest.Mock).mockReturnValue(originalCwd);

      // 4. 検証: Sub Issue が作成されていないか
      const syncRecords = await db
        .selectFrom('github_sync')
        .selectAll()
        .where('entity_type', '=', 'sub_issue')
        .execute();

      expect(syncRecords).toHaveLength(0);

      // 5. 検証: 親 Issue の Node ID 取得は呼ばれていない
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('issues/400'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('Sub Issue 作成中に GitHub API エラーが発生しても、イベント処理は継続する', async () => {
      const specId = randomUUID();

      // 1. 仕様書作成
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'API エラーテスト',
          description: null,
          phase: 'requirements',
          github_issue_id: 500,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      const specContent = `# API エラーテスト

## 8. 実装タスクリスト

- [ ] **タスク 1**: テストタスク
`;

      const specFilePath = join(testSpecsDir, `${specId}.md`);
      await writeFile(specFilePath, specContent);

      // 2. 親 Issue の Node ID 取得で 404 エラー
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        json: async () => ({}),
        text: async () => 'Issue not found',
      });

      // Issue 更新
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ number: 500, title: '[tasks] API エラーテスト' }),
        text: async () => '',
      });

      // コメント追加
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({ id: 1 }),
        text: async () => '',
      });

      const originalCwd = process.cwd();
      jest.spyOn(process, 'cwd').mockReturnValue(testConfigDir.replace('/.cc-craft-kit-test/' + testConfigDir.split('/').pop()!, ''));

      await db
        .updateTable('specs')
        .set({ phase: 'tasks', updated_at: new Date().toISOString() })
        .where('id', '=', specId)
        .execute();

      // 3. イベント発火（エラーが発生してもイベント処理は完了する）
      await expect(
        eventBus.emit(
          eventBus.createEvent('spec.phase_changed', specId, {
            oldPhase: 'requirements',
            newPhase: 'tasks',
          })
        )
      ).resolves.not.toThrow();

      (process.cwd as jest.Mock).mockReturnValue(originalCwd);

      // 4. 検証: Sub Issue は作成されていない
      const syncRecords = await db
        .selectFrom('github_sync')
        .selectAll()
        .where('entity_type', '=', 'sub_issue')
        .execute();

      expect(syncRecords).toHaveLength(0);
    });

    it('タスクに対応する Sub Issue が存在しない場合、task.completed イベントは警告のみ表示', async () => {
      const specId = randomUUID();
      const taskId = randomUUID();

      // 1. 仕様書作成
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Sub Issue なしタスク',
          description: null,
          phase: 'implementation',
          github_issue_id: 600,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 2. タスク作成（github_sync レコードなし）
      await db
        .insertInto('tasks')
        .values({
          id: taskId,
          spec_id: specId,
          title: 'Sub Issue なしタスク',
          description: null,
          status: 'in_progress',
          priority: 1,
          github_issue_id: null,
          github_issue_number: null,
          assignee: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 3. task.completed イベントを発火（エラーにならない）
      await db
        .updateTable('tasks')
        .set({ status: 'done', updated_at: new Date().toISOString() })
        .where('id', '=', taskId)
        .execute();

      await expect(
        eventBus.emit(
          eventBus.createEvent('task.completed', specId, { taskId }, taskId)
        )
      ).resolves.not.toThrow();

      // 4. 検証: fetch は呼ばれていない
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Database State Verification', () => {
    it('github_sync テーブルに正しい entity_type="sub_issue" レコードが記録される', async () => {
      // 1. SubIssueManager を直接使用して Sub Issue を作成
      const subIssueManager = new SubIssueManager(db);

      const taskList = [
        { id: randomUUID(), title: 'Task A', description: 'Description A' },
        { id: randomUUID(), title: 'Task B', description: 'Description B' },
      ];

      // 親 Issue Node ID 取得
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'parent_node_id', number: 700 }),
        text: async () => '',
      });

      // Sub Issue A 作成
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_a_node_id', number: 701 }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_a_node_id', number: 701 }),
        text: async () => '',
      });

      // Sub Issue B 作成
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_b_node_id', number: 702 }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_b_node_id', number: 702 }),
        text: async () => '',
      });

      mockGraphqlClient.mockResolvedValue({
        addSubIssue: {
          issue: { title: 'Parent', subIssues: { totalCount: 1 } },
          subIssue: { title: 'Task', number: 701 },
        },
      });

      await subIssueManager.createSubIssuesFromTaskList({
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 700,
        taskList,
        githubToken: 'ghp_test_token',
      });

      // 2. 検証: github_sync レコード
      const syncRecords = await db
        .selectFrom('github_sync')
        .selectAll()
        .where('entity_type', '=', 'sub_issue')
        .orderBy('github_number', 'asc')
        .execute();

      expect(syncRecords).toHaveLength(2);

      // Task A
      expect(syncRecords[0].entity_type).toBe('sub_issue');
      expect(syncRecords[0].entity_id).toBe(taskList[0].id);
      expect(syncRecords[0].github_id).toBe('test-owner/test-repo');
      expect(syncRecords[0].github_number).toBe(701);
      expect(syncRecords[0].github_node_id).toBe('sub_a_node_id');
      expect(syncRecords[0].sync_status).toBe('success');
      expect(syncRecords[0].error_message).toBeNull();

      // Task B
      expect(syncRecords[1].entity_type).toBe('sub_issue');
      expect(syncRecords[1].entity_id).toBe(taskList[1].id);
      expect(syncRecords[1].github_id).toBe('test-owner/test-repo');
      expect(syncRecords[1].github_number).toBe(702);
      expect(syncRecords[1].github_node_id).toBe('sub_b_node_id');
      expect(syncRecords[1].sync_status).toBe('success');
      expect(syncRecords[1].error_message).toBeNull();
    });
  });
});
