import { Plugin, PluginMetadata, MCPTool, EventHandler } from '../../../core/plugins/types.js';
import { Kysely } from 'kysely';
import { Database } from '../../../core/database/schema.js';
import type { WorkflowEvent } from '../../../core/workflow/event-bus.js';
import type {
  SendSlackMessageParams,
  SendSlackMessageResult,
  NotifyTaskCompletedParams,
  NotifySpecCreatedParams,
} from '../../types.js';

/**
 * Slack統合プラグイン
 * Slack APIと連携して通知・メッセージ送信を管理
 */
export class SlackPlugin implements Plugin {
  metadata: PluginMetadata = {
    name: 'slack',
    version: '1.0.0',
    description: 'Slack integration for notifications and team communication',
    author: 'Takumi Team',
    homepage: 'https://github.com/takumi/plugins/slack',
    tags: ['slack', 'notifications', 'team-communication'],
    dependencies: {
      '@slack/web-api': '^6.0.0',
    },
  };

  private webhookUrl?: string;
  private botToken?: string;
  private defaultChannel?: string;

  constructor(private db: Kysely<Database>) {}

  async onLoad(): Promise<void> {
    // 環境変数から設定を読み込み
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.botToken = process.env.SLACK_BOT_TOKEN;
    this.defaultChannel = process.env.SLACK_DEFAULT_CHANNEL || '#general';

    if (!this.webhookUrl && !this.botToken) {
      console.warn(
        'Slack plugin: No webhook URL or bot token configured. Set SLACK_WEBHOOK_URL or SLACK_BOT_TOKEN environment variables.'
      );
    } else {
      console.log(`✓ Slack plugin loaded (Channel: ${this.defaultChannel})`);
    }
  }

  async onUnload(): Promise<void> {
    console.log('✓ Slack plugin unloaded');
  }

  /**
   * MCPツールを提供
   */
  getMCPTools(): MCPTool[] {
    return [
      {
        name: 'slack:send_message',
        description: 'Slackチャンネルにメッセージを送信',
        inputSchema: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: '送信先チャンネル（デフォルト: #general）',
            },
            text: {
              type: 'string',
              description: '送信するメッセージ',
            },
            attachments: {
              type: 'array',
              description: 'メッセージの添付ファイル',
              items: {
                type: 'object',
              },
            },
          },
          required: ['text'],
        },
        handler: async (params: unknown) => this.sendMessage(params as SendSlackMessageParams),
      },
      {
        name: 'slack:notify_task_complete',
        description: 'タスク完了をSlackに通知',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: '完了したタスクID',
            },
            channel: {
              type: 'string',
              description: '送信先チャンネル',
            },
          },
          required: ['taskId'],
        },
        handler: async (params: unknown) =>
          this.notifyTaskComplete(params as NotifyTaskCompletedParams),
      },
      {
        name: 'slack:notify_spec_created',
        description: '新規Spec作成をSlackに通知',
        inputSchema: {
          type: 'object',
          properties: {
            specId: {
              type: 'string',
              description: '作成されたSpec ID',
            },
            channel: {
              type: 'string',
              description: '送信先チャンネル',
            },
          },
          required: ['specId'],
        },
        handler: async (params: unknown) =>
          this.notifySpecCreated(params as NotifySpecCreatedParams),
      },
    ];
  }

  /**
   * イベントハンドラーを提供
   */
  getEventHandlers(): EventHandler[] {
    return [
      {
        eventType: 'task.completed',
        handler: this.onTaskCompleted.bind(this) as (event: unknown) => Promise<void>,
        priority: 10,
      },
      {
        eventType: 'spec.created',
        handler: this.onSpecCreated.bind(this) as (event: unknown) => Promise<void>,
        priority: 10,
      },
      {
        eventType: 'spec.phase_changed',
        handler: this.onSpecPhaseChanged.bind(this) as (event: unknown) => Promise<void>,
        priority: 10,
      },
    ];
  }

  /**
   * Slackメッセージ送信
   */
  private async sendMessage(params: SendSlackMessageParams): Promise<SendSlackMessageResult> {
    if (!this.webhookUrl && !this.botToken) {
      return { success: false, error: 'Slack not configured' };
    }

    const channel = params.channel || this.defaultChannel;

    // Placeholder implementation
    console.log(`[Slack] Sending to ${channel}: ${params.text}`);

    return {
      success: true,
      message: `Message sent to ${channel}`,
    };
  }

  /**
   * タスク完了通知
   */
  private async notifyTaskComplete(
    params: NotifyTaskCompletedParams
  ): Promise<SendSlackMessageResult> {
    // タスク情報を取得
    const task = await this.db
      .selectFrom('tasks')
      .where('id', '=', params.taskId)
      .selectAll()
      .executeTakeFirst();

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    const message = `✅ タスク完了: *${task.title}*`;

    return this.sendMessage({
      channel: params.channel,
      text: message,
      attachments: [
        {
          color: 'good',
          fields: [
            {
              title: 'タスク',
              value: task.title,
              short: false,
            },
            {
              title: 'ステータス',
              value: task.status,
              short: true,
            },
            {
              title: '優先度',
              value: String(task.priority),
              short: true,
            },
          ],
        },
      ],
    });
  }

  /**
   * Spec作成通知
   */
  private async notifySpecCreated(
    params: NotifySpecCreatedParams
  ): Promise<SendSlackMessageResult> {
    // Spec情報を取得
    const spec = await this.db
      .selectFrom('specs')
      .where('id', '=', params.specId)
      .selectAll()
      .executeTakeFirst();

    if (!spec) {
      return { success: false, error: 'Spec not found' };
    }

    const message = `📋 新規仕様書作成: *${spec.name}*`;

    return this.sendMessage({
      channel: params.channel,
      text: message,
      attachments: [
        {
          color: '#36a64f',
          fields: [
            {
              title: '仕様書',
              value: spec.name,
              short: false,
            },
            {
              title: '説明',
              value: spec.description || 'なし',
              short: false,
            },
            {
              title: 'フェーズ',
              value: spec.phase,
              short: true,
            },
          ],
        },
      ],
    });
  }

  /**
   * タスク完了イベントハンドラー
   */
  private async onTaskCompleted(event: WorkflowEvent<{ taskId: string }>): Promise<void> {
    if (!this.webhookUrl && !this.botToken) {
      return; // Slack未設定の場合はスキップ
    }

    await this.notifyTaskComplete({
      taskId: event.data.taskId,
    });
  }

  /**
   * Spec作成イベントハンドラー
   */
  private async onSpecCreated(event: WorkflowEvent<{ specId: string }>): Promise<void> {
    if (!this.webhookUrl && !this.botToken) {
      return;
    }

    await this.notifySpecCreated({
      specId: event.specId,
    });
  }

  /**
   * Specフェーズ変更イベントハンドラー
   */
  private async onSpecPhaseChanged(
    event: WorkflowEvent<{ oldPhase: string; newPhase: string }>
  ): Promise<void> {
    if (!this.webhookUrl && !this.botToken) {
      return;
    }

    const message = `🔄 仕様書フェーズ変更: ${event.data.oldPhase} → ${event.data.newPhase}`;

    await this.sendMessage({
      text: message,
    });
  }
}

/**
 * プラグインのエクスポート
 */
export default function createPlugin(db: Kysely<Database>): Plugin {
  return new SlackPlugin(db);
}
