/**
 * JSON ストレージ用 Zod スキーマ定義
 *
 * 既存の Kysely スキーマ（src/core/database/schema.ts）から
 * Zod スキーマへの移行定義です。
 */

import { z } from 'zod';

// ============================================================================
// 共通型定義
// ============================================================================

/**
 * 仕様書フェーズ
 *
 * 5 フェーズモデル: requirements → design → implementation → review → completed
 *
 * @deprecated 'tasks' フェーズは非推奨です。design フェーズでタスク分割を行います。
 */
export const SpecPhaseSchema = z.enum([
  'requirements',
  'design',
  'tasks', // 非推奨: 後方互換性のため維持
  'implementation',
  'review',
  'completed',
]);
export type SpecPhase = z.infer<typeof SpecPhaseSchema>;

/**
 * タスクステータス
 */
export const TaskStatusSchema = z.enum(['todo', 'in_progress', 'blocked', 'review', 'done']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * GitHub 同期対象エンティティ
 */
export const GitHubEntityTypeSchema = z.enum(['spec', 'task', 'issue', 'project', 'sub_issue']);
export type GitHubEntityType = z.infer<typeof GitHubEntityTypeSchema>;

/**
 * ワークフロー次アクション
 */
export const WorkflowNextActionSchema = z.enum(['task_start', 'task_done', 'none']);
export type WorkflowNextAction = z.infer<typeof WorkflowNextActionSchema>;

/**
 * 同期ステータス
 */
export const SyncStatusSchema = z.enum(['success', 'failed', 'pending', 'synced']);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

/**
 * ログレベル
 */
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

// ============================================================================
// データスキーマ定義
// ============================================================================

/**
 * 仕様書データスキーマ
 *
 * specs.json の各レコードの形式
 */
export const SpecDataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  phase: SpecPhaseSchema,
  branch_name: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type SpecData = z.infer<typeof SpecDataSchema>;

/**
 * GitHub 同期状態データスキーマ
 *
 * github-sync.json の各レコードの形式
 */
export const GitHubSyncDataSchema = z.object({
  id: z.string().uuid(),
  entity_type: GitHubEntityTypeSchema,
  entity_id: z.string(), // spec_id or task_id
  github_id: z.string(), // GitHub Issue ID or Project ID
  github_number: z.number().int().nullable(),
  github_node_id: z.string().nullable(), // GraphQL Node ID
  issue_number: z.number().int().nullable(), // 後方互換
  issue_url: z.string().url().nullable(),
  pr_number: z.number().int().nullable(),
  pr_url: z.string().url().nullable(),
  pr_merged_at: z.string().datetime().nullable(),
  last_synced_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  sync_status: SyncStatusSchema,
  error_message: z.string().nullable(),
  checkbox_hash: z.string().nullable(),
  last_body_hash: z.string().nullable(),
  parent_issue_number: z.number().int().nullable(),
  parent_spec_id: z.string().uuid().nullable(),
});
export type GitHubSyncData = z.infer<typeof GitHubSyncDataSchema>;

/**
 * ワークフロー状態データスキーマ
 *
 * workflow-state.json の各レコードの形式
 */
export const WorkflowStateDataSchema = z.object({
  id: z.string().uuid(),
  spec_id: z.string().uuid(),
  current_task_number: z.number().int().min(1),
  current_task_title: z.string(),
  next_action: WorkflowNextActionSchema,
  github_issue_number: z.number().int().nullable(),
  saved_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type WorkflowStateData = z.infer<typeof WorkflowStateDataSchema>;

/**
 * タスクデータスキーマ
 *
 * tasks.json の各レコードの形式
 */
export const TaskDataSchema = z.object({
  id: z.string().uuid(),
  spec_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  status: TaskStatusSchema,
  priority: z.number().int().min(1).max(5),
  github_issue_id: z.number().int().nullable(),
  github_issue_number: z.number().int().nullable(),
  assignee: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type TaskData = z.infer<typeof TaskDataSchema>;

/**
 * ログデータスキーマ
 *
 * logs.jsonl の各行の形式
 */
export const LogDataSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid().nullable(),
  spec_id: z.string().uuid().nullable(),
  action: z.string(),
  level: LogLevelSchema,
  message: z.string(),
  metadata: z.record(z.unknown()).nullable(), // JSON object
  timestamp: z.string().datetime(),
});
export type LogData = z.infer<typeof LogDataSchema>;

// ============================================================================
// 配列スキーマ（ファイル全体のバリデーション用）
// ============================================================================

export const SpecsFileSchema = z.array(SpecDataSchema);
export const GitHubSyncFileSchema = z.array(GitHubSyncDataSchema);
export const WorkflowStateFileSchema = z.array(WorkflowStateDataSchema);
export const TasksFileSchema = z.array(TaskDataSchema);

// ============================================================================
// バリデーションヘルパー
// ============================================================================

/**
 * データをスキーマでバリデートし、型安全な結果を返す
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * データをスキーマでバリデートし、結果を SafeParseReturnType で返す
 */
export function safeValidateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): z.SafeParseReturnType<unknown, T> {
  return schema.safeParse(data);
}
