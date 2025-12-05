/**
 * タスク完了コマンド
 *
 * Sub Issue に関連するタスクの完了を記録し、
 * task.completed イベントを発火します。
 *
 * このコマンドは /cft:task-done プロンプトから呼び出され、
 * イベント駆動アーキテクチャを通じて以下の処理を自動実行します:
 *
 * 1. Sub Issue のクローズ（github-integration.ts のハンドラー）
 * 2. GitHub Projects のステータス更新（Done へ変更）
 */

import '../../core/config/env.js';
import { z } from 'zod';
import { getGitHubSyncByIssueNumber } from '../../core/storage/index.js';
import { getEventBusAsync } from '../../core/workflow/event-bus.js';
import { handleCLIError } from '../utils/error-handler.js';

/**
 * コマンド引数スキーマ
 */
const ArgsSchema = z.object({
  issueNumber: z.number().int().positive(),
  specId: z.string().min(8).optional(),
  taskId: z.string().uuid().optional(),
});

/**
 * コマンド出力（JSON形式）
 */
interface TaskDoneOutput {
  success: boolean;
  issueNumber: number;
  specId?: string;
  taskId?: string;
  eventEmitted: boolean;
  error?: string;
}

/**
 * Issue 番号から関連する Sub Issue 情報を取得
 */
function getSubIssueInfo(issueNumber: number): { specId: string; taskId: string } | null {
  // github-sync.json から Sub Issue 情報を検索
  const syncRecord = getGitHubSyncByIssueNumber(issueNumber);

  if (!syncRecord || syncRecord.entity_type !== 'sub_issue') {
    return null;
  }

  // entity_id は task_id として使用されている
  // parent_spec_id は Sub Issue 作成時に記録されている
  return {
    specId: syncRecord.parent_spec_id || '',
    taskId: syncRecord.entity_id,
  };
}

/**
 * タスク完了コマンドを実行
 */
export async function executeTaskDone(
  issueNumber: number,
  options: { specId?: string; taskId?: string } = {}
): Promise<TaskDoneOutput> {
  const output: TaskDoneOutput = {
    success: false,
    issueNumber,
    eventEmitted: false,
  };

  try {
    // 引数の検証
    const args = ArgsSchema.parse({
      issueNumber,
      specId: options.specId,
      taskId: options.taskId,
    });

    output.issueNumber = args.issueNumber;

    // taskId が指定されていない場合、JSON ストレージから取得を試みる
    let taskId = args.taskId;
    let specId = args.specId;

    if (!taskId) {
      const subIssueInfo = getSubIssueInfo(args.issueNumber);
      if (subIssueInfo) {
        taskId = subIssueInfo.taskId;
        if (!specId && subIssueInfo.specId) {
          specId = subIssueInfo.specId;
        }
      }
    }

    output.taskId = taskId;
    output.specId = specId;

    // taskId がない場合でもイベントは発火する（ハンドラー側でスキップ）
    if (!taskId) {
      console.log(
        `ℹ️ No task ID found for Issue #${args.issueNumber}, event will be emitted without taskId`
      );
    }

    // イベントバスを取得（ハンドラー登録を待機）
    const eventBus = await getEventBusAsync();

    // task.completed イベントを発火
    const event = eventBus.createEvent<{ taskId: string }>(
      'task.completed',
      specId || '',
      { taskId: taskId || '' },
      taskId
    );

    await eventBus.emit(event);
    output.eventEmitted = true;

    output.success = true;
    return output;
  } catch (error) {
    output.error = error instanceof Error ? error.message : 'Unknown error';
    return output;
  }
}

/**
 * JSON 出力形式で実行（プロンプトからの呼び出し用）
 */
export async function executeTaskDoneJson(
  issueNumber: number,
  options: { specId?: string; taskId?: string } = {}
): Promise<void> {
  const output = await executeTaskDone(issueNumber, options);
  console.log(JSON.stringify(output, null, 2));
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const issueNumber = parseInt(process.argv[2], 10);
  const specId = process.argv[3] || undefined;
  const taskId = process.argv[4] || undefined;

  if (isNaN(issueNumber)) {
    console.error('Error: issue-number is required and must be a number');
    console.error('Usage: npx tsx done.ts <issue-number> [spec-id] [task-id]');
    process.exit(1);
  }

  executeTaskDoneJson(issueNumber, { specId, taskId }).catch((error) => handleCLIError(error));
}
