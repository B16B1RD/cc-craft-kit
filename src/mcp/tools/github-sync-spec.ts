import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getDatabase } from '../../core/database/connection.js';
import { getGitHubClient } from '../../integrations/github/client.js';
import { GitHubIssues } from '../../integrations/github/issues.js';
import { GitHubProjects } from '../../integrations/github/projects.js';
import { GitHubSyncService } from '../../integrations/github/sync.js';

interface SyncSpecToGitHubParams {
  specId: string;
  owner: string;
  repo: string;
  createIfNotExists?: boolean;
}

interface SyncSpecToGitHubResult {
  success: boolean;
  issueNumber?: number;
  issueUrl?: string;
  spec?: {
    id: string;
    name: string;
    phase: string;
    githubIssueId: number | null;
  };
  error?: string;
}

interface SyncGitHubToSpecParams {
  owner: string;
  repo: string;
  issueNumber: number;
}

interface SyncGitHubToSpecResult {
  success: boolean;
  spec?: {
    id: string;
    name: string;
    phase: string;
    description: string | null;
    githubIssueId: number | null;
  };
  error?: string;
}

interface AddSpecToProjectParams {
  specId: string;
  owner: string;
  projectNumber: number;
}

interface AddSpecToProjectResult {
  success: boolean;
  projectItemId?: string;
  spec?: {
    id: string;
    name: string;
    githubProjectId: string | null;
  };
  error?: string;
}

/**
 * 仕様書をGitHub Issueに同期するツール
 */
export const syncSpecToGitHubTool: Tool & {
  handler: (params: SyncSpecToGitHubParams) => Promise<SyncSpecToGitHubResult>;
} = {
  name: 'takumi:sync_spec_to_github',
  description: '仕様書をGitHub Issueに同期します。Issueが存在しない場合は新規作成します。',
  inputSchema: {
    type: 'object',
    properties: {
      specId: { type: 'string', description: '仕様書ID' },
      owner: { type: 'string', description: 'GitHubオーナー名' },
      repo: { type: 'string', description: 'リポジトリ名' },
      createIfNotExists: { type: 'boolean', description: 'Issueが存在しない場合に作成するか' },
    },
    required: ['specId', 'owner', 'repo'],
  },

  async handler(args: SyncSpecToGitHubParams): Promise<SyncSpecToGitHubResult> {
    try {
      const db = getDatabase();
      const client = getGitHubClient();
      const issues = new GitHubIssues(client);
      const projects = new GitHubProjects(client);
      const syncService = new GitHubSyncService(db, issues, projects);

      const issueNumber = await syncService.syncSpecToIssue({
        specId: args.specId,
        owner: args.owner,
        repo: args.repo,
        createIfNotExists: args.createIfNotExists,
      });

      const spec = await db
        .selectFrom('specs')
        .where('id', '=', args.specId)
        .selectAll()
        .executeTakeFirstOrThrow();

      return {
        success: true,
        issueNumber,
        issueUrl: `https://github.com/${args.owner}/${args.repo}/issues/${issueNumber}`,
        spec: {
          id: spec.id,
          name: spec.name,
          phase: spec.phase,
          githubIssueId: spec.github_issue_id,
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

/**
 * GitHub IssueからSpec更新ツール
 */
export const syncGitHubToSpecTool: Tool & {
  handler: (params: SyncGitHubToSpecParams) => Promise<SyncGitHubToSpecResult>;
} = {
  name: 'takumi:sync_github_to_spec',
  description: 'GitHub Issueの状態を仕様書に反映します。',
  inputSchema: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: 'GitHubオーナー名' },
      repo: { type: 'string', description: 'リポジトリ名' },
      issueNumber: { type: 'number', description: 'Issue番号' },
    },
    required: ['owner', 'repo', 'issueNumber'],
  },

  async handler(args: SyncGitHubToSpecParams): Promise<SyncGitHubToSpecResult> {
    try {
      const db = getDatabase();
      const client = getGitHubClient();
      const issues = new GitHubIssues(client);
      const projects = new GitHubProjects(client);
      const syncService = new GitHubSyncService(db, issues, projects);

      const specId = await syncService.syncIssueToSpec({
        owner: args.owner,
        repo: args.repo,
        issueNumber: args.issueNumber,
      });

      const spec = await db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirstOrThrow();

      return {
        success: true,
        spec: {
          id: spec.id,
          name: spec.name,
          phase: spec.phase,
          description: spec.description,
          githubIssueId: spec.github_issue_id,
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

/**
 * 仕様書をProjectに追加ツール
 */
export const addSpecToProjectTool: Tool & {
  handler: (params: AddSpecToProjectParams) => Promise<AddSpecToProjectResult>;
} = {
  name: 'takumi:add_spec_to_project',
  description: '仕様書をGitHub Project V2に追加します。',
  inputSchema: {
    type: 'object',
    properties: {
      specId: { type: 'string', description: '仕様書ID' },
      owner: { type: 'string', description: 'GitHubオーナー名' },
      projectNumber: { type: 'number', description: 'Project番号' },
    },
    required: ['specId', 'owner', 'projectNumber'],
  },

  async handler(args: AddSpecToProjectParams): Promise<AddSpecToProjectResult> {
    try {
      const db = getDatabase();
      const client = getGitHubClient();
      const issues = new GitHubIssues(client);
      const projects = new GitHubProjects(client);
      const syncService = new GitHubSyncService(db, issues, projects);

      const itemId = await syncService.addSpecToProject({
        specId: args.specId,
        owner: args.owner,
        projectNumber: args.projectNumber,
      });

      const spec = await db
        .selectFrom('specs')
        .where('id', '=', args.specId)
        .selectAll()
        .executeTakeFirstOrThrow();

      return {
        success: true,
        projectItemId: itemId,
        spec: {
          id: spec.id,
          name: spec.name,
          githubProjectId: spec.github_project_id,
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
