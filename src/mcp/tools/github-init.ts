import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { initGitHubClient } from '../../integrations/github/client.js';
import fs from 'fs/promises';
import path from 'path';

interface InitGitHubParams {
  token: string;
  saveToConfig?: boolean;
}

interface InitGitHubResult {
  success: boolean;
  user?: {
    login: string;
    id: number;
    type: string;
  };
  message?: string;
  error?: string;
}

interface CreateGitHubIssueParams {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

interface CreateGitHubIssueResult {
  success: boolean;
  issue?: {
    number: number;
    title: string;
    url: string;
    state: string;
    createdAt: string;
  };
  error?: string;
}

/**
 * GitHub認証初期化ツール
 */
export const initGitHubTool: Tool & {
  handler: (params: InitGitHubParams) => Promise<InitGitHubResult>;
} = {
  name: 'takumi:init_github',
  description: 'GitHub Personal Access Tokenを使用してGitHub統合を初期化します。',
  inputSchema: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'GitHub Personal Access Token',
      },
      saveToConfig: {
        type: 'boolean',
        description: 'トークンを.takumi/config.jsonに保存するか',
      },
    },
    required: ['token'],
  },

  async handler(args: InitGitHubParams): Promise<InitGitHubResult> {
    try {
      // GitHub クライアント初期化
      const client = initGitHubClient({ token: args.token });

      // 認証確認
      const user = await client.verifyAuth();

      // 設定ファイルに保存
      if (args.saveToConfig) {
        const configPath = path.join(process.cwd(), '.takumi', 'config.json');
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);

        config.github = {
          token: args.token,
          user: user.login,
          userId: user.id,
        };

        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      }

      return {
        success: true,
        user: {
          login: user.login,
          id: user.id,
          type: user.type,
        },
        message: `GitHub認証が完了しました。ユーザー: ${user.login}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

/**
 * GitHub Issue作成ツール
 */
export const createGitHubIssueTool: Tool & {
  handler: (params: CreateGitHubIssueParams) => Promise<CreateGitHubIssueResult>;
} = {
  name: 'takumi:create_github_issue',
  description: 'GitHub Issueを直接作成します。',
  inputSchema: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: 'GitHubオーナー名' },
      repo: { type: 'string', description: 'リポジトリ名' },
      title: { type: 'string', description: 'Issue タイトル' },
      body: { type: 'string', description: 'Issue 本文' },
      labels: { type: 'array', items: { type: 'string' }, description: 'ラベルリスト' },
      assignees: { type: 'array', items: { type: 'string' }, description: 'アサイニー' },
      milestone: { type: 'number', description: 'マイルストーン番号' },
    },
    required: ['owner', 'repo', 'title'],
  },

  async handler(args: CreateGitHubIssueParams): Promise<CreateGitHubIssueResult> {
    try {
      const { GitHubIssues } = await import('../../integrations/github/issues.js');
      const { getGitHubClient } = await import('../../integrations/github/client.js');

      const client = getGitHubClient();
      const issues = new GitHubIssues(client);

      const issue = await issues.create({
        owner: args.owner,
        repo: args.repo,
        title: args.title,
        body: args.body,
        labels: args.labels,
        assignees: args.assignees,
        milestone: args.milestone,
      });

      return {
        success: true,
        issue: {
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          state: issue.state,
          createdAt: issue.created_at,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
