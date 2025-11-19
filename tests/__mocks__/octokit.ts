/**
 * Octokit モックファクトリー
 *
 * テストで使用する Octokit REST API と GraphQL API のモックを提供します。
 */

import {
  mockUserResponse,
  mockRepoResponse,
  mockIssueResponse,
  mockCommentResponse,
  mockLabelResponse,
  mockProjectV2Response,
  mockAddProjectV2ItemResponse,
  mockUpdateProjectV2ItemFieldValueResponse,
  mockPullRequestResponse,
  mockMilestoneResponse,
} from '../__fixtures__/github-api-responses.js';

/**
 * モック Octokit オプション
 */
export interface MockOctokitOptions {
  /**
   * カスタムレスポンスを指定する場合に使用
   */
  customResponses?: {
    getUserAuth?: unknown;
    getRepo?: unknown;
    createIssue?: unknown;
    updateIssue?: unknown;
    createComment?: unknown;
    addLabels?: unknown;
    graphql?: Record<string, unknown>;
  };

  /**
   * エラーをシミュレートする場合に使用
   */
  shouldThrowError?: {
    getUserAuth?: boolean;
    getRepo?: boolean;
    createIssue?: boolean;
    updateIssue?: boolean;
    createComment?: boolean;
    addLabels?: boolean;
    graphql?: boolean;
  };
}

/**
 * モック Octokit インスタンス型
 */
export interface MockOctokit {
  rest: {
    users: {
      getAuthenticated: jest.Mock;
    };
    repos: {
      get: jest.Mock;
    };
    issues: {
      get: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      addLabels: jest.Mock;
      createComment: jest.Mock;
    };
  };
  graphql: jest.Mock;
}

/**
 * モック Octokit インスタンスを作成
 */
export function createMockOctokit(options: MockOctokitOptions = {}): MockOctokit {
  const { customResponses = {}, shouldThrowError = {} } = options;

  return {
    rest: {
      users: {
        getAuthenticated: jest.fn().mockImplementation(() => {
          if (shouldThrowError.getUserAuth) {
            throw new Error('GitHub API Error: Unauthorized');
          }
          return Promise.resolve({ data: customResponses.getUserAuth || mockUserResponse });
        }),
      },
      repos: {
        get: jest.fn().mockImplementation(() => {
          if (shouldThrowError.getRepo) {
            throw new Error('GitHub API Error: Repository not found');
          }
          return Promise.resolve(customResponses.getRepo || mockRepoResponse);
        }),
      },
      issues: {
        get: jest.fn().mockImplementation(() => {
          return Promise.resolve(mockIssueResponse);
        }),
        create: jest.fn().mockImplementation(() => {
          if (shouldThrowError.createIssue) {
            throw new Error('GitHub API Error: Failed to create issue');
          }
          return Promise.resolve(customResponses.createIssue || mockIssueResponse);
        }),
        update: jest.fn().mockImplementation(() => {
          if (shouldThrowError.updateIssue) {
            throw new Error('GitHub API Error: Failed to update issue');
          }
          return Promise.resolve(customResponses.updateIssue || mockIssueResponse);
        }),
        addLabels: jest.fn().mockImplementation(() => {
          if (shouldThrowError.addLabels) {
            throw new Error('GitHub API Error: Failed to add labels');
          }
          return Promise.resolve(customResponses.addLabels || mockLabelResponse);
        }),
        createComment: jest.fn().mockImplementation(() => {
          if (shouldThrowError.createComment) {
            throw new Error('GitHub API Error: Failed to create comment');
          }
          return Promise.resolve(customResponses.createComment || mockCommentResponse);
        }),
      },
    },
    graphql: jest.fn().mockImplementation((query: string, variables?: Record<string, unknown>) => {
      if (shouldThrowError.graphql) {
        return Promise.reject(new Error('GitHub GraphQL API Error'));
      }

      // GraphQL クエリに応じたモックレスポンスを返す
      if (query.includes('projectV2')) {
        if (query.includes('addProjectV2ItemById')) {
          return Promise.resolve(customResponses.graphql?.addProjectV2ItemById || mockAddProjectV2ItemResponse);
        }
        if (query.includes('updateProjectV2ItemFieldValue')) {
          return Promise.resolve(
            customResponses.graphql?.updateProjectV2ItemFieldValue || mockUpdateProjectV2ItemFieldValueResponse
          );
        }
        return Promise.resolve(customResponses.graphql?.projectV2 || mockProjectV2Response);
      }

      // デフォルトレスポンス
      return Promise.resolve({});
    }),
  };
}

/**
 * モック GitHubClient クラス
 *
 * src/integrations/github/client.ts の GitHubClient をモック化
 */
export class MockGitHubClient {
  private mockOctokit: MockOctokit;

  constructor(options: MockOctokitOptions = {}) {
    this.mockOctokit = createMockOctokit(options);
  }

  get rest(): MockOctokit['rest'] {
    return this.mockOctokit.rest;
  }

  async query<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    return this.mockOctokit.graphql(query, variables) as Promise<T>;
  }

  async verifyAuth(): Promise<{ login: string; id: number; type: string }> {
    const { data } = await this.mockOctokit.rest.users.getAuthenticated();
    return {
      login: data.login,
      id: data.id,
      type: data.type,
    };
  }

  /**
   * モックインスタンスを取得（テストでの検証用）
   */
  getMockOctokit(): MockOctokit {
    return this.mockOctokit;
  }
}

/**
 * GitHubClient モジュールのモック化ヘルパー
 *
 * テストファイルで以下のように使用:
 * ```typescript
 * import { mockGitHubClientModule } from '../__mocks__/octokit.js';
 *
 * mockGitHubClientModule();
 *
 * // テスト実行
 * ```
 */
export function mockGitHubClientModule(options: MockOctokitOptions = {}): MockGitHubClient {
  const mockClient = new MockGitHubClient(options);

  // GitHubClient モジュールをモック化
  jest.mock('../../src/integrations/github/client.js', () => ({
    GitHubClient: jest.fn(() => mockClient),
    initGitHubClient: jest.fn(() => mockClient),
    getGitHubClient: jest.fn(() => mockClient),
  }));

  return mockClient;
}
