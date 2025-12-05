/**
 * タスク情報管理
 *
 * tasks.json ファイルを読み書きし、タスク情報を管理します。
 */

import { randomUUID } from 'node:crypto';
import { readJsonFile, writeJsonFile, getJsonFilePath } from './json-storage.js';
import { TaskDataSchema, TasksFileSchema, type TaskData, type TaskStatus } from './schemas.js';

const TASKS_FILE = 'tasks.json';

/**
 * タスクファイルパスを取得
 */
function getTasksFilePath(baseDir?: string): string {
  return getJsonFilePath(TASKS_FILE, baseDir);
}

/**
 * すべてのタスクを読み込む
 */
export function loadTasks(baseDir?: string): TaskData[] {
  const filePath = getTasksFilePath(baseDir);
  const data = readJsonFile<TaskData>(filePath);

  const result = TasksFileSchema.safeParse(data);
  if (!result.success) {
    console.warn(`Warning: Invalid data in ${filePath}:`, result.error.issues);
    return data.filter((item) => TaskDataSchema.safeParse(item).success);
  }

  return result.data;
}

/**
 * すべてのタスクを保存する
 */
export function saveTasks(tasks: TaskData[], baseDir?: string): void {
  const filePath = getTasksFilePath(baseDir);

  const result = TasksFileSchema.safeParse(tasks);
  if (!result.success) {
    throw new Error(`Invalid tasks data: ${result.error.message}`);
  }

  writeJsonFile(filePath, result.data);
}

/**
 * タスクを ID で取得
 */
export function getTask(id: string, baseDir?: string): TaskData | undefined {
  const tasks = loadTasks(baseDir);
  return tasks.find((t) => t.id === id);
}

/**
 * 仕様書 ID でタスクを取得
 */
export function getTasksBySpec(specId: string, baseDir?: string): TaskData[] {
  const tasks = loadTasks(baseDir);
  return tasks.filter((t) => t.spec_id === specId);
}

/**
 * 新しいタスクを追加
 */
export function addTask(
  task: Omit<TaskData, 'id' | 'created_at' | 'updated_at'>,
  baseDir?: string
): TaskData {
  const tasks = loadTasks(baseDir);
  const now = new Date().toISOString();

  const newTask: TaskData = {
    id: randomUUID(),
    ...task,
    created_at: now,
    updated_at: now,
  };

  TaskDataSchema.parse(newTask);

  tasks.push(newTask);
  saveTasks(tasks, baseDir);

  return newTask;
}

/**
 * タスクを更新
 */
export function updateTask(
  id: string,
  updates: Partial<Omit<TaskData, 'id' | 'created_at'>>,
  baseDir?: string
): TaskData | undefined {
  const tasks = loadTasks(baseDir);
  const index = tasks.findIndex((t) => t.id === id);

  if (index === -1) {
    return undefined;
  }

  const updatedTask: TaskData = {
    ...tasks[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  TaskDataSchema.parse(updatedTask);

  tasks[index] = updatedTask;
  saveTasks(tasks, baseDir);

  return updatedTask;
}

/**
 * タスクを削除
 */
export function deleteTask(id: string, baseDir?: string): boolean {
  const tasks = loadTasks(baseDir);
  const index = tasks.findIndex((t) => t.id === id);

  if (index === -1) {
    return false;
  }

  tasks.splice(index, 1);
  saveTasks(tasks, baseDir);

  return true;
}

/**
 * 仕様書 ID でタスクを削除
 */
export function deleteTasksBySpec(specId: string, baseDir?: string): number {
  const tasks = loadTasks(baseDir);
  const originalLength = tasks.length;

  const remainingTasks = tasks.filter((t) => t.spec_id !== specId);
  saveTasks(remainingTasks, baseDir);

  return originalLength - remainingTasks.length;
}

/**
 * タスクのステータスを更新
 */
export function updateTaskStatus(
  id: string,
  status: TaskStatus,
  baseDir?: string
): TaskData | undefined {
  return updateTask(id, { status }, baseDir);
}

/**
 * ステータスでタスクをフィルタリング
 */
export function getTasksByStatus(status: TaskStatus, baseDir?: string): TaskData[] {
  const tasks = loadTasks(baseDir);
  return tasks.filter((t) => t.status === status);
}

/**
 * GitHub Issue 番号でタスクを取得
 */
export function getTaskByGitHubIssueNumber(
  issueNumber: number,
  baseDir?: string
): TaskData | undefined {
  const tasks = loadTasks(baseDir);
  return tasks.find((t) => t.github_issue_number === issueNumber);
}

/**
 * タスクの数を取得
 */
export function countTasks(baseDir?: string): number {
  const tasks = loadTasks(baseDir);
  return tasks.length;
}

/**
 * 仕様書のタスク数を取得
 */
export function countTasksBySpec(specId: string, baseDir?: string): number {
  const tasks = getTasksBySpec(specId, baseDir);
  return tasks.length;
}
