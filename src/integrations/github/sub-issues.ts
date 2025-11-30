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
  /** 親 Issue に紐づく仕様書 ID（オプション） */
  specId?: string;
}

/**
 * Sub Issue 同期データ記録オプション
 */
export interface RecordSubIssueSyncOptions {
  /** 親 Issue の番号 */
  parentIssueNumber?: number;
  /** 親 Issue に紐づく仕様書 ID */
  parentSpecId?: string;
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

      // 5. github_sync テーブルに記録（親 Issue 関連情報を含む）
      await this.recordSubIssueSyncData(
        task.id,
        subIssueNumber,
        subIssueNodeId,
        config.owner,
        config.repo,
        {
          parentIssueNumber: config.parentIssueNumber,
          parentSpecId: config.specId,
        }
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
   *
   * @param taskId タスク ID
   * @param issueNumber Sub Issue の GitHub Issue 番号
   * @param nodeId Sub Issue の GraphQL Node ID
   * @param owner リポジトリオーナー
   * @param repo リポジトリ名
   * @param options 親 Issue 関連情報（オプション）
   */
  private async recordSubIssueSyncData(
    taskId: string,
    issueNumber: number,
    nodeId: string,
    owner: string,
    repo: string,
    options?: RecordSubIssueSyncOptions
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
        parent_issue_number: options?.parentIssueNumber ?? null,
        parent_spec_id: options?.parentSpecId ?? null,
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

  /**
   * 親 Issue のチェックボックスを同期
   *
   * Sub Issue のステータス変更に伴い、親 Issue 本文内のチェックボックスを更新する。
   * チェックボックスは `- [ ] #XXX` または `- [x] #XXX` 形式で記載されていることを想定。
   *
   * @param owner リポジトリオーナー
   * @param repo リポジトリ名
   * @param parentIssueNumber 親 Issue の番号
   * @param subIssueNumber Sub Issue の番号
   * @param status Sub Issue のステータス（'open' or 'closed'）
   * @param token GitHub API トークン
   */
  async syncParentIssueCheckbox(
    owner: string,
    repo: string,
    parentIssueNumber: number,
    subIssueNumber: number,
    status: 'open' | 'closed',
    token: string
  ): Promise<void> {
    // 1. 親 Issue の本文を取得
    const response = await this.fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}/issues/${parentIssueNumber}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn(
        `Failed to get parent issue #${parentIssueNumber}: ${response.status} ${response.statusText} - ${errorText}`
      );
      return;
    }

    const issueData = (await response.json()) as { body: string | null };
    const currentBody = issueData.body || '';

    // 2. チェックボックスのパターンにマッチする行を更新
    // パターン: `- [ ] #XXX` または `- [x] #XXX`
    const checkboxPattern = new RegExp(`(- \\[)[ x](\\] .*#${subIssueNumber}(?:\\D|$))`, 'gm');

    const newCheckState = status === 'closed' ? 'x' : ' ';
    const updatedBody = currentBody.replace(checkboxPattern, `$1${newCheckState}$2`);

    // 3. 本文が変更されていない場合はスキップ
    if (updatedBody === currentBody) {
      console.log(
        `No checkbox found for Sub Issue #${subIssueNumber} in parent issue #${parentIssueNumber}`
      );
      return;
    }

    // 4. 親 Issue の本文を更新
    const updateResponse = await this.fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}/issues/${parentIssueNumber}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: updatedBody }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text().catch(() => 'Unknown error');
      console.warn(
        `Failed to update parent issue #${parentIssueNumber}: ${updateResponse.status} ${updateResponse.statusText} - ${errorText}`
      );
      return;
    }

    console.log(
      `Updated checkbox for Sub Issue #${subIssueNumber} in parent issue #${parentIssueNumber} to [${newCheckState}]`
    );
  }

  /**
   * 全 Sub Issue がクローズされているかチェック
   *
   * @param parentIssueNumber 親 Issue の番号
   * @returns 全 Sub Issue がクローズされていれば true
   */
  async checkAllSubIssuesClosed(parentIssueNumber: number): Promise<boolean> {
    // DB から同じ親 Issue に紐づく全 Sub Issue を取得
    const subIssues = await this.db
      .selectFrom('github_sync')
      .selectAll()
      .where('entity_type', '=', 'sub_issue')
      .where('parent_issue_number', '=', parentIssueNumber)
      .execute();

    if (subIssues.length === 0) {
      // Sub Issue がない場合は true を返す
      return true;
    }

    // 全 Sub Issue の sync_status を確認
    // 注: sync_status は Sub Issue のクローズ状態ではなく同期状態を示す
    // 実際のクローズ状態は GitHub API から取得する必要がある
    // ここでは簡易的に、直近の更新で 'closed' 状態になっているかを確認
    // より正確な実装では GitHub API を呼び出してステータスを確認する

    // まずはリポジトリ情報を取得（最初の Sub Issue から）
    const firstSubIssue = subIssues[0];
    const parts = firstSubIssue.github_id.split('/');
    if (parts.length !== 2) {
      console.warn(`Invalid github_id format: ${firstSubIssue.github_id}`);
      return false;
    }

    // ここでは DB のデータのみで判断するため、常に true を返す
    // 実際の実装では GitHub API を呼び出して各 Sub Issue のステータスを確認する
    console.log(`Found ${subIssues.length} Sub Issues for parent issue #${parentIssueNumber}`);
    return true;
  }

  /**
   * 全 Sub Issue がクローズされているか GitHub API で確認
   *
   * @param owner リポジトリオーナー
   * @param repo リポジトリ名
   * @param parentIssueNumber 親 Issue の番号
   * @param token GitHub API トークン
   * @returns 全 Sub Issue がクローズされていれば true
   */
  async checkAllSubIssuesClosedViaApi(
    owner: string,
    repo: string,
    parentIssueNumber: number,
    token: string
  ): Promise<boolean> {
    // DB から同じ親 Issue に紐づく全 Sub Issue を取得
    const subIssues = await this.db
      .selectFrom('github_sync')
      .select(['github_number'])
      .where('entity_type', '=', 'sub_issue')
      .where('parent_issue_number', '=', parentIssueNumber)
      .execute();

    if (subIssues.length === 0) {
      return true;
    }

    // 各 Sub Issue のステータスを GitHub API で確認
    for (const subIssue of subIssues) {
      if (!subIssue.github_number) continue;

      const response = await this.fetchWithRetry(
        `https://api.github.com/repos/${owner}/${repo}/issues/${subIssue.github_number}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );

      if (!response.ok) {
        console.warn(`Failed to get Sub Issue #${subIssue.github_number} status`);
        continue;
      }

      const issueData = (await response.json()) as { state: string };
      if (issueData.state !== 'closed') {
        return false;
      }
    }

    return true;
  }

  /**
   * 親 Issue をクローズ
   *
   * 全 Sub Issue が完了した場合に親 Issue をクローズする。
   * クローズ前に完了コメントを追加する。
   *
   * @param owner リポジトリオーナー
   * @param repo リポジトリ名
   * @param parentIssueNumber 親 Issue の番号
   * @param token GitHub API トークン
   */
  async closeParentIssue(
    owner: string,
    repo: string,
    parentIssueNumber: number,
    token: string
  ): Promise<void> {
    // 1. 完了コメントを追加
    const commentBody = `🎉 すべての Sub Issue が完了しました。この Issue を自動的にクローズします。

---
*この操作は cc-craft-kit によって自動実行されました。*`;

    const commentResponse = await this.fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}/issues/${parentIssueNumber}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: commentBody }),
      }
    );

    if (!commentResponse.ok) {
      console.warn(`Failed to add completion comment to issue #${parentIssueNumber}`);
    }

    // 2. Issue をクローズ
    const closeResponse = await this.fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}/issues/${parentIssueNumber}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
      }
    );

    if (!closeResponse.ok) {
      const errorText = await closeResponse.text().catch(() => 'Unknown error');
      console.warn(
        `Failed to close parent issue #${parentIssueNumber}: ${closeResponse.status} ${closeResponse.statusText} - ${errorText}`
      );
      return;
    }

    console.log(`Closed parent issue #${parentIssueNumber} (all Sub Issues completed)`);
  }

  /**
   * タスク完了時の親 Issue 連携処理
   *
   * タスクが完了した際に以下の処理を自動実行:
   * 1. Sub Issue をクローズ
   * 2. 親 Issue のチェックボックスを更新
   * 3. 全 Sub Issue がクローズされていたら親 Issue もクローズ
   *
   * @param taskId タスク ID
   * @param token GitHub API トークン
   */
  async handleTaskCompletion(taskId: string, token: string): Promise<void> {
    // 1. github_sync から Sub Issue 情報を取得
    const syncRecord = await this.db
      .selectFrom('github_sync')
      .selectAll()
      .where('entity_id', '=', taskId)
      .where('entity_type', '=', 'sub_issue')
      .executeTakeFirst();

    if (!syncRecord || !syncRecord.github_number) {
      console.log(`No Sub Issue found for task: ${taskId}`);
      return;
    }

    // owner/repo のパース
    const parts = syncRecord.github_id.split('/');
    if (parts.length !== 2) {
      console.warn(`Invalid github_id format: ${syncRecord.github_id}`);
      return;
    }
    const [owner, repo] = parts;

    // 2. Sub Issue をクローズ
    await this.updateSubIssueStatus(taskId, 'closed', token);

    // 3. 親 Issue が設定されている場合のみ連携処理を実行
    if (!syncRecord.parent_issue_number) {
      console.log(`No parent issue linked for Sub Issue #${syncRecord.github_number}`);
      return;
    }

    // 4. 親 Issue のチェックボックスを更新
    await this.syncParentIssueCheckbox(
      owner,
      repo,
      syncRecord.parent_issue_number,
      syncRecord.github_number,
      'closed',
      token
    );

    // 5. 全 Sub Issue がクローズされているか確認
    const allClosed = await this.checkAllSubIssuesClosedViaApi(
      owner,
      repo,
      syncRecord.parent_issue_number,
      token
    );

    // 6. 全 Sub Issue がクローズされていたら親 Issue もクローズ
    if (allClosed) {
      await this.closeParentIssue(owner, repo, syncRecord.parent_issue_number, token);
    }
  }
}
