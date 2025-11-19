/**
 * GitHub 同期サービステスト
 */
import { setupDatabaseLifecycle, getDatabaseState, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { createMockOctokit } from '../../__mocks__/octokit.js';
import {
  mockIssueResponse,
  mockProjectV2Response,
  mockAddProjectV2ItemResponse,
} from '../../__fixtures__/github-api-responses.js';
import { GitHubClient } from '../../../src/integrations/github/client.js';
import { GitHubIssues } from '../../../src/integrations/github/issues.js';
import { GitHubProjects } from '../../../src/integrations/github/projects.js';
import { GitHubSyncService } from '../../../src/integrations/github/sync.js';
import { randomUUID } from 'crypto';

describe('GitHubSyncService', () => {
  let lifecycle: DatabaseLifecycle;
  let mockOctokit: ReturnType<typeof createMockOctokit>;
  let githubClient: GitHubClient;
  let githubIssues: GitHubIssues;
  let githubProjects: GitHubProjects;
  let syncService: GitHubSyncService;

  beforeEach(async () => {
    // データベースライフサイクルセットアップ
    lifecycle = await setupDatabaseLifecycle();

    // Octokit モック作成
    mockOctokit = createMockOctokit();

    // GitHubClient 作成
    githubClient = new GitHubClient({ token: 'ghp_test_token' });

    // GitHubClient の rest ゲッターをモックの rest プロパティに向ける
    Object.defineProperty(githubClient, 'rest', {
      get: () => mockOctokit.rest,
      configurable: true,
    });

    // GraphQL クライアントをモックの graphql プロパティに動的に向ける
    // テスト内で mockOctokit.graphql を再定義した場合も反映されるように
    Object.defineProperty(githubClient, 'graphqlClient', {
      get: () => mockOctokit.graphql,
      set: () => {}, // setter を無効化
      configurable: true,
    });

    // GitHub サービスインスタンス作成
    githubIssues = new GitHubIssues(githubClient);
    githubProjects = new GitHubProjects(githubClient);
    syncService = new GitHubSyncService(lifecycle.db, githubIssues, githubProjects);
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  describe('syncSpecToIssue: 仕様書 → GitHub Issue', () => {
    test('新規 Issue を作成して仕様書と紐付ける（createIfNotExists: true）', async () => {
      const specId = randomUUID();

      // 仕様書作成（Issue未紐付け）
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: 'GitHub同期テスト',
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 同期実行（新規作成）
      const issueNumber = await syncService.syncSpecToIssue({
        specId,
        owner: 'test-user',
        repo: 'test-repo',
        createIfNotExists: true,
      });

      // Issue が作成されたことを確認
      expect(issueNumber).toBe(mockIssueResponse.data.number);
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledTimes(1);
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-user',
          repo: 'test-repo',
          title: '[requirements] テスト仕様',
          labels: ['phase:requirements'],
        })
      );

      // 仕様書が更新されたことを確認
      const updatedSpec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(updatedSpec?.github_issue_id).toBe(mockIssueResponse.data.number);

      // 同期ログが記録されたことを確認
      const syncLogs = await lifecycle.db
        .selectFrom('github_sync')
        .where('entity_id', '=', specId)
        .selectAll()
        .execute();

      expect(syncLogs).toHaveLength(1);
      expect(syncLogs[0].sync_status).toBe('success');
      expect(syncLogs[0].entity_type).toBe('spec');
    });

    test('既存 Issue を更新する（github_issue_id が設定済み）', async () => {
      const specId = randomUUID();
      const existingIssueNumber = 123;

      // 仕様書作成（Issue 紐付け済み）
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '既存仕様',
          description: '既存Issue更新テスト',
          phase: 'design',
          github_issue_id: existingIssueNumber,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 既存 Issue のモックレスポンスを設定（テンプレートではない）
      mockOctokit.rest.issues.get = jest.fn().mockResolvedValue({
        data: {
          ...mockIssueResponse.data,
          number: existingIssueNumber,
          body: '既存のIssue本文（テンプレートではない）',
        },
      });

      // 同期実行（更新）
      const issueNumber = await syncService.syncSpecToIssue({
        specId,
        owner: 'test-user',
        repo: 'test-repo',
        createIfNotExists: false,
      });

      // Issue が更新されたことを確認
      expect(issueNumber).toBe(existingIssueNumber);
      expect(mockOctokit.rest.issues.update).toHaveBeenCalledTimes(1);
      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-user',
          repo: 'test-repo',
          issue_number: existingIssueNumber,
          title: '[design] 既存仕様',
          labels: ['phase:design'],
        })
      );

      // Issue コメントが追加されたことを確認
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(1);
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-user',
          repo: 'test-repo',
          issue_number: existingIssueNumber,
          body: expect.stringContaining('🔄 仕様書から同期'),
        })
      );
    });

    test('Issue未紐付けで createIfNotExists: false の場合はエラーをスローする', async () => {
      const specId = randomUUID();

      // 仕様書作成（Issue未紐付け）
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'エラーテスト',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // エラーが発生することを確認
      await expect(
        syncService.syncSpecToIssue({
          specId,
          owner: 'test-user',
          repo: 'test-repo',
          createIfNotExists: false,
        })
      ).rejects.toThrow('Issue not linked and createIfNotExists is false');
    });
  });

  describe('syncIssueToSpec: GitHub Issue → 仕様書', () => {
    test('Issue の状態を仕様書に反映する', async () => {
      const specId = randomUUID();
      const issueNumber = 456;

      // 仕様書作成（Issue 紐付け済み）
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '逆同期テスト',
          description: null,
          phase: 'implementation',
          github_issue_id: issueNumber,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // Issue 取得モックを設定
      mockOctokit.rest.issues.get = jest.fn().mockResolvedValue({
        data: {
          ...mockIssueResponse.data,
          number: issueNumber,
          title: '[implementation] 逆同期テスト',
          state: 'open',
        },
      });

      // 同期実行
      const updatedSpecId = await syncService.syncIssueToSpec({
        owner: 'test-user',
        repo: 'test-repo',
        issueNumber,
      });

      // 仕様書が更新されたことを確認
      expect(updatedSpecId).toBe(specId);

      const updatedSpec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(updatedSpec?.name).toBe('逆同期テスト');
      expect(updatedSpec?.phase).toBe('implementation');

      // 同期ログが記録されたことを確認
      const syncLogs = await lifecycle.db
        .selectFrom('github_sync')
        .where('entity_id', '=', specId)
        .where('sync_status', '=', 'success')
        .selectAll()
        .execute();

      expect(syncLogs).toHaveLength(1);
      expect(syncLogs[0].entity_type).toBe('spec');
    });

    test('Issue が closed の場合、仕様書のフェーズを completed にする', async () => {
      const specId = randomUUID();
      const issueNumber = 789;

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'クローズテスト',
          description: null,
          phase: 'implementation',
          github_issue_id: issueNumber,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // Issue 取得モック（closed 状態）
      mockOctokit.rest.issues.get = jest.fn().mockResolvedValue({
        data: {
          ...mockIssueResponse.data,
          number: issueNumber,
          title: '[completed] クローズテスト',
          state: 'closed',
        },
      });

      // 同期実行
      await syncService.syncIssueToSpec({
        owner: 'test-user',
        repo: 'test-repo',
        issueNumber,
      });

      // 仕様書のフェーズが completed になったことを確認
      const updatedSpec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(updatedSpec?.phase).toBe('completed');
    });

    test('紐づく仕様書が存在しない場合はエラーをスローする', async () => {
      const issueNumber = 999;

      // Issue 取得モック
      mockOctokit.rest.issues.get = jest.fn().mockResolvedValue({
        data: {
          ...mockIssueResponse.data,
          number: issueNumber,
        },
      });

      // エラーが発生することを確認
      await expect(
        syncService.syncIssueToSpec({
          owner: 'test-user',
          repo: 'test-repo',
          issueNumber,
        })
      ).rejects.toThrow(`No spec linked to issue #${issueNumber}`);
    });
  });

  describe('addSpecToProject: 仕様書を GitHub Project に追加', () => {
    test('Issue を GitHub Project に追加する', async () => {
      const specId = randomUUID();
      const issueNumber = 123;
      const projectNumber = 1;

      // 仕様書作成（Issue 紐付け済み）
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Project追加テスト',
          description: null,
          phase: 'requirements',
          github_issue_id: issueNumber,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // GraphQL モック設定
      mockOctokit.graphql = jest.fn().mockImplementation((query: string) => {
        // getOwnerType 用の user クエリ（id フィールドのみ）
        if (query.includes('user(login:') && !query.includes('projectV2')) {
          return Promise.resolve({ user: { id: 'U_test' } });
        }
        // user.projectV2 クエリ
        if (query.includes('user(login:') && query.includes('projectV2(')) {
          return Promise.resolve({
            user: {
              projectV2: mockProjectV2Response.repository.projectV2,
            },
          });
        }
        // addProjectV2ItemById mutation
        if (query.includes('addProjectV2ItemById')) {
          return Promise.resolve(mockAddProjectV2ItemResponse);
        }
        // repository.issue クエリ
        if (query.includes('repository(owner:')) {
          return Promise.resolve({
            repository: {
              issue: {
                id: 'I_kwDOABCDEF',
              },
            },
          });
        }
        return Promise.resolve({});
      });

      // Project に追加
      const itemId = await syncService.addSpecToProject({
        specId,
        owner: 'test-user',
        projectNumber,
      });

      // Item ID が返されたことを確認
      expect(itemId).toBe(mockAddProjectV2ItemResponse.addProjectV2ItemById.item.id);

      // 仕様書が更新されたことを確認
      const updatedSpec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(updatedSpec?.github_project_id).toBe(mockProjectV2Response.repository.projectV2.id);
      expect(updatedSpec?.github_project_item_id).toBe(mockAddProjectV2ItemResponse.addProjectV2ItemById.item.id);
    });

    test('Issue が紐づいていない場合はエラーをスローする', async () => {
      const specId = randomUUID();

      // 仕様書作成（Issue 未紐付け）
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Projectエラーテスト',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // エラーが発生することを確認
      await expect(
        syncService.addSpecToProject({
          specId,
          owner: 'test-user',
          projectNumber: 1,
        })
      ).rejects.toThrow('Spec has no linked GitHub Issue');
    });
  });

  describe('同期ログ記録', () => {
    test('to_github 同期ログが正しく記録される', async () => {
      const specId = randomUUID();

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'ログ記録テスト',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 同期実行（新規作成）
      await syncService.syncSpecToIssue({
        specId,
        owner: 'test-user',
        repo: 'test-repo',
        createIfNotExists: true,
      });

      // 同期ログ確認
      const syncLogs = await lifecycle.db
        .selectFrom('github_sync')
        .where('entity_id', '=', specId)
        .where('entity_type', '=', 'spec')
        .selectAll()
        .execute();

      expect(syncLogs).toHaveLength(1);
      expect(syncLogs[0].sync_status).toBe('success');
      expect(syncLogs[0].github_number).toBe(mockIssueResponse.data.number);
    });

    test('from_github 同期ログが正しく記録される', async () => {
      const specId = randomUUID();
      const issueNumber = 456;

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '逆同期ログテスト',
          description: null,
          phase: 'implementation',
          github_issue_id: issueNumber,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // Issue 取得モック
      mockOctokit.rest.issues.get = jest.fn().mockResolvedValue({
        data: {
          ...mockIssueResponse.data,
          number: issueNumber,
          title: '[implementation] 逆同期ログテスト',
          state: 'open',
        },
      });

      // 同期実行
      await syncService.syncIssueToSpec({
        owner: 'test-user',
        repo: 'test-repo',
        issueNumber,
      });

      // 同期ログ確認
      const syncLogs = await lifecycle.db
        .selectFrom('github_sync')
        .where('entity_id', '=', specId)
        .where('entity_type', '=', 'spec')
        .selectAll()
        .execute();

      expect(syncLogs).toHaveLength(1);
      expect(syncLogs[0].sync_status).toBe('success');
      expect(syncLogs[0].github_number).toBe(issueNumber);
    });
  });

  describe('データベース状態検証', () => {
    test('同期後のデータベース状態が正しい', async () => {
      const specId = randomUUID();

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '状態検証テスト',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_milestone_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 同期実行
      await syncService.syncSpecToIssue({
        specId,
        owner: 'test-user',
        repo: 'test-repo',
        createIfNotExists: true,
      });

      // データベース状態確認
      const state = await getDatabaseState(lifecycle.db);

      expect(state.specs).toBe(1);
      expect(state.githubSync).toBe(1);
      expect(state.tasks).toBe(0);
      expect(state.logs).toBe(0);
    });
  });
});
