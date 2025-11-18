import { graphql } from '@octokit/graphql';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/database/schema.js';
import { z } from 'zod';

/**
 * GitHub API レスポンススキーマ
 */
const GitHubIssueSchema = z.object({
  node_id: z.string(),
  number: z.number(),
  html_url: z.string().optional(),
});

/**
 * Sub Issue 作成設定
 */
export interface SubIssueConfig {
  owner: string;
  repo: string;
  parentIssueNumber: number;
  taskList: Array<{ id: string; title: string; description?: string }>;
  githubToken: string;
}

/**
 * Sub Issue 作成時の定数
 */
const MAX_SUB_ISSUES_PER_ISSUE = 100;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Sub Issue Manager
 * GitHub の Sub Issue 機能を使用してタスクを管理
 */
export class SubIssueManager {
  private graphqlClientCache: Map<string, ReturnType<typeof graphql.defaults>> = new Map();

  constructor(private db: Kysely<Database>) {}

  /**
   * レート制限対応の fetch ラッパー
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries: number = MAX_RETRIES
  ): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
      const response = await fetch(url, options);

      // レート制限チェック
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter
          ? parseInt(retryAfter) * 1000
          : INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);

        console.warn(
          `Rate limited, retrying after ${waitTime}ms (attempt ${attempt + 1}/${retries})`
        );
        await new Promise((resolve) => globalThis.setTimeout(resolve, waitTime));
        continue;
      }

      return response;
    }

    throw new Error(`Max retries (${retries}) exceeded due to rate limiting`);
  }

  /**
   * GraphQL クライアントを取得（キャッシュ付き）
   */
  private getGraphQLClient(token: string): ReturnType<typeof graphql.defaults> {
    if (!this.graphqlClientCache.has(token)) {
      this.graphqlClientCache.set(
        token,
        graphql.defaults({
          headers: {
            authorization: `token ${token}`,
            'GraphQL-Features': 'sub_issues',
          },
        })
      );
    }
    return this.graphqlClientCache.get(token)!;
  }

  /**
   * 仕様書のタスクリストから Sub Issue を一括作成
   */
  async createSubIssuesFromTaskList(config: SubIssueConfig): Promise<void> {
    // 1. 親 Issue の Node ID を取得
    const parentNodeId = await this.getIssueNodeId(
      config.owner,
      config.repo,
      config.parentIssueNumber,
      config.githubToken
    );

    // 2. タスク数が GitHub の制限を超える場合はエラー
    if (config.taskList.length > MAX_SUB_ISSUES_PER_ISSUE) {
      throw new Error(
        `Task count (${config.taskList.length}) exceeds GitHub limit (${MAX_SUB_ISSUES_PER_ISSUE})`
      );
    }

    // 3. 各タスクを Sub Issue として作成
    for (const task of config.taskList) {
      const subIssueNumber = await this.createSubIssue(
        config.owner,
        config.repo,
        task.title,
        task.description,
        config.githubToken
      );

      // 4. 親 Issue に Sub Issue を追加
      const subIssueNodeId = await this.getIssueNodeId(
        config.owner,
        config.repo,
        subIssueNumber,
        config.githubToken
      );

      await this.addSubIssueToParent(parentNodeId, subIssueNodeId, config.githubToken);

      // 5. github_sync テーブルに記録
      await this.recordSubIssueSyncData(
        task.id,
        subIssueNumber,
        subIssueNodeId,
        config.owner,
        config.repo
      );
    }
  }

  /**
   * REST API で Issue の Node ID を取得
   */
  private async getIssueNodeId(
    owner: string,
    repo: string,
    issueNumber: number,
    token: string
  ): Promise<string> {
    const response = await this.fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Failed to get issue (${response.status} ${response.statusText}): ${errorText}`
      );
    }

    const rawData = await response.json();
    const issue = GitHubIssueSchema.parse(rawData);
    return issue.node_id;
  }

  /**
   * REST API で Sub Issue を作成
   */
  private async createSubIssue(
    owner: string,
    repo: string,
    title: string,
    body: string | undefined,
    token: string
  ): Promise<number> {
    const response = await this.fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body: body || '',
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Failed to create sub issue (${response.status} ${response.statusText}): ${errorText}`
      );
    }

    const rawData = await response.json();
    const issue = GitHubIssueSchema.parse(rawData);
    return issue.number;
  }

  /**
   * GraphQL API で親 Issue に Sub Issue を追加
   */
  private async addSubIssueToParent(
    parentNodeId: string,
    subIssueNodeId: string,
    token: string
  ): Promise<void> {
    const mutation = `
      mutation addSubIssue($parentId: ID!, $subIssueId: ID!) {
        addSubIssue(input: { issueId: $parentId, subIssueId: $subIssueId }) {
          issue {
            title
            subIssues {
              totalCount
            }
          }
          subIssue {
            title
            number
          }
        }
      }
    `;

    const graphqlClient = this.getGraphQLClient(token);

    await graphqlClient(mutation, {
      parentId: parentNodeId,
      subIssueId: subIssueNodeId,
    });
  }

  /**
   * github_sync テーブルに Sub Issue 情報を記録
   */
  private async recordSubIssueSyncData(
    taskId: string,
    issueNumber: number,
    nodeId: string,
    owner: string,
    repo: string
  ): Promise<void> {
    const { randomUUID } = await import('crypto');
    const repository = `${owner}/${repo}`;

    await this.db
      .insertInto('github_sync')
      .values({
        id: randomUUID(),
        entity_type: 'sub_issue',
        entity_id: taskId,
        github_id: repository, // owner/repo 形式で保存
        github_number: issueNumber,
        github_node_id: nodeId,
        last_synced_at: new Date().toISOString(),
        sync_status: 'success',
        error_message: null,
      })
      .execute();
  }

  /**
   * Sub Issue のステータスを更新（タスク完了時）
   */
  async updateSubIssueStatus(
    taskId: string,
    status: 'open' | 'closed',
    token: string
  ): Promise<void> {
    // 1. github_sync から Sub Issue の GitHub Issue 番号を取得
    const syncRecord = await this.db
      .selectFrom('github_sync')
      .selectAll()
      .where('entity_id', '=', taskId)
      .where('entity_type', '=', 'sub_issue')
      .executeTakeFirst();

    if (!syncRecord) {
      throw new Error(`Sub issue not found for task: ${taskId}`);
    }

    // owner/repo のパースとバリデーション
    const parts = syncRecord.github_id.split('/');
    if (parts.length !== 2) {
      throw new Error(`Invalid github_id format (expected "owner/repo"): ${syncRecord.github_id}`);
    }
    const [owner, repo] = parts;

    // 2. REST API で Issue のステータスを更新
    const response = await this.fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}/issues/${syncRecord.github_number}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: status,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Failed to update sub issue status (${response.status} ${response.statusText}): ${errorText}`
      );
    }

    // 3. github_sync の last_synced_at を更新
    await this.db
      .updateTable('github_sync')
      .set({ last_synced_at: new Date().toISOString() })
      .where('id', '=', syncRecord.id)
      .execute();
  }
}
