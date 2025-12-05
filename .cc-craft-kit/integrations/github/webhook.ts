import { join } from 'node:path';
import { existsSync } from 'node:fs';
import crypto from 'crypto';
import { CheckboxSyncService, formatCheckboxChangeSummary } from './checkbox-sync.js';
import {
  getSpec,
  updateSpec,
  appendLog,
  getGitHubSyncByIssueNumber,
  addGitHubSync,
  type SpecPhase,
} from '../../core/storage/index.js';

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
  /**
   * Issue イベント処理
   */
  async handleIssueEvent(payload: WebhookPayload): Promise<void> {
    if (!payload.issue) return;

    const { action, issue } = payload;

    // 紐づく仕様書を検索 (JSON ストレージ経由)
    const syncRecord = getGitHubSyncByIssueNumber(issue.number);

    if (!syncRecord) {
      console.log(`No spec linked to issue #${issue.number}`);
      return;
    }

    const spec = getSpec(syncRecord.entity_id);

    if (!spec) {
      console.log(`No spec linked to issue #${issue.number}`);
      return;
    }

    // アクション別処理
    switch (action) {
      case 'closed':
        this.handleIssueClosed(spec.id, issue);
        break;
      case 'reopened':
        this.handleIssueReopened(spec.id, issue);
        break;
      case 'edited':
        await this.handleIssueEdited(spec.id, {
          title: issue.title,
          body: issue.body,
        });
        break;
      case 'labeled':
        this.handleIssueLabeled(spec.id, issue);
        break;
    }

    // 同期ログ記録
    addGitHubSync({
      entity_type: 'issue',
      entity_id: spec.id,
      github_id: issue.number.toString(),
      github_number: issue.number,
      github_node_id: null,
      issue_number: issue.number,
      issue_url: null,
      pr_number: null,
      pr_url: null,
      pr_merged_at: null,
      sync_status: 'success',
      error_message: null,
      checkbox_hash: null,
      last_body_hash: null,
      parent_issue_number: null,
      parent_spec_id: null,
    });
  }

  /**
   * Issue コメントイベント処理
   */
  handleIssueCommentEvent(payload: WebhookPayload): void {
    if (!payload.issue || !payload.comment) return;

    const { issue, comment } = payload;

    // 紐づく仕様書を検索 (JSON ストレージ経由)
    const syncRecord = getGitHubSyncByIssueNumber(issue.number);

    if (!syncRecord) return;

    const spec = getSpec(syncRecord.entity_id);

    if (!spec) return;

    // cc-craft-kitによる自動コメントは無視
    if (comment.body.includes('🤖 cc-craft-kit')) {
      return;
    }

    // コメントをログに記録
    appendLog({
      task_id: null,
      spec_id: spec.id,
      action: 'github_comment',
      level: 'info',
      message: `GitHub comment by ${comment.user.login}: ${comment.body.substring(0, 100)}`,
      metadata: {
        commentId: comment.id,
        issueNumber: issue.number,
        author: comment.user.login,
      },
    });
  }

  /**
   * Issue クローズ処理
   */
  private handleIssueClosed(specId: string, issue: { number: number }): void {
    updateSpec(specId, {
      phase: 'completed' as SpecPhase,
      updated_at: new Date().toISOString(),
    });

    appendLog({
      task_id: null,
      spec_id: specId,
      action: 'issue_closed',
      level: 'info',
      message: `Spec marked as completed (Issue #${issue.number} closed)`,
      metadata: { issueNumber: issue.number },
    });
  }

  /**
   * Issue 再オープン処理
   */
  private handleIssueReopened(specId: string, issue: { number: number }): void {
    updateSpec(specId, {
      phase: 'implementation' as SpecPhase,
      updated_at: new Date().toISOString(),
    });

    appendLog({
      task_id: null,
      spec_id: specId,
      action: 'issue_reopened',
      level: 'info',
      message: `Spec reopened (Issue #${issue.number} reopened)`,
      metadata: { issueNumber: issue.number },
    });
  }

  /**
   * Issue 編集処理
   *
   * タイトル変更時は仕様名を更新し、本文変更時はチェックボックス状態を仕様書に同期する。
   */
  private async handleIssueEdited(
    specId: string,
    issue: { title: string; body: string }
  ): Promise<void> {
    // タイトルから仕様名を抽出
    const match = issue.title.match(/^\[.*?\]\s*(.+)$/);
    const name = match ? match[1] : issue.title;

    updateSpec(specId, {
      name,
      updated_at: new Date().toISOString(),
    });

    // チェックボックス同期（Issue → 仕様書）
    if (issue.body) {
      const specPath = join(process.cwd(), '.cc-craft-kit', 'specs', `${specId}.md`);

      if (existsSync(specPath)) {
        try {
          const checkboxSync = new CheckboxSyncService();
          const result = await checkboxSync.syncToSpec(specId, specPath, issue.body);

          if (result.success && result.changes.length > 0) {
            const summary = formatCheckboxChangeSummary(result.changes);
            console.log(`✓ Checkbox sync (Issue → Spec): ${summary}`);

            // ログに記録
            appendLog({
              task_id: null,
              spec_id: specId,
              action: 'checkbox_sync',
              level: 'info',
              message: `Checkbox sync from Issue: ${summary}`,
              metadata: {
                direction: 'to_spec',
                changes: result.changes,
              },
            });
          }
        } catch (error) {
          console.error('Failed to sync checkboxes from Issue:', error);
        }
      }
    }
  }

  /**
   * Issue ラベル追加処理
   */
  private handleIssueLabeled(specId: string, issue: { labels: Array<{ name: string }> }): void {
    // フェーズラベルをチェック
    const phaseLabel = issue.labels.find((l) => l.name.startsWith('phase:'));

    if (phaseLabel) {
      const phase = phaseLabel.name.replace('phase:', '');
      const validPhases = ['requirements', 'design', 'tasks', 'implementation', 'completed'];

      if (validPhases.includes(phase)) {
        updateSpec(specId, {
          phase: phase as SpecPhase,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }
}
