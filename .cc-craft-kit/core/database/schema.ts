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
export type GitHubEntityType = 'spec' | 'task' | 'issue' | 'project' | 'sub_issue';

/**
 * Specs テーブル - 仕様書管理
 *
 * GitHub 関連情報は github_sync テーブルで管理されます
 */
export interface SpecsTable {
  id: Generated<string>; // UUID
  name: string;
  description: string | null;
  phase: SpecPhase;
  branch_name: string | null; // 仕様書が作成されたブランチ名（PR マージ後はクリア）
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
  github_node_id: string | null; // GraphQL で使用する Node ID (Sub Issue 対応)
  issue_number: number | null; // GitHub Issue番号（後方互換性のため）
  issue_url: string | null; // GitHub Issue URL
  pr_number: number | null; // GitHub PR番号
  pr_url: string | null; // GitHub PR URL
  pr_merged_at: ColumnType<Date, string | undefined, string> | null; // PR マージ日時
  last_synced_at: ColumnType<Date, string | undefined, string>;
  updated_at: ColumnType<Date, string | undefined, string>; // 更新日時
  sync_status: 'success' | 'failed' | 'pending';
  error_message: string | null;
  checkbox_hash: string | null; // チェックボックス状態のハッシュ（競合検出用）
  last_body_hash: string | null; // 最後に同期した Issue 本文のハッシュ
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
