/**
 * ワークフロー状態管理
 *
 * workflow-state.json ファイルを読み書きし、
 * セッション間でのワークフロー状態を管理します。
 */

import { randomUUID } from 'node:crypto';
import { readJsonFile, writeJsonFile, getJsonFilePath } from './json-storage.js';
import {
  WorkflowStateDataSchema,
  WorkflowStateFileSchema,
  type WorkflowStateData,
  type WorkflowNextAction,
} from './schemas.js';

const WORKFLOW_STATE_FILE = 'workflow-state.json';

/**
 * ワークフロー状態ファイルパスを取得
 */
function getWorkflowStateFilePath(baseDir?: string): string {
  return getJsonFilePath(WORKFLOW_STATE_FILE, baseDir);
}

/**
 * すべてのワークフロー状態を読み込む
 */
export function loadWorkflowState(baseDir?: string): WorkflowStateData[] {
  const filePath = getWorkflowStateFilePath(baseDir);
  const data = readJsonFile<WorkflowStateData>(filePath);

  const result = WorkflowStateFileSchema.safeParse(data);
  if (!result.success) {
    console.warn(`Warning: Invalid data in ${filePath}:`, result.error.issues);
    return data.filter((item) => WorkflowStateDataSchema.safeParse(item).success);
  }

  return result.data;
}

/**
 * すべてのワークフロー状態を保存する
 */
export function saveWorkflowState(states: WorkflowStateData[], baseDir?: string): void {
  const filePath = getWorkflowStateFilePath(baseDir);

  const result = WorkflowStateFileSchema.safeParse(states);
  if (!result.success) {
    throw new Error(`Invalid workflow state data: ${result.error.message}`);
  }

  writeJsonFile(filePath, result.data);
}

/**
 * 仕様書 ID でワークフロー状態を取得
 */
export function getWorkflowStateBySpec(
  specId: string,
  baseDir?: string
): WorkflowStateData | undefined {
  const states = loadWorkflowState(baseDir);
  return states.find((s) => s.spec_id === specId);
}

/**
 * ワークフロー状態を設定（更新または新規作成）
 */
export function setWorkflowState(
  specId: string,
  state: Omit<WorkflowStateData, 'id' | 'spec_id' | 'saved_at' | 'updated_at'>,
  baseDir?: string
): WorkflowStateData {
  const states = loadWorkflowState(baseDir);
  const now = new Date().toISOString();

  const existingIndex = states.findIndex((s) => s.spec_id === specId);

  if (existingIndex !== -1) {
    // 既存のレコードを更新
    const updatedState: WorkflowStateData = {
      ...states[existingIndex],
      ...state,
      updated_at: now,
    };

    WorkflowStateDataSchema.parse(updatedState);

    states[existingIndex] = updatedState;
    saveWorkflowState(states, baseDir);

    return updatedState;
  } else {
    // 新規レコードを作成
    const newState: WorkflowStateData = {
      id: randomUUID(),
      spec_id: specId,
      ...state,
      saved_at: now,
      updated_at: now,
    };

    WorkflowStateDataSchema.parse(newState);

    states.push(newState);
    saveWorkflowState(states, baseDir);

    return newState;
  }
}

/**
 * ワークフロー状態を削除
 */
export function deleteWorkflowState(specId: string, baseDir?: string): boolean {
  const states = loadWorkflowState(baseDir);
  const index = states.findIndex((s) => s.spec_id === specId);

  if (index === -1) {
    return false;
  }

  states.splice(index, 1);
  saveWorkflowState(states, baseDir);

  return true;
}

/**
 * 次のアクションを更新
 */
export function updateNextAction(
  specId: string,
  nextAction: WorkflowNextAction,
  baseDir?: string
): WorkflowStateData | undefined {
  const state = getWorkflowStateBySpec(specId, baseDir);

  if (!state) {
    return undefined;
  }

  return setWorkflowState(
    specId,
    {
      current_task_number: state.current_task_number,
      current_task_title: state.current_task_title,
      next_action: nextAction,
      github_issue_number: state.github_issue_number,
    },
    baseDir
  );
}

/**
 * 現在のタスクを進める
 */
export function advanceTask(
  specId: string,
  taskNumber: number,
  taskTitle: string,
  githubIssueNumber: number | null,
  baseDir?: string
): WorkflowStateData {
  return setWorkflowState(
    specId,
    {
      current_task_number: taskNumber,
      current_task_title: taskTitle,
      next_action: 'task_start',
      github_issue_number: githubIssueNumber,
    },
    baseDir
  );
}
