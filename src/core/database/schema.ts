import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

/**
 * データベーススキーマ定義
 */

// 仕様書フェーズ
export type SpecPhase =
  | 'requirements'
  | 'design'
  | 'tasks'
  | 'implementation'
  | 'testing'
  | 'completed';

// タスクステータス
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'review' | 'done';

// GitHub同期対象エンティティ
export type GitHubEntityType = 'spec' | 'task' | 'issue' | 'project';

/**
 * Specs テーブル - 仕様書管理
 */
export interface SpecsTable {
  id: Generated<string>; // UUID
  name: string;
  description: string | null;
  phase: SpecPhase;
  github_issue_id: number | null;
  github_project_id: string | null;
  github_milestone_id: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export type Spec = Selectable<SpecsTable>;
export type NewSpec = Insertable<SpecsTable>;
export type SpecUpdate = Updateable<SpecsTable>;

/**
 * Tasks テーブル - タスク管理
 */
export interface TasksTable {
  id: Generated<string>; // UUID
  spec_id: string; // FK to specs.id
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number; // 1-5 (1=highest)
  github_issue_id: number | null;
  github_issue_number: number | null;
  assignee: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export type Task = Selectable<TasksTable>;
export type NewTask = Insertable<TasksTable>;
export type TaskUpdate = Updateable<TasksTable>;

/**
 * Logs テーブル - アクションログ
 */
export interface LogsTable {
  id: Generated<string>; // UUID
  task_id: string | null; // FK to tasks.id (nullable)
  spec_id: string | null; // FK to specs.id (nullable)
  action: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata: string | null; // JSON string
  timestamp: ColumnType<Date, string | undefined, never>;
}

export type Log = Selectable<LogsTable>;
export type NewLog = Insertable<LogsTable>;

/**
 * GitHubSync テーブル - GitHub同期状態管理
 */
export interface GitHubSyncTable {
  id: Generated<string>; // UUID
  entity_type: GitHubEntityType;
  entity_id: string; // spec_id or task_id
  github_id: string; // GitHub Issue ID or Project ID
  github_number: number | null; // GitHub Issue番号
  last_synced_at: ColumnType<Date, string | undefined, string>;
  sync_status: 'success' | 'failed' | 'pending';
  error_message: string | null;
}

export type GitHubSync = Selectable<GitHubSyncTable>;
export type NewGitHubSync = Insertable<GitHubSyncTable>;
export type GitHubSyncUpdate = Updateable<GitHubSyncTable>;

/**
 * Database型定義 - すべてのテーブルを含む
 */
export interface Database {
  specs: SpecsTable;
  tasks: TasksTable;
  logs: LogsTable;
  github_sync: GitHubSyncTable;
}
