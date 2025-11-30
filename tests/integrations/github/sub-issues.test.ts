/**
 * SubIssueManager テスト
 */
import 'reflect-metadata';
import { Database } from '../../../src/core/database/schema.js';
import { SubIssueManager, SubIssueConfig } from '../../../src/integrations/github/sub-issues.js';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { randomUUID } from 'crypto';

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

describe('SubIssueManager', () => {
  let lifecycle: DatabaseLifecycle;
  let manager: SubIssueManager;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
    manager = new SubIssueManager(lifecycle.db);

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
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  describe('createSubIssuesFromTaskList', () => {
    it('タスクリストから Sub Issue を正常に作成できる', async () => {
      const config: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [
          { id: randomUUID(), title: 'Task 1', description: 'Description 1' },
          { id: randomUUID(), title: 'Task 2', description: 'Description 2' },
        ],
        githubToken: 'ghp_test_token',
      };

      // 親 Issue の Node ID 取得をモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          node_id: 'parent_node_id',
          number: 100,
          html_url: 'https://github.com/test-owner/test-repo/issues/100',
        }),
        text: async () => '',
      });

      // Sub Issue 1 作成をモック
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

      // Sub Issue 1 の Node ID 取得をモック
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

      // Sub Issue 2 作成をモック
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

      // Sub Issue 2 の Node ID 取得をモック
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

      // GraphQL による親 Issue への Sub Issue 追加をモック
      mockGraphqlClient.mockResolvedValue({
        addSubIssue: {
          issue: { title: 'Parent Issue', subIssues: { totalCount: 1 } },
          subIssue: { title: 'Task 1', number: 101 },
        },
      });

      await manager.createSubIssuesFromTaskList(config);

      // fetch が正しく呼ばれたか確認
      expect(mockFetch).toHaveBeenCalledTimes(5); // 親NodeID取得 + (Sub作成 + NodeID取得) x 2

      // GraphQL が正しく呼ばれたか確認
      expect(mockGraphqlClient).toHaveBeenCalledTimes(2);

      // github_sync テーブルに記録されたか確認
      const syncRecords = await lifecycle.db
        .selectFrom('github_sync')
        .selectAll()
        .where('entity_type', '=', 'sub_issue')
        .orderBy('github_number', 'asc')
        .execute();

      expect(syncRecords).toHaveLength(2);
      expect(syncRecords[0].github_id).toBe('test-owner/test-repo');
      expect(syncRecords[0].github_number).toBe(101);
      expect(syncRecords[0].sync_status).toBe('success');
      expect(syncRecords[1].github_number).toBe(102);
    });

    it('タスク数が制限を超える場合はエラーをスローする', async () => {
      const config: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: Array.from({ length: 101 }, (_, i) => ({
          id: randomUUID(),
          title: `Task ${i + 1}`,
        })),
        githubToken: 'ghp_test_token',
      };

      // 親 Issue の Node ID 取得をモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          node_id: 'parent_node_id',
          number: 100,
        }),
        text: async () => '',
      });

      await expect(manager.createSubIssuesFromTaskList(config)).rejects.toThrow(
        'Task count (101) exceeds GitHub limit (100)'
      );
    });

    it('レート制限に遭遇した場合はリトライする', async () => {
      const config: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [{ id: randomUUID(), title: 'Task 1' }],
        githubToken: 'ghp_test_token',
      };

      // 最初の呼び出しでレート制限エラー
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '1' }),
        text: async () => '',
      });

      // リトライ後は成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          node_id: 'parent_node_id',
          number: 100,
        }),
        text: async () => '',
      });

      // Sub Issue 作成をモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({
          node_id: 'sub_issue_node_id',
          number: 101,
        }),
        text: async () => '',
      });

      // Sub Issue の Node ID 取得をモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          node_id: 'sub_issue_node_id',
          number: 101,
        }),
        text: async () => '',
      });

      mockGraphqlClient.mockResolvedValue({
        addSubIssue: {
          issue: { title: 'Parent Issue', subIssues: { totalCount: 1 } },
          subIssue: { title: 'Task 1', number: 101 },
        },
      });

      await manager.createSubIssuesFromTaskList(config);

      // fetch が再試行されたか確認（最初の429 + リトライ成功 + Sub作成 + NodeID取得 = 4回）
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('updateSubIssueStatus', () => {
    it('Sub Issue のステータスを正常に更新できる', async () => {
      const taskId = randomUUID();

      // github_sync レコードを作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          id: randomUUID(),
          entity_type: 'sub_issue',
          entity_id: taskId,
          github_id: 'test-owner/test-repo',
          github_number: 101,
          github_node_id: 'sub_issue_node_id',
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // ステータス更新をモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          node_id: 'sub_issue_node_id',
          number: 101,
          state: 'closed',
        }),
        text: async () => '',
      });

      await manager.updateSubIssueStatus(taskId, 'closed', 'ghp_test_token');

      // fetch が正しく呼ばれたか確認
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/issues/101',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            Authorization: 'Bearer ghp_test_token',
          }),
          body: JSON.stringify({ state: 'closed' }),
        })
      );

      // last_synced_at が更新されたか確認
      const syncRecord = await lifecycle.db
        .selectFrom('github_sync')
        .selectAll()
        .where('entity_id', '=', taskId)
        .executeTakeFirst();

      expect(syncRecord).toBeDefined();
      expect(syncRecord?.sync_status).toBe('success');
    });

    it('Sub Issue が存在しない場合はエラーをスローする', async () => {
      const taskId = randomUUID();

      await expect(manager.updateSubIssueStatus(taskId, 'closed', 'ghp_test_token')).rejects.toThrow(
        `Sub issue not found for task: ${taskId}`
      );
    });

    it('無効な github_id 形式の場合はエラーをスローする', async () => {
      const taskId = randomUUID();

      // 無効な形式の github_id を持つレコードを作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          id: randomUUID(),
          entity_type: 'sub_issue',
          entity_id: taskId,
          github_id: 'invalid-format', // owner/repo 形式ではない
          github_number: 101,
          github_node_id: 'sub_issue_node_id',
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      await expect(manager.updateSubIssueStatus(taskId, 'closed', 'ghp_test_token')).rejects.toThrow(
        'Invalid github_id format (expected "owner/repo"): invalid-format'
      );
    });
  });

  describe('getIssueNodeId (private method test via createSubIssuesFromTaskList)', () => {
    it('API エラーの場合は適切なエラーメッセージをスローする', async () => {
      const config: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 999,
        taskList: [{ id: randomUUID(), title: 'Task 1' }],
        githubToken: 'ghp_test_token',
      };

      // 404 Not Found をモック
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        json: async () => ({}),
        text: async () => 'Issue not found',
      });

      await expect(manager.createSubIssuesFromTaskList(config)).rejects.toThrow(
        'Failed to get issue (404 Not Found): Issue not found'
      );
    });
  });

  describe('createSubIssue (private method test via createSubIssuesFromTaskList)', () => {
    it('API エラーの場合は適切なエラーメッセージをスローする', async () => {
      const config: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [{ id: randomUUID(), title: 'Task 1' }],
        githubToken: 'ghp_test_token',
      };

      // 親 Issue の Node ID 取得をモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          node_id: 'parent_node_id',
          number: 100,
        }),
        text: async () => '',
      });

      // Sub Issue 作成時に 403 Forbidden をモック
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        json: async () => ({}),
        text: async () => 'Insufficient permissions',
      });

      await expect(manager.createSubIssuesFromTaskList(config)).rejects.toThrow(
        'Failed to create sub issue (403 Forbidden): Insufficient permissions'
      );
    });
  });

  describe('addSubIssueToParent (private method test via createSubIssuesFromTaskList)', () => {
    it('GraphQL API エラーの場合はエラーをスローする', async () => {
      const config: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [{ id: randomUUID(), title: 'Task 1' }],
        githubToken: 'ghp_test_token',
      };

      // 親 Issue の Node ID 取得をモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          node_id: 'parent_node_id',
          number: 100,
        }),
        text: async () => '',
      });

      // Sub Issue 作成をモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({
          node_id: 'sub_issue_node_id',
          number: 101,
        }),
        text: async () => '',
      });

      // Sub Issue の Node ID 取得をモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({
          node_id: 'sub_issue_node_id',
          number: 101,
        }),
        text: async () => '',
      });

      // GraphQL エラーをモック
      mockGraphqlClient.mockRejectedValue(new Error('GraphQL API error: Invalid node ID'));

      await expect(manager.createSubIssuesFromTaskList(config)).rejects.toThrow(
        'GraphQL API error: Invalid node ID'
      );
    });
  });

  describe('recordSubIssueSyncData (private method test)', () => {
    it('github_sync テーブルに正しくデータを記録する', async () => {
      const config: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [{ id: randomUUID(), title: 'Task 1', description: 'Test description' }],
        githubToken: 'ghp_test_token',
      };

      // すべての API 呼び出しをモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'parent_node_id', number: 100 }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_issue_node_id', number: 101 }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_issue_node_id', number: 101 }),
        text: async () => '',
      });

      mockGraphqlClient.mockResolvedValue({
        addSubIssue: {
          issue: { title: 'Parent Issue', subIssues: { totalCount: 1 } },
          subIssue: { title: 'Task 1', number: 101 },
        },
      });

      await manager.createSubIssuesFromTaskList(config);

      // データベース記録を確認
      const syncRecord = await lifecycle.db
        .selectFrom('github_sync')
        .selectAll()
        .where('entity_type', '=', 'sub_issue')
        .where('entity_id', '=', config.taskList[0].id)
        .executeTakeFirst();

      expect(syncRecord).toBeDefined();
      expect(syncRecord?.github_id).toBe('test-owner/test-repo');
      expect(syncRecord?.github_number).toBe(101);
      expect(syncRecord?.github_node_id).toBe('sub_issue_node_id');
      expect(syncRecord?.sync_status).toBe('success');
      expect(syncRecord?.error_message).toBeNull();
    });
  });

  describe('fetchWithRetry (private method test)', () => {
    it('レート制限時に Retry-After ヘッダーを考慮してリトライする', async () => {
      const config: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [{ id: randomUUID(), title: 'Task 1' }],
        githubToken: 'ghp_test_token',
      };

      // 429 with Retry-After header
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '2' }),
        text: async () => '',
      });

      // リトライ後は成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'parent_node_id', number: 100 }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_issue_node_id', number: 101 }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_issue_node_id', number: 101 }),
        text: async () => '',
      });

      mockGraphqlClient.mockResolvedValue({
        addSubIssue: {
          issue: { title: 'Parent Issue', subIssues: { totalCount: 1 } },
          subIssue: { title: 'Task 1', number: 101 },
        },
      });

      await manager.createSubIssuesFromTaskList(config);

      // fetch が再試行されたか確認
      expect(mockFetch).toHaveBeenCalled();
    });

    it('レート制限時に Retry-After ヘッダーがない場合は指数バックオフを使用する', async () => {
      const config: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [{ id: randomUUID(), title: 'Task 1' }],
        githubToken: 'ghp_test_token',
      };

      // 429 without Retry-After header
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers(),
        text: async () => '',
      });

      // リトライ後は成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'parent_node_id', number: 100 }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_issue_node_id', number: 101 }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'sub_issue_node_id', number: 101 }),
        text: async () => '',
      });

      mockGraphqlClient.mockResolvedValue({
        addSubIssue: {
          issue: { title: 'Parent Issue', subIssues: { totalCount: 1 } },
          subIssue: { title: 'Task 1', number: 101 },
        },
      });

      await manager.createSubIssuesFromTaskList(config);

      // 指数バックオフが使用されることを確認（setTimeout が呼ばれたか）
      expect(mockSetTimeout).toHaveBeenCalled();
    });

    it('最大リトライ回数を超えた場合はエラーをスローする', async () => {
      const config: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [{ id: randomUUID(), title: 'Task 1' }],
        githubToken: 'ghp_test_token',
      };

      // 常に 429 を返す
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers(),
        text: async () => '',
      });

      await expect(manager.createSubIssuesFromTaskList(config)).rejects.toThrow(
        'Max retries (3) exceeded due to rate limiting'
      );
    });
  });

  describe('getGraphQLClient (private method test)', () => {
    it('同じトークンに対してクライアントをキャッシュする', async () => {
      const config1: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [{ id: randomUUID(), title: 'Task 1' }],
        githubToken: 'ghp_test_token',
      };

      const config2: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [{ id: randomUUID(), title: 'Task 2' }],
        githubToken: 'ghp_test_token', // 同じトークン
      };

      // すべての API 呼び出しをモック
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'node_id', number: 100 }),
        text: async () => '',
      });

      mockGraphqlClient.mockResolvedValue({
        addSubIssue: {
          issue: { title: 'Parent Issue', subIssues: { totalCount: 1 } },
          subIssue: { title: 'Task', number: 101 },
        },
      });

      await manager.createSubIssuesFromTaskList(config1);
      await manager.createSubIssuesFromTaskList(config2);

      // graphql.defaults は1回のみ呼ばれる（キャッシュされている）
      const { graphql } = await import('@octokit/graphql');
      expect(graphql.defaults).toHaveBeenCalledTimes(1);
    });

    it('異なるトークンに対しては別のクライアントを作成する', async () => {
      const config1: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [{ id: randomUUID(), title: 'Task 1' }],
        githubToken: 'ghp_test_token_1',
      };

      const config2: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [{ id: randomUUID(), title: 'Task 2' }],
        githubToken: 'ghp_test_token_2', // 異なるトークン
      };

      // すべての API 呼び出しをモック
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'node_id', number: 100 }),
        text: async () => '',
      });

      mockGraphqlClient.mockResolvedValue({
        addSubIssue: {
          issue: { title: 'Parent Issue', subIssues: { totalCount: 1 } },
          subIssue: { title: 'Task', number: 101 },
        },
      });

      await manager.createSubIssuesFromTaskList(config1);
      await manager.createSubIssuesFromTaskList(config2);

      // graphql.defaults は2回呼ばれる（異なるトークンのため）
      const { graphql } = await import('@octokit/graphql');
      expect(graphql.defaults).toHaveBeenCalledTimes(2);
    });
  });

  describe('syncParentIssueCheckbox チェックボックスパターン', () => {
    const taskId = randomUUID();
    const parentIssueNumber = 100;
    const subIssueNumber = 101;

    beforeEach(async () => {
      // github_sync レコードを作成（Sub Issue）
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          id: randomUUID(),
          entity_type: 'sub_issue',
          entity_id: taskId,
          github_id: 'test-owner/test-repo',
          github_number: subIssueNumber,
          github_node_id: 'sub_issue_node_id',
          parent_issue_number: parentIssueNumber,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();
    });

    it('正しい形式のチェックボックスにマッチする（- [ ] #番号）', async () => {
      const issueBody = `## タスク\n- [ ] #${subIssueNumber} タスク1\n- [ ] #102 タスク2`;

      // 親 Issue 取得
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ body: issueBody }),
        text: async () => '',
      });

      // 親 Issue 更新
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => '',
      });

      await manager.syncParentIssueCheckbox(
        'test-owner',
        'test-repo',
        parentIssueNumber,
        subIssueNumber,
        'closed',
        'ghp_test_token'
      );

      // PATCH リクエストの body を確認
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const patchCall = mockFetch.mock.calls[1];
      const patchBody = JSON.parse(patchCall[1].body);
      expect(patchBody.body).toContain(`- [x] #${subIssueNumber}`);
      expect(patchBody.body).toContain('- [ ] #102'); // 他のチェックボックスは変更なし
    });

    it('インデントされたチェックボックスにもマッチする', async () => {
      const issueBody = `## タスク\n  - [ ] #${subIssueNumber} インデントタスク`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ body: issueBody }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => '',
      });

      await manager.syncParentIssueCheckbox(
        'test-owner',
        'test-repo',
        parentIssueNumber,
        subIssueNumber,
        'closed',
        'ghp_test_token'
      );

      const patchCall = mockFetch.mock.calls[1];
      const patchBody = JSON.parse(patchCall[1].body);
      expect(patchBody.body).toContain(`  - [x] #${subIssueNumber}`);
    });

    it('類似番号にはマッチしない（#101 が #1011 にマッチしない）', async () => {
      const issueBody = `## タスク\n- [ ] #1011 別タスク\n- [ ] #${subIssueNumber} 正しいタスク`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ body: issueBody }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => '',
      });

      await manager.syncParentIssueCheckbox(
        'test-owner',
        'test-repo',
        parentIssueNumber,
        subIssueNumber,
        'closed',
        'ghp_test_token'
      );

      const patchCall = mockFetch.mock.calls[1];
      const patchBody = JSON.parse(patchCall[1].body);
      expect(patchBody.body).toContain('- [ ] #1011'); // 変更されない
      expect(patchBody.body).toContain(`- [x] #${subIssueNumber}`); // 変更される
    });

    it('コメント内の Issue 参照にはマッチしない', async () => {
      const issueBody = `## タスク\n- [ ] タスク説明 (#${subIssueNumber} を参照)\n- [ ] #${subIssueNumber} 正しいタスク`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ body: issueBody }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => '',
      });

      await manager.syncParentIssueCheckbox(
        'test-owner',
        'test-repo',
        parentIssueNumber,
        subIssueNumber,
        'closed',
        'ghp_test_token'
      );

      const patchCall = mockFetch.mock.calls[1];
      const patchBody = JSON.parse(patchCall[1].body);
      // コメント内の参照は変更されない
      expect(patchBody.body).toContain(`- [ ] タスク説明 (#${subIssueNumber} を参照)`);
      // 正しい形式のチェックボックスのみ変更される
      expect(patchBody.body).toContain(`- [x] #${subIssueNumber} 正しいタスク`);
    });

    it('チェックボックスが見つからない場合は更新をスキップする', async () => {
      const issueBody = `## タスク\n- [ ] #999 別のタスク`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ body: issueBody }),
        text: async () => '',
      });

      await manager.syncParentIssueCheckbox(
        'test-owner',
        'test-repo',
        parentIssueNumber,
        subIssueNumber,
        'closed',
        'ghp_test_token'
      );

      // PATCH は呼ばれない（GET のみ）
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('reopened 時にチェックを外す（[x] → [ ]）', async () => {
      const issueBody = `## タスク\n- [x] #${subIssueNumber} 完了タスク`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ body: issueBody }),
        text: async () => '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => '',
      });

      await manager.syncParentIssueCheckbox(
        'test-owner',
        'test-repo',
        parentIssueNumber,
        subIssueNumber,
        'open', // reopened
        'ghp_test_token'
      );

      const patchCall = mockFetch.mock.calls[1];
      const patchBody = JSON.parse(patchCall[1].body);
      expect(patchBody.body).toContain(`- [ ] #${subIssueNumber}`);
    });
  });

  describe('エッジケース', () => {
    it('空のタスクリストの場合は何も実行しない', async () => {
      const config: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [],
        githubToken: 'ghp_test_token',
      };

      // 親 Issue の Node ID 取得のみモック
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'parent_node_id', number: 100 }),
        text: async () => '',
      });

      await manager.createSubIssuesFromTaskList(config);

      // 親 Issue の Node ID 取得のみ実行される
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockGraphqlClient).not.toHaveBeenCalled();
    });

    it('description が undefined のタスクも正常に処理できる', async () => {
      const config: SubIssueConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        parentIssueNumber: 100,
        taskList: [{ id: randomUUID(), title: 'Task without description' }],
        githubToken: 'ghp_test_token',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ node_id: 'node_id', number: 100 }),
        text: async () => '',
      });

      mockGraphqlClient.mockResolvedValue({
        addSubIssue: {
          issue: { title: 'Parent Issue', subIssues: { totalCount: 1 } },
          subIssue: { title: 'Task without description', number: 101 },
        },
      });

      await expect(manager.createSubIssuesFromTaskList(config)).resolves.not.toThrow();
    });
  });
});
