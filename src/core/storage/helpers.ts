/**
 * JSON ストレージヘルパー関数
 *
 * specs と github-sync の結合など、頻繁に使用されるクエリパターンを提供します。
 * これは src/core/database/helpers.ts の JSON ストレージ版です。
 */

import { loadSpecs, findSpecByIdPrefix } from './specs-storage.js';
import { loadGitHubSync, getGitHubSyncBySpecId } from './github-sync-storage.js';
import type { SpecData, GitHubSyncData, SpecPhase, SyncStatus } from './schemas.js';

/**
 * Spec と GitHub 同期情報を結合した型
 */
export interface SpecWithGitHub {
  id: string;
  name: string;
  description: string | null;
  phase: SpecPhase;
  branch_name: string | null;
  created_at: Date;
  updated_at: Date;
  github_issue_number: number | null;
  github_node_id: string | null;
  github_sync_status: SyncStatus | null;
  pr_number: number | null;
  pr_url: string | null;
  pr_merged_at: Date | null;
}

/**
 * SpecData と GitHubSyncData を結合して SpecWithGitHub を生成
 */
function combineSpecWithGitHub(spec: SpecData, sync: GitHubSyncData | undefined): SpecWithGitHub {
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    phase: spec.phase,
    branch_name: spec.branch_name,
    created_at: new Date(spec.created_at),
    updated_at: new Date(spec.updated_at),
    github_issue_number: sync?.github_number ?? null,
    github_node_id: sync?.github_node_id ?? null,
    github_sync_status: sync?.sync_status ?? null,
    pr_number: sync?.pr_number ?? null,
    pr_url: sync?.pr_url ?? null,
    pr_merged_at: sync?.pr_merged_at ? new Date(sync.pr_merged_at) : null,
  };
}

/**
 * Spec と GitHub 同期情報を結合して取得
 *
 * @param specId - 仕様書ID（前方一致検索）
 * @param baseDir - ベースディレクトリ
 * @returns Spec と GitHub 情報、存在しない場合は undefined
 */
export function getSpecWithGitHubInfo(
  specId: string,
  baseDir?: string
): SpecWithGitHub | undefined {
  // 前方一致で仕様書を検索
  const spec = findSpecByIdPrefix(specId, baseDir);
  if (!spec) {
    return undefined;
  }

  const sync = getGitHubSyncBySpecId(spec.id, baseDir);
  return combineSpecWithGitHub(spec, sync);
}

/**
 * 複数の Spec と GitHub 同期情報を結合して取得
 *
 * @param options - フィルタリングオプション
 * @param baseDir - ベースディレクトリ
 * @returns Spec と GitHub 情報の配列
 */
/**
 * getSpecsWithGitHubInfo のオプション
 */
export interface GetSpecsWithGitHubInfoOptions {
  phase?: SpecPhase;
  branchName?: string;
  includeAllBranches?: boolean;
  limit?: number;
  orderBy?: 'created_at' | 'updated_at';
  orderDirection?: 'asc' | 'desc';
}

export function getSpecsWithGitHubInfo(
  options?: GetSpecsWithGitHubInfoOptions,
  baseDir?: string
): SpecWithGitHub[] {
  let specs = loadSpecs(baseDir);
  const syncData = loadGitHubSync(baseDir);

  // GitHub 同期データをマップに変換（高速ルックアップ用）
  const syncMap = new Map<string, GitHubSyncData>();
  for (const sync of syncData) {
    if (sync.entity_type === 'spec') {
      syncMap.set(sync.entity_id, sync);
    }
  }

  // フェーズフィルタリング
  if (options?.phase) {
    specs = specs.filter((s) => s.phase === options.phase);
  }

  // ブランチフィルタリング（includeAllBranches が true の場合はスキップ）
  if (options?.branchName && !options?.includeAllBranches) {
    const branchName = options.branchName;
    specs = specs.filter(
      (s) => s.branch_name === branchName || s.branch_name === 'main' || s.branch_name === 'develop'
    );
  }

  // ソート
  const orderBy = options?.orderBy || 'created_at';
  const orderDirection = options?.orderDirection || 'desc';

  specs.sort((a, b) => {
    const aValue = new Date(a[orderBy]).getTime();
    const bValue = new Date(b[orderBy]).getTime();
    return orderDirection === 'desc' ? bValue - aValue : aValue - bValue;
  });

  // 件数制限
  if (options?.limit) {
    specs = specs.slice(0, options.limit);
  }

  // 結合
  return specs.map((spec) => combineSpecWithGitHub(spec, syncMap.get(spec.id)));
}

/**
 * 仕様書の総数を取得（フェーズフィルタリング対応）
 */
export function countSpecsWithFilter(phase?: SpecPhase, baseDir?: string): number {
  let specs = loadSpecs(baseDir);

  if (phase) {
    specs = specs.filter((s) => s.phase === phase);
  }

  return specs.length;
}
