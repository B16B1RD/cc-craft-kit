import { Plugin, PluginMetadata, MCPTool } from '../../../core/plugins/types.js';
import { Kysely } from 'kysely';
import { Database } from '../../../core/database/schema.js';
import type {
  SyncBacklogIssueParams,
  SyncBacklogIssueResult,
  CreateBacklogWikiParams,
  CreateBacklogWikiResult,
  ListBacklogProjectsResult,
} from '../../types.js';

/**
 * Backlog統合プラグイン
 * Backlog APIと連携してIssue/Wiki/Gitを管理
 */
export class BacklogPlugin implements Plugin {
  metadata: PluginMetadata = {
    name: 'backlog',
    version: '1.0.0',
    description: 'Backlog API integration for issue and wiki management',
    author: 'Takumi Team',
    homepage: 'https://github.com/takumi/plugins/backlog',
    tags: ['backlog', 'issue-tracking', 'project-management'],
    dependencies: {
      axios: '^1.6.0',
    },
  };

  private apiKey?: string;
  private spaceId?: string;
  private baseUrl?: string;

  constructor(_db: Kysely<Database>) {}

  async onLoad(): Promise<void> {
    // 環境変数から設定を読み込み
    this.apiKey = process.env.BACKLOG_API_KEY;
    this.spaceId = process.env.BACKLOG_SPACE_ID;
    this.baseUrl = process.env.BACKLOG_BASE_URL || `https://${this.spaceId}.backlog.jp`;

    if (!this.apiKey || !this.spaceId) {
      console.warn(
        'Backlog plugin: API Key or Space ID not configured. Set BACKLOG_API_KEY and BACKLOG_SPACE_ID environment variables.'
      );
    } else {
      console.log(`✓ Backlog plugin loaded (Space: ${this.spaceId}, URL: ${this.baseUrl})`);
    }
  }

  async onUnload(): Promise<void> {
    console.log('✓ Backlog plugin unloaded');
  }

  /**
   * MCPツールを提供
   */
  getMCPTools(): MCPTool[] {
    return [
      {
        name: 'backlog:sync_issues',
        description: 'Backlog課題とローカルタスクを同期',
        inputSchema: {
          type: 'object',
          properties: {
            specId: {
              type: 'string',
              description: '同期対象のSpec ID',
            },
            projectKey: {
              type: 'string',
              description: 'BacklogプロジェクトKey',
            },
            action: {
              type: 'string',
              enum: ['sync-to-backlog', 'sync-from-backlog', 'bidirectional'],
              description: '同期方向',
            },
          },
          required: ['specId', 'projectKey', 'action'],
        },
        handler: async (params: unknown) => this.syncIssues(params as SyncBacklogIssueParams),
      },
      {
        name: 'backlog:create_wiki',
        description: 'Backlog Wikiページを作成',
        inputSchema: {
          type: 'object',
          properties: {
            projectKey: {
              type: 'string',
              description: 'BacklogプロジェクトKey',
            },
            name: {
              type: 'string',
              description: 'Wikiページ名',
            },
            content: {
              type: 'string',
              description: 'Wikiページ内容（Markdown）',
            },
          },
          required: ['projectKey', 'name', 'content'],
        },
        handler: async (params: unknown) => this.createWiki(params as CreateBacklogWikiParams),
      },
      {
        name: 'backlog:list_projects',
        description: 'Backlogプロジェクト一覧を取得',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        handler: async (_params: unknown) => this.listProjects(),
      },
    ];
  }

  /**
   * Backlog課題同期
   */
  private async syncIssues(params: SyncBacklogIssueParams): Promise<SyncBacklogIssueResult> {
    if (!this.apiKey) {
      return { success: false, error: 'Backlog API Key not configured' };
    }

    // Placeholder implementation
    return {
      success: true,
      issueKey: `${params.projectKey}-1`,
      issueUrl: `${this.baseUrl}/view/${params.projectKey}-1`,
    };
  }

  /**
   * Backlog Wiki作成
   */
  private async createWiki(params: CreateBacklogWikiParams): Promise<CreateBacklogWikiResult> {
    if (!this.apiKey) {
      return { success: false, error: 'Backlog API Key not configured' };
    }

    // Placeholder implementation
    return {
      success: true,
      wikiId: 12345,
      wikiUrl: `${this.baseUrl}/wiki/${params.projectKey}/${params.name}`,
    };
  }

  /**
   * Backlogプロジェクト一覧取得
   */
  private async listProjects(): Promise<ListBacklogProjectsResult> {
    if (!this.apiKey) {
      return { success: false, error: 'Backlog API Key not configured' };
    }

    // Placeholder implementation
    return {
      success: true,
      projects: [
        {
          id: 1,
          projectKey: 'SAMPLE',
          name: 'Sample Project',
        },
      ],
    };
  }
}

/**
 * プラグインのエクスポート
 */
export default function createPlugin(db: Kysely<Database>): Plugin {
  return new BacklogPlugin(db);
}
