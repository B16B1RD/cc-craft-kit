/**
 * ワークフロー状態復元コマンド
 *
 * セッション再開（SessionStart フック等）時に呼び出され、
 * 保存されたワークフロー状態をデータベースから読み込み、
 * Claude Code が適切なアクションを実行できるよう情報を出力します。
 *
 * 主な用途:
 * - セッション再開時の自動復元（SessionStart フック経由）
 * - 手動復元（/cft:session-start 経由）
 */

import '../../core/config/env.js';
import { getWorkflowStateBySpec, loadWorkflowState, getSpec } from '../../core/storage/index.js';
import { handleCLIError } from '../utils/error-handler.js';

/**
 * 復元された状態の出力形式
 */
interface RestoreStateOutput {
  success: boolean;
  hasState: boolean;
  state?: {
    specId: string;
    specName: string;
    currentTaskNumber: number;
    currentTaskTitle: string;
    nextAction: string;
    githubIssueNumber: number | null;
    savedAt: string;
  };
  promptMessage?: string;
  error?: string;
}

/**
 * ワークフロー状態を復元
 *
 * @param specId - 特定の仕様書 ID を指定（省略時は最新の状態を取得）
 */
export function restoreWorkflowState(specId?: string): RestoreStateOutput {
  const output: RestoreStateOutput = {
    success: false,
    hasState: false,
  };

  try {
    let workflowState;

    if (specId) {
      // 特定の仕様書のワークフロー状態を取得
      workflowState = getWorkflowStateBySpec(specId);
    } else {
      // 最新のワークフロー状態を取得
      const allStates = loadWorkflowState();
      if (allStates.length > 0) {
        // saved_at の降順でソート
        allStates.sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime());
        workflowState = allStates[0];
      }
    }

    if (!workflowState) {
      output.success = true;
      output.hasState = false;
      return output;
    }

    // 仕様書名を取得
    const spec = getSpec(workflowState.spec_id);
    const specName = spec?.name ?? 'Unknown';

    output.state = {
      specId: workflowState.spec_id,
      specName,
      currentTaskNumber: workflowState.current_task_number,
      currentTaskTitle: workflowState.current_task_title,
      nextAction: workflowState.next_action,
      githubIssueNumber: workflowState.github_issue_number,
      savedAt: workflowState.saved_at ?? '',
    };

    // Claude Code へのプロンプトメッセージを生成
    output.promptMessage = generatePromptMessage(output.state);

    output.success = true;
    output.hasState = true;
    return output;
  } catch (error) {
    output.error = error instanceof Error ? error.message : 'Unknown error';
    return output;
  }
}

/**
 * Claude Code に渡すプロンプトメッセージを生成
 */
function generatePromptMessage(state: NonNullable<RestoreStateOutput['state']>): string {
  const lines: string[] = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '📋 セッション再開: ワークフロー状態が復元されました',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `仕様書: ${state.specName}`,
    `仕様書 ID: ${state.specId}`,
    '',
    `現在のタスク: ${state.currentTaskNumber}. ${state.currentTaskTitle}`,
  ];

  if (state.githubIssueNumber) {
    lines.push(`Sub Issue: #${state.githubIssueNumber}`);
  }

  lines.push('');

  // 次のアクションに応じたガイダンスを追加
  switch (state.nextAction) {
    case 'task_start':
      lines.push('⚠️ 次のアクション: タスク開始処理を実行してください');
      lines.push('');
      lines.push('実行コマンド:');
      if (state.githubIssueNumber) {
        lines.push(`  npx tsx .cc-craft-kit/commands/task/start.ts ${state.githubIssueNumber}`);
      }
      lines.push('');
      lines.push('その後、タスクの実装を続行してください。');
      break;

    case 'task_done':
      lines.push('⚠️ 次のアクション: タスク完了処理を実行してください');
      lines.push('');
      lines.push('タスクの実装が完了している場合、以下を実行:');
      if (state.githubIssueNumber) {
        lines.push(`  npx tsx .cc-craft-kit/commands/task/done.ts ${state.githubIssueNumber}`);
      }
      lines.push('');
      lines.push('Sub Issue がクローズされ、次のタスクに進みます。');
      break;

    case 'none':
    default:
      lines.push('ℹ️ 特定の次アクションはありません');
      lines.push('');
      lines.push('実装を続行してください。');
      lines.push(`仕様書: /cft:spec-get ${state.specId.substring(0, 8)}`);
      break;
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return lines.join('\n');
}

/**
 * JSON 出力形式で実行（プログラムからの呼び出し用）
 */
export function executeRestoreStateJson(specId?: string): void {
  const output = restoreWorkflowState(specId);
  console.log(JSON.stringify(output, null, 2));
}

/**
 * プロンプトメッセージのみを出力（フックからの呼び出し用）
 *
 * フックからの呼び出し時は、Claude Code がプロンプトとして
 * 認識できるよう、プロンプトメッセージのみを出力します。
 */
export function executeRestoreStatePrompt(specId?: string): void {
  const output = restoreWorkflowState(specId);

  if (output.success && output.hasState && output.promptMessage) {
    console.log(output.promptMessage);
  }
  // 状態がない場合は何も出力しない（フックでは空出力は無視される）
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2]; // 'json' または 'prompt' または spec-id
  const specId = process.argv[3];

  try {
    if (mode === 'json') {
      executeRestoreStateJson(specId);
    } else if (mode === 'prompt') {
      executeRestoreStatePrompt(specId);
    } else {
      // デフォルトはプロンプトモード
      const targetSpecId = mode; // mode が spec-id の場合
      executeRestoreStatePrompt(targetSpecId);
    }
  } catch (error) {
    handleCLIError(error);
  }
}
