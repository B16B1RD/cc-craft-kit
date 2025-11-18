import { Kysely } from 'kysely';
import { Database } from '../../core/database/schema.js';
import crypto from 'crypto';

/**
 * Webhook イベント種別
 */
export type WebhookEventType = 'issues' | 'issue_comment' | 'project_card' | 'milestone';

/**
 * Webhook ペイロード
 */
export interface WebhookPayload {
  action: string;
  issue?: {
    number: number;
    title: string;
    body: string;
    state: 'open' | 'closed';
    labels: Array<{ name: string }>;
  };
  comment?: {
    id: number;
    body: string;
    user: { login: string };
  };
  repository: {
    name: string;
    owner: { login: string };
  };
}

/**
 * Webhook 署名検証
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

/**
 * GitHub Webhook ハンドラー
 */
export class GitHubWebhookHandler {
  constructor(private db: Kysely<Database>) {}

  /**
   * Issue イベント処理
   */
  async handleIssueEvent(payload: WebhookPayload): Promise<void> {
    if (!payload.issue) return;

    const { action, issue } = payload;

    // 紐づく仕様書を検索
    const spec = await this.db
      .selectFrom('specs')
      .where('github_issue_id', '=', issue.number)
      .selectAll()
      .executeTakeFirst();

    if (!spec) {
      console.log(`No spec linked to issue #${issue.number}`);
      return;
    }

    // アクション別処理
    switch (action) {
      case 'closed':
        await this.handleIssueClosed(spec.id, issue);
        break;
      case 'reopened':
        await this.handleIssueReopened(spec.id, issue);
        break;
      case 'edited':
        await this.handleIssueEdited(spec.id, issue);
        break;
      case 'labeled':
        await this.handleIssueLabeled(spec.id, issue);
        break;
    }

    // 同期ログ記録
    const { randomUUID } = await import('crypto');
    await this.db
      .insertInto('github_sync')
      .values({
        id: randomUUID(),
        entity_type: 'issue',
        entity_id: spec.id,
        github_id: issue.number.toString(),
        github_number: issue.number,
        last_synced_at: new Date().toISOString(),
        sync_status: 'success',
        error_message: null,
      })
      .execute();
  }

  /**
   * Issue コメントイベント処理
   */
  async handleIssueCommentEvent(payload: WebhookPayload): Promise<void> {
    if (!payload.issue || !payload.comment) return;

    const { issue, comment } = payload;

    // 紐づく仕様書を検索
    const spec = await this.db
      .selectFrom('specs')
      .where('github_issue_id', '=', issue.number)
      .selectAll()
      .executeTakeFirst();

    if (!spec) return;

    // cc-craft-kitによる自動コメントは無視
    if (comment.body.includes('🤖 cc-craft-kit')) {
      return;
    }

    // コメントをログに記録
    const { randomUUID } = await import('crypto');
    await this.db
      .insertInto('logs')
      .values({
        id: randomUUID(),
        task_id: null,
        spec_id: spec.id,
        action: 'github_comment',
        level: 'info',
        message: `GitHub comment by ${comment.user.login}: ${comment.body.substring(0, 100)}`,
        metadata: JSON.stringify({
          commentId: comment.id,
          issueNumber: issue.number,
          author: comment.user.login,
        }),
        timestamp: new Date().toISOString(),
      })
      .execute();
  }

  /**
   * Issue クローズ処理
   */
  private async handleIssueClosed(specId: string, issue: { number: number }): Promise<void> {
    await this.db
      .updateTable('specs')
      .set({
        phase: 'completed',
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', specId)
      .execute();

    const { randomUUID } = await import('crypto');
    await this.db
      .insertInto('logs')
      .values({
        id: randomUUID(),
        task_id: null,
        spec_id: specId,
        action: 'issue_closed',
        level: 'info',
        message: `Spec marked as completed (Issue #${issue.number} closed)`,
        metadata: JSON.stringify({ issueNumber: issue.number }),
        timestamp: new Date().toISOString(),
      })
      .execute();
  }

  /**
   * Issue 再オープン処理
   */
  private async handleIssueReopened(specId: string, issue: { number: number }): Promise<void> {
    await this.db
      .updateTable('specs')
      .set({
        phase: 'implementation',
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', specId)
      .execute();

    const { randomUUID } = await import('crypto');
    await this.db
      .insertInto('logs')
      .values({
        id: randomUUID(),
        task_id: null,
        spec_id: specId,
        action: 'issue_reopened',
        level: 'info',
        message: `Spec reopened (Issue #${issue.number} reopened)`,
        metadata: JSON.stringify({ issueNumber: issue.number }),
        timestamp: new Date().toISOString(),
      })
      .execute();
  }

  /**
   * Issue 編集処理
   */
  private async handleIssueEdited(specId: string, issue: { title: string }): Promise<void> {
    // タイトルから仕様名を抽出
    const match = issue.title.match(/^\[.*?\]\s*(.+)$/);
    const name = match ? match[1] : issue.title;

    await this.db
      .updateTable('specs')
      .set({
        name,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', specId)
      .execute();
  }

  /**
   * Issue ラベル追加処理
   */
  private async handleIssueLabeled(
    specId: string,
    issue: { labels: Array<{ name: string }> }
  ): Promise<void> {
    // フェーズラベルをチェック
    const phaseLabel = issue.labels.find((l) => l.name.startsWith('phase:'));

    if (phaseLabel) {
      const phase = phaseLabel.name.replace('phase:', '');
      const validPhases = ['requirements', 'design', 'tasks', 'implementation', 'completed'];

      if (validPhases.includes(phase)) {
        await this.db
          .updateTable('specs')
          .set({
            phase: phase as 'requirements' | 'design' | 'tasks' | 'implementation' | 'completed',
            updated_at: new Date().toISOString(),
          })
          .where('id', '=', specId)
          .execute();
      }
    }
  }
}
