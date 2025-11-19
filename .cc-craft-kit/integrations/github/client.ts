import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';

/**
 * GitHub クライアント設定
 */
export interface GitHubClientConfig {
  token: string;
  baseUrl?: string;
  octokit?: Octokit;
  graphqlClient?: typeof graphql;
}

/**
 * GitHub クライアントインターフェース（モック化用）
 */
export interface IGitHubClient {
  readonly rest: Octokit;
  query<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T>;
  verifyAuth(): Promise<{ login: string; id: number; type: string }>;
}

/**
 * GitHub REST + GraphQL 統合クライアント
 */
export class GitHubClient implements IGitHubClient {
  private octokit: Octokit;
  private graphqlClient: typeof graphql;

  constructor(config: GitHubClientConfig) {
    this.octokit =
      config.octokit ||
      new Octokit({
        auth: config.token,
        baseUrl: config.baseUrl || 'https://api.github.com',
      });

    this.graphqlClient =
      config.graphqlClient ||
      graphql.defaults({
        headers: {
          authorization: `token ${config.token}`,
        },
      });
  }

  /**
   * REST API クライアント取得
   */
  get rest(): Octokit {
    return this.octokit;
  }

  /**
   * GraphQL クエリ実行
   */
  async query<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    return this.graphqlClient<T>(query, variables);
  }

  /**
   * 認証確認
   */
  async verifyAuth(): Promise<{ login: string; id: number; type: string }> {
    const { data } = await this.octokit.rest.users.getAuthenticated();
    return {
      login: data.login,
      id: data.id,
      type: data.type,
    };
  }
}

/**
 * グローバル GitHub クライアントインスタンス
 */
let clientInstance: GitHubClient | null = null;

/**
 * GitHub クライアント初期化
 */
export function initGitHubClient(config: GitHubClientConfig): GitHubClient {
  clientInstance = new GitHubClient(config);
  return clientInstance;
}

/**
 * GitHub クライアント取得
 */
export function getGitHubClient(): GitHubClient {
  if (!clientInstance) {
    throw new Error('GitHub client not initialized. Call initGitHubClient() first.');
  }
  return clientInstance;
}
