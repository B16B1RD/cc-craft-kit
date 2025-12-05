/**
 * ログ管理
 *
 * logs.jsonl ファイルを読み書きし、操作ログを管理します。
 * JSONL（JSON Lines）形式で追記のみを行い、効率的なログ記録を実現します。
 */

import { randomUUID } from 'node:crypto';
import { appendJsonlFile, readJsonlFile, getJsonFilePath } from './json-storage.js';
import { LogDataSchema, type LogData, type LogLevel } from './schemas.js';

const LOGS_FILE = 'logs.jsonl';

/**
 * ログファイルパスを取得
 */
function getLogsFilePath(baseDir?: string): string {
  return getJsonFilePath(LOGS_FILE, baseDir);
}

/**
 * ログを追記
 */
export function appendLog(log: Omit<LogData, 'id' | 'timestamp'>, baseDir?: string): LogData {
  const filePath = getLogsFilePath(baseDir);

  const newLog: LogData = {
    id: randomUUID(),
    ...log,
    timestamp: new Date().toISOString(),
  };

  // バリデーション
  LogDataSchema.parse(newLog);

  appendJsonlFile(filePath, newLog);

  return newLog;
}

/**
 * すべてのログを読み込む
 *
 * 注意: 大量のログがある場合はメモリを消費します。
 * 必要に応じて readLogsBySpec や readLogsByTask を使用してください。
 */
export function readLogs(baseDir?: string): LogData[] {
  const filePath = getLogsFilePath(baseDir);
  const data = readJsonlFile<LogData>(filePath);

  // バリデーションを通過したデータのみ返す
  return data.filter((item) => LogDataSchema.safeParse(item).success);
}

/**
 * 仕様書 ID でログをフィルタリング
 */
export function readLogsBySpec(specId: string, baseDir?: string): LogData[] {
  const logs = readLogs(baseDir);
  return logs.filter((l) => l.spec_id === specId);
}

/**
 * タスク ID でログをフィルタリング
 */
export function readLogsByTask(taskId: string, baseDir?: string): LogData[] {
  const logs = readLogs(baseDir);
  return logs.filter((l) => l.task_id === taskId);
}

/**
 * ログレベルでフィルタリング
 */
export function readLogsByLevel(level: LogLevel, baseDir?: string): LogData[] {
  const logs = readLogs(baseDir);
  return logs.filter((l) => l.level === level);
}

/**
 * アクションでフィルタリング
 */
export function readLogsByAction(action: string, baseDir?: string): LogData[] {
  const logs = readLogs(baseDir);
  return logs.filter((l) => l.action === action);
}

/**
 * 最新のログを取得
 */
export function readRecentLogs(limit: number, baseDir?: string): LogData[] {
  const logs = readLogs(baseDir);
  return logs.slice(-limit);
}

// ============================================================================
// ヘルパー関数（よく使うログパターン）
// ============================================================================

/**
 * 情報ログを記録
 */
export function logInfo(
  action: string,
  message: string,
  options?: {
    specId?: string;
    taskId?: string;
    metadata?: Record<string, unknown>;
  },
  baseDir?: string
): LogData {
  return appendLog(
    {
      action,
      level: 'info',
      message,
      spec_id: options?.specId ?? null,
      task_id: options?.taskId ?? null,
      metadata: options?.metadata ?? null,
    },
    baseDir
  );
}

/**
 * 警告ログを記録
 */
export function logWarn(
  action: string,
  message: string,
  options?: {
    specId?: string;
    taskId?: string;
    metadata?: Record<string, unknown>;
  },
  baseDir?: string
): LogData {
  return appendLog(
    {
      action,
      level: 'warn',
      message,
      spec_id: options?.specId ?? null,
      task_id: options?.taskId ?? null,
      metadata: options?.metadata ?? null,
    },
    baseDir
  );
}

/**
 * エラーログを記録
 */
export function logError(
  action: string,
  message: string,
  options?: {
    specId?: string;
    taskId?: string;
    metadata?: Record<string, unknown>;
  },
  baseDir?: string
): LogData {
  return appendLog(
    {
      action,
      level: 'error',
      message,
      spec_id: options?.specId ?? null,
      task_id: options?.taskId ?? null,
      metadata: options?.metadata ?? null,
    },
    baseDir
  );
}

/**
 * デバッグログを記録
 */
export function logDebug(
  action: string,
  message: string,
  options?: {
    specId?: string;
    taskId?: string;
    metadata?: Record<string, unknown>;
  },
  baseDir?: string
): LogData {
  return appendLog(
    {
      action,
      level: 'debug',
      message,
      spec_id: options?.specId ?? null,
      task_id: options?.taskId ?? null,
      metadata: options?.metadata ?? null,
    },
    baseDir
  );
}
