#!/usr/bin/env npx tsx
/**
 * SessionStart フック処理（セッション再開時）
 *
 * Claude Code のセッション再開（compact|resume）時に呼び出され、
 * 保存されたワークフロー状態を JSON ストレージから読み込み、
 * Claude Code に適切なガイダンスを出力します。
 *
 * このフックは .claude/settings.json の hooks.SessionStart で設定されます。
 * matcher: "compact|resume" で自動圧縮後または手動再開時に発火します。
 *
 * フックの動作:
 * 1. workflow-state.json から最新の状態を取得
 * 2. 状態が存在する場合、復元ガイダンスを標準出力
 * 3. Claude Code がプロンプトとして認識し、適切なアクションを実行
 */

import '../core/config/env.js';
import { loadWorkflowState, getSpec } from '../core/storage/index.js';

interface WorkflowStateInfo {
  specId: string;
  specName: string;
  currentTaskNumber: number;
  currentTaskTitle: string;
  nextAction: string;
  githubIssueNumber: number | null;
  savedAt: string;
}

/**
 * ワークフロー状態を JSON ストレージから取得
 */
function getWorkflowState(): WorkflowStateInfo | null {
  // 最新の状態を取得（saved_at 降順）
  const allStates = loadWorkflowState();

  if (allStates.length === 0) {
    return null;
  }

  // saved_at で降順ソート
  const sortedStates = allStates.sort(
    (a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
  );

  const latestState = sortedStates[0];

  // 対応する仕様書情報を取得
  const spec = getSpec(latestState.spec_id);
  if (!spec) {
    return null;
  }

  return {
    specId: latestState.spec_id,
    specName: spec.name,
    currentTaskNumber: latestState.current_task_number,
    currentTaskTitle: latestState.current_task_title,
    nextAction: latestState.next_action,
    githubIssueNumber: latestState.github_issue_number,
    savedAt: latestState.saved_at,
  };
}

/**
 * 復元ガイダンスを生成
 */
function generateGuidance(state: WorkflowStateInfo): string {
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
 * メイン処理
 */
function main(): void {
  try {
    const state = getWorkflowState();

    if (!state) {
      // 状態がない場合は何も出力しない
      return;
    }

    // 復元ガイダンスを出力
    console.log(generateGuidance(state));
  } catch (error) {
    console.error(
      'SessionResume hook error:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

main();
