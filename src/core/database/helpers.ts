/**
 * データベースヘルパー関数
 *
 * specs と github_sync の JOIN など、頻繁に使用されるクエリパターンを提供します。
 */

import type { Kysely } from 'kysely';
import type { Database, SpecPhase } from './schema.js';

/**
 * Spec と GitHub 同期情報を結合した型
 */
export interface SpecWithGitHub {
  id: string;
  name: string;
  description: string | null;
  phase: SpecPhase;
  branch_name: string;
  created_at: Date;
  updated_at: Date;
  github_issue_number: number | null;
  github_node_id: string | null;
  github_sync_status: 'success' | 'failed' | 'pending' | null;
}

/**
 * Spec と GitHub 同期情報を結合して取得
 *
 * @param db - Kysely データベースインスタンス
 * @param specId - 仕様書ID（前方一致検索）
 * @returns Spec と GitHub 情報、存在しない場合は undefined
 */
export async function getSpecWithGitHubInfo(
  db: Kysely<Database>,
  specId: string
): Promise<SpecWithGitHub | undefined> {
  const result = await db
    .selectFrom('specs')
    .leftJoin('github_sync', (join) =>
      join
        .onRef('github_sync.entity_id', '=', 'specs.id')
        .on('github_sync.entity_type', '=', 'spec')
    )
    .select([
      'specs.id',
      'specs.name',
      'specs.description',
      'specs.phase',
      'specs.branch_name',
      'specs.created_at',
      'specs.updated_at',
      'github_sync.github_number as github_issue_number',
      'github_sync.github_node_id',
      'github_sync.sync_status as github_sync_status',
    ])
    .where('specs.id', 'like', `${specId}%`)
    .executeTakeFirst();

  if (!result) return undefined;

  return {
    id: result.id,
    name: result.name,
    description: result.description,
    phase: result.phase as SpecPhase,
    branch_name: result.branch_name,
    created_at: new Date(result.created_at),
    updated_at: new Date(result.updated_at),
    github_issue_number: result.github_issue_number,
    github_node_id: result.github_node_id,
    github_sync_status: result.github_sync_status,
  };
}

/**
 * 複数の Spec と GitHub 同期情報を結合して取得
 *
 * @param db - Kysely データベースインスタンス
 * @param options - フィルタリングオプション
 * @returns Spec と GitHub 情報の配列
 */
export async function getSpecsWithGitHubInfo(
  db: Kysely<Database>,
  options?: {
    phase?: SpecPhase;
    branchName?: string; // 現在のブランチ名（指定された場合、ブランチフィルタリングを実行）
    limit?: number;
    orderBy?: 'created_at' | 'updated_at';
    orderDirection?: 'asc' | 'desc';
  }
): Promise<SpecWithGitHub[]> {
  let query = db
    .selectFrom('specs')
    .leftJoin('github_sync', (join) =>
      join
        .onRef('github_sync.entity_id', '=', 'specs.id')
        .on('github_sync.entity_type', '=', 'spec')
    )
    .select([
      'specs.id',
      'specs.name',
      'specs.description',
      'specs.phase',
      'specs.branch_name',
      'specs.created_at',
      'specs.updated_at',
      'github_sync.github_number as github_issue_number',
      'github_sync.github_node_id',
      'github_sync.sync_status as github_sync_status',
    ]);

  if (options?.phase) {
    query = query.where('specs.phase', '=', options.phase);
  }

  // ブランチフィルタリング: 現在のブランチ、main、develop のいずれかで作成された仕様書のみ表示
  if (options?.branchName) {
    const branchName = options.branchName; // 型を string に確定
    query = query.where((eb) =>
      eb.or([
        eb('specs.branch_name', '=', branchName), // 現在のブランチ
        eb('specs.branch_name', '=', 'main'), // main ブランチ（全ブランチで参照可能）
        eb('specs.branch_name', '=', 'develop'), // develop ブランチ（全ブランチで参照可能）
      ])
    );
  }

  const orderBy = options?.orderBy || 'created_at';
  const orderDirection = options?.orderDirection || 'desc';
  query = query.orderBy(`specs.${orderBy}`, orderDirection);

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const results = await query.execute();

  return results.map((result) => ({
    id: result.id,
    name: result.name,
    description: result.description,
    phase: result.phase as SpecPhase,
    branch_name: result.branch_name,
    created_at: new Date(result.created_at),
    updated_at: new Date(result.updated_at),
    github_issue_number: result.github_issue_number,
    github_node_id: result.github_node_id,
    github_sync_status: result.github_sync_status,
  }));
}
