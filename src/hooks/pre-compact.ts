#!/usr/bin/env npx tsx
/**
 * PreCompact フック処理
 *
 * Claude Code のコンテキスト圧縮（自動/手動）直前に呼び出され、
 * 実行中のワークフロー状態をデータベースに保存します。
 *
 * このフックは .claude/settings.json の hooks.PreCompact で設定されます。
 *
 * フックの動作:
 * 1. implementation フェーズの仕様書を検索
 * 2. 仕様書の「## 8. 実装タスクリスト」から現在のタスク状態を取得
 * 3. workflow_state テーブルに UPSERT
 * 4. 標準出力に保存完了メッセージ（Claude Code へのフィードバック）
 */

import '../core/config/env.js';
import { getDatabase, closeDatabase } from '../core/database/connection.js';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { WorkflowNextAction } from '../core/database/schema.js';

interface TaskInfo {
  taskNumber: number;
  title: string;
  issueNumber: number | null;
  isCompleted: boolean;
}

interface WorkflowStateInfo {
  specId: string;
  specName: string;
  currentTaskNumber: number;
  currentTaskTitle: string;
  nextAction: WorkflowNextAction;
  githubIssueNumber: number | null;
}

/**
 * 仕様書ファイルからタスクリストを解析
 */
function parseTaskList(specPath: string): TaskInfo[] {
  const content = fs.readFileSync(specPath, 'utf-8');
  const tasks: TaskInfo[] = [];

  // 「## 8. 実装タスクリスト」セクションを探す
  const taskListMatch = content.match(/## 8\. 実装タスクリスト[\s\S]*?(?=\n## |\n---|$)/);
  if (!taskListMatch) {
    return tasks;
  }

  const taskListSection = taskListMatch[0];

  // チェックボックスをパース
  // 形式: - [ ] タスク内容 (#123) または - [x] タスク内容 (#123)
  const taskRegex = /- \[([ x])\] (.+?)(?:\s+\(#(\d+)\))?$/gm;
  let match: RegExpExecArray | null;
  let taskNumber = 0;

  while ((match = taskRegex.exec(taskListSection)) !== null) {
    taskNumber++;
    const isCompleted = match[1] === 'x';
    const title = match[2].trim();
    const issueNumber = match[3] ? parseInt(match[3], 10) : null;

    tasks.push({
      taskNumber,
      title,
      issueNumber,
      isCompleted,
    });
  }

  return tasks;
}

/**
 * 現在実行中のタスクを特定
 *
 * - 未完了タスクの最初のものを「現在のタスク」とする
 * - 完了と未完了の境界にあるタスクを見つける
 */
function findCurrentTask(tasks: TaskInfo[]): TaskInfo | null {
  // 最初の未完了タスクを探す
  const currentTask = tasks.find((task) => !task.isCompleted);
  return currentTask || null;
}

/**
 * 次のアクションを判定
 *
 * - 現在のタスクが未開始なら 'task_start'
 * - 現在のタスクが進行中なら 'task_done'
 * - すべて完了なら 'none'
 */
function determineNextAction(tasks: TaskInfo[], currentTask: TaskInfo | null): WorkflowNextAction {
  if (!currentTask) {
    return 'none';
  }

  // 直前のタスクが完了済みなら、このタスクは開始直後
  const previousTask = tasks.find((t) => t.taskNumber === currentTask.taskNumber - 1);
  if (previousTask?.isCompleted || currentTask.taskNumber === 1) {
    // 進行中と判断（task_done が必要）
    return 'task_done';
  }

  return 'task_start';
}

/**
 * implementation フェーズの仕様書を検索し、ワークフロー状態を取得
 */
async function getActiveWorkflowState(): Promise<WorkflowStateInfo | null> {
  const db = getDatabase();

  // implementation フェーズの仕様書を取得
  const implementingSpecs = await db
    .selectFrom('specs')
    .select(['id', 'name'])
    .where('phase', '=', 'implementation')
    .execute();

  if (implementingSpecs.length === 0) {
    return null;
  }

  // 各仕様書についてタスクリストを解析
  const specsDir = path.join(process.cwd(), '.cc-craft-kit', 'specs');

  for (const spec of implementingSpecs) {
    const specPath = path.join(specsDir, `${spec.id}.md`);

    if (!fs.existsSync(specPath)) {
      continue;
    }

    const tasks = parseTaskList(specPath);
    const currentTask = findCurrentTask(tasks);

    if (currentTask) {
      const nextAction = determineNextAction(tasks, currentTask);

      return {
        specId: spec.id,
        specName: spec.name,
        currentTaskNumber: currentTask.taskNumber,
        currentTaskTitle: currentTask.title,
        nextAction,
        githubIssueNumber: currentTask.issueNumber,
      };
    }
  }

  return null;
}

/**
 * ワークフロー状態をデータベースに保存
 */
async function saveWorkflowState(state: WorkflowStateInfo): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();

  // 既存のレコードを確認
  const existing = await db
    .selectFrom('workflow_state')
    .select(['id'])
    .where('spec_id', '=', state.specId)
    .executeTakeFirst();

  if (existing) {
    // UPDATE
    await db
      .updateTable('workflow_state')
      .set({
        current_task_number: state.currentTaskNumber,
        current_task_title: state.currentTaskTitle,
        next_action: state.nextAction,
        github_issue_number: state.githubIssueNumber,
        saved_at: now,
        updated_at: now,
      })
      .where('spec_id', '=', state.specId)
      .execute();
  } else {
    // INSERT
    await db
      .insertInto('workflow_state')
      .values({
        id: randomUUID(),
        spec_id: state.specId,
        current_task_number: state.currentTaskNumber,
        current_task_title: state.currentTaskTitle,
        next_action: state.nextAction,
        github_issue_number: state.githubIssueNumber,
        saved_at: now,
        updated_at: now,
      })
      .execute();
  }
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  try {
    const state = await getActiveWorkflowState();

    if (!state) {
      // アクティブなワークフローがない場合は何も出力しない
      return;
    }

    // ワークフロー状態を保存
    await saveWorkflowState(state);

    // Claude Code へのフィードバック（標準出力）
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 ワークフロー状態を保存しました');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`仕様書: ${state.specName}`);
    console.log(`現在のタスク: ${state.currentTaskNumber}. ${state.currentTaskTitle}`);
    if (state.githubIssueNumber) {
      console.log(`Sub Issue: #${state.githubIssueNumber}`);
    }
    console.log(`次のアクション: ${state.nextAction}`);
    console.log('');
    console.log('セッション再開時にこの状態が自動的に復元されます。');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('PreCompact hook error:', error instanceof Error ? error.message : String(error));
  } finally {
    await closeDatabase();
  }
}

main();
