/**
 * ワークフロー状態保存コマンド
 *
 * セッション終了（PreCompact フック等）時に呼び出され、
 * 実行中のワークフロー状態をデータベースに保存します。
 *
 * 主な用途:
 * - セッション終了時の自動保存（PreCompact フック経由）
 * - 手動保存（/cft:session-end 経由）
 */

import '../../core/config/env.js';
import { z } from 'zod';
import {
  setWorkflowState,
  deleteWorkflowState as deleteWorkflowStateStorage,
  type WorkflowNextAction,
} from '../../core/storage/index.js';
import { handleCLIError } from '../utils/error-handler.js';

/**
 * コマンド引数スキーマ
 */
const ArgsSchema = z.object({
  specId: z.string().uuid(),
  currentTaskNumber: z.number().int().positive(),
  currentTaskTitle: z.string().min(1),
  nextAction: z.enum(['task_start', 'task_done', 'none']),
  githubIssueNumber: z.number().int().positive().optional(),
});

type Args = z.infer<typeof ArgsSchema>;

/**
 * コマンド出力（JSON形式）
 */
interface SaveStateOutput {
  success: boolean;
  specId: string;
  workflowStateId?: string;
  isUpdate: boolean;
  error?: string;
}

/**
 * ワークフロー状態を保存（UPSERT）
 */
export function saveWorkflowState(args: {
  specId: string;
  currentTaskNumber: number;
  currentTaskTitle: string;
  nextAction: WorkflowNextAction;
  githubIssueNumber?: number;
}): SaveStateOutput {
  const output: SaveStateOutput = {
    success: false,
    specId: args.specId,
    isUpdate: false,
  };

  try {
    // 引数の検証
    const validated = ArgsSchema.parse(args);

    // JSON ストレージに保存（UPSERT 動作）
    const result = setWorkflowState(validated.specId, {
      current_task_number: validated.currentTaskNumber,
      current_task_title: validated.currentTaskTitle,
      next_action: validated.nextAction,
      github_issue_number: validated.githubIssueNumber ?? null,
    });

    output.workflowStateId = result.id;
    // setWorkflowState は常に UPSERT なので、新規作成か更新かは判別できない
    // ここでは isUpdate = false としておく（実装上の制約）
    output.isUpdate = false;

    output.success = true;
    return output;
  } catch (error) {
    output.error = error instanceof Error ? error.message : 'Unknown error';
    return output;
  }
}

/**
 * ワークフロー状態を削除
 *
 * 仕様書が completed フェーズに移行した際などに呼び出され、
 * 不要になったワークフロー状態を削除します。
 */
export function deleteWorkflowState(specId: string): {
  success: boolean;
  deleted: boolean;
  error?: string;
} {
  try {
    const deleted = deleteWorkflowStateStorage(specId);

    return {
      success: true,
      deleted,
    };
  } catch (error) {
    return {
      success: false,
      deleted: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * JSON 出力形式で実行（プロンプトからの呼び出し用）
 */
export function executeSaveStateJson(args: Args): void {
  const output = saveWorkflowState(args);
  console.log(JSON.stringify(output, null, 2));
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const specId = process.argv[2];
  const currentTaskNumber = parseInt(process.argv[3], 10);
  const currentTaskTitle = process.argv[4];
  const nextAction = process.argv[5] as WorkflowNextAction;
  const githubIssueNumber = process.argv[6] ? parseInt(process.argv[6], 10) : undefined;

  if (!specId || isNaN(currentTaskNumber) || !currentTaskTitle || !nextAction) {
    console.error('Error: Missing required arguments');
    console.error(
      'Usage: npx tsx save-state.ts <spec-id> <task-number> <task-title> <next-action> [issue-number]'
    );
    console.error('  next-action: task_start | task_done | none');
    process.exit(1);
  }

  try {
    executeSaveStateJson({
      specId,
      currentTaskNumber,
      currentTaskTitle,
      nextAction,
      githubIssueNumber,
    });
  } catch (error) {
    handleCLIError(error);
  }
}
