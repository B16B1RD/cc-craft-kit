/**
 * プロジェクト状態情報取得 - コアロジック
 *
 * DB からプロジェクト状態を取得します。
 * CLI エントリポイント (info.ts) から分離されたテスト可能なコア関数です。
 */

import type { Kysely } from 'kysely';
import type { Database, SpecPhase } from '../../core/database/schema.js';
import { getSpecsWithGitHubInfo } from '../../core/database/helpers.js';
import { getCurrentBranch } from '../../core/git/branch-cache.js';

/**
 * 仕様書情報（簡易版）
 */
export interface SpecSummary {
  id: string;
  name: string;
  phase: SpecPhase;
  github_issue_number: number | null;
  pr_number: number | null;
}

/**
 * 仕様書集計情報
 */
export interface SpecsInfo {
  total: number;
  byPhase: Record<SpecPhase, number>;
  recent: SpecSummary[];
  withoutIssue: SpecSummary[];
}

/**
 * ログエントリ
 */
export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

/**
 * ログ情報
 */
export interface LogsInfo {
  errors: LogEntry[];
  recent: LogEntry[];
}

/**
 * データベースから仕様書・ログ情報を取得（テスト可能なコア関数）
 *
 * @param db - Kysely データベースインスタンス
 * @returns specs と logs 情報
 */
export async function getStatusFromDb(
  db: Kysely<Database>
): Promise<{ specs: SpecsInfo; logs: LogsInfo }> {
  // 現在のブランチの仕様書のみ取得（別ブランチの仕様書ファイル読み取りエラーを防止）
  const currentBranch = getCurrentBranch();
  const allSpecs = await getSpecsWithGitHubInfo(db, {
    branchName: currentBranch,
    orderBy: 'created_at',
    orderDirection: 'desc',
  });

  // フェーズ別集計
  const phases: SpecPhase[] = ['requirements', 'design', 'tasks', 'implementation', 'completed'];
  const byPhase: Record<SpecPhase, number> = {} as Record<SpecPhase, number>;
  for (const phase of phases) {
    byPhase[phase] = allSpecs.filter((s) => s.phase === phase).length;
  }

  // 最近の仕様書（5件）
  const recent: SpecSummary[] = allSpecs.slice(0, 5).map((spec) => ({
    id: spec.id,
    name: spec.name,
    phase: spec.phase,
    github_issue_number: spec.github_issue_number,
    pr_number: spec.pr_number,
  }));

  // Issue 未作成の仕様書（completed 以外）
  const withoutIssue: SpecSummary[] = allSpecs
    .filter((spec) => spec.github_issue_number === null && spec.phase !== 'completed')
    .map((spec) => ({
      id: spec.id,
      name: spec.name,
      phase: spec.phase,
      github_issue_number: null,
      pr_number: spec.pr_number,
    }));

  const specs: SpecsInfo = {
    total: allSpecs.length,
    byPhase,
    recent,
    withoutIssue,
  };

  // エラーログ（error/warn のみ、最新10件）
  const errorLogsResult = await db
    .selectFrom('logs')
    .select(['level', 'message', 'timestamp'])
    .where('level', 'in', ['error', 'warn'])
    .orderBy('timestamp', 'desc')
    .limit(10)
    .execute();

  const errors: LogEntry[] = errorLogsResult.map((log) => ({
    timestamp: new Date(log.timestamp).toISOString(),
    level: log.level,
    message: log.message,
  }));

  // 最近のログ（全レベル、最新5件）
  const recentLogsResult = await db
    .selectFrom('logs')
    .select(['level', 'message', 'timestamp'])
    .orderBy('timestamp', 'desc')
    .limit(5)
    .execute();

  const recentLogs: LogEntry[] = recentLogsResult.map((log) => ({
    timestamp: new Date(log.timestamp).toISOString(),
    level: log.level,
    message: log.message,
  }));

  const logs: LogsInfo = {
    errors,
    recent: recentLogs,
  };

  return { specs, logs };
}
