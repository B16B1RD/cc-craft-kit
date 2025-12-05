/**
 * JSON ストレージモジュール
 *
 * SQLite + Kysely から JSON ファイルベースのストレージへの移行モジュール。
 * すべての状態を .cc-craft-kit/meta/ 配下の JSON ファイルで管理します。
 *
 * ファイル構成:
 * - specs.json: 仕様書メタデータ
 * - github-sync.json: GitHub 同期状態
 * - workflow-state.json: ワークフロー状態
 * - tasks.json: タスク情報
 * - logs.jsonl: 操作ログ（JSON Lines 形式）
 */

// 共通ユーティリティ
export {
  readJsonFile,
  writeJsonFile,
  appendJsonlFile,
  ensureMetaDir,
  getMetaDir,
} from './json-storage.js';

// Zod スキーマ
export {
  // 型定義
  type SpecPhase,
  type TaskStatus,
  type GitHubEntityType,
  type WorkflowNextAction,
  type SyncStatus,
  type LogLevel,
  // データ型
  type SpecData,
  type GitHubSyncData,
  type WorkflowStateData,
  type TaskData,
  type LogData,
  // スキーマ
  SpecDataSchema,
  GitHubSyncDataSchema,
  WorkflowStateDataSchema,
  TaskDataSchema,
  LogDataSchema,
} from './schemas.js';

// 各ストレージモジュール
export { loadSpecs, saveSpecs, getSpec, addSpec, updateSpec, deleteSpec } from './specs-storage.js';

export {
  loadGitHubSync,
  saveGitHubSync,
  getGitHubSyncByEntity,
  getGitHubSyncByIssueNumber,
  addGitHubSync,
  updateGitHubSync,
  deleteGitHubSync,
} from './github-sync-storage.js';

export {
  loadWorkflowState,
  saveWorkflowState,
  getWorkflowStateBySpec,
  setWorkflowState,
  deleteWorkflowState,
} from './workflow-state-storage.js';

export {
  loadTasks,
  saveTasks,
  getTask,
  getTasksBySpec,
  addTask,
  updateTask,
  deleteTask,
} from './tasks-storage.js';

export { appendLog, readLogs, readLogsBySpec, readLogsByTask } from './logs-storage.js';
