/**
 * プロジェクト状態情報取得 - コアロジック
 *
 * JSON ストレージからプロジェクト状態を取得します。
 * CLI エントリポイント (info.ts) から分離されたテスト可能なコア関数です。
 */

import { getSpecsWithGitHubInfo, readLogs, type SpecPhase } from '../../core/storage/index.js';
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
 * getStatusFromStorage のオプション
 */
export interface GetStatusOptions {
  /**
   * ブランチ名（指定しない場合は getCurrentBranch() を使用）
   * テスト時にモックブランチ名を指定するために使用
   */
  branchName?: string;
}

/**
 * JSON ストレージから仕様書・ログ情報を取得（テスト可能なコア関数）
 *
 * @param options - オプション（ブランチ名など）
 * @returns specs と logs 情報
 */
export function getStatusFromStorage(options: GetStatusOptions = {}): {
  specs: SpecsInfo;
  logs: LogsInfo;
} {
  // 現在のブランチの仕様書のみ取得（別ブランチの仕様書ファイル読み取りエラーを防止）
  const branchName = options.branchName ?? getCurrentBranch();
  const allSpecs = getSpecsWithGitHubInfo({ branchName });

  // created_at の降順でソート
  allSpecs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // フェーズ別集計
  const phases: SpecPhase[] = [
    'requirements',
    'design',
    'tasks',
    'implementation',
    'review',
    'completed',
  ];
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

  // JSON ストレージからログを読み込み
  const allLogs = readLogs();

  // エラーログ（error/warn のみ、最新10件）
  const errorLogs = allLogs
    .filter((log) => log.level === 'error' || log.level === 'warn')
    .slice(0, 10);

  const errors: LogEntry[] = errorLogs.map((log) => ({
    timestamp: log.timestamp,
    level: log.level as 'error' | 'warn',
    message: log.message,
  }));

  // 最近のログ（全レベル、最新5件）
  const recentLogs: LogEntry[] = allLogs.slice(0, 5).map((log) => ({
    timestamp: log.timestamp,
    level: log.level as 'debug' | 'info' | 'warn' | 'error',
    message: log.message,
  }));

  const logs: LogsInfo = {
    errors,
    recent: recentLogs,
  };

  return { specs, logs };
}
