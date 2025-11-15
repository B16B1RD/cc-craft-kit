/**
 * MCPツールの型定義
 * 各MCPツールのパラメータと戻り値の型を定義
 */

import type { Spec, Task } from '../../core/database/schema.js';

/**
 * プロジェクト初期化パラメータ
 */
export interface InitProjectParams {
  projectDir: string;
  projectName: string;
  description?: string;
}

export interface InitProjectResult {
  success: boolean;
  message: string;
  configPath?: string;
  dbPath?: string;
}

/**
 * 仕様書作成パラメータ
 */
export interface CreateSpecParams {
  name: string;
  description?: string;
  githubIssueId?: number;
}

export interface CreateSpecResult {
  success: boolean;
  spec?: Spec;
  message?: string;
}

/**
 * 仕様書取得パラメータ
 */
export interface GetSpecParams {
  specId: string;
}

export interface GetSpecResult {
  success: boolean;
  spec?: Spec;
  tasks?: Task[];
  message?: string;
}

/**
 * 仕様書リスト取得パラメータ
 */
export interface ListSpecsParams {
  phase?: string;
  limit?: number;
  offset?: number;
}

export interface ListSpecsResult {
  success: boolean;
  specs: Spec[];
  total: number;
}

/**
 * GitHub連携初期化パラメータ
 */
export interface GitHubInitParams {
  owner: string;
  repo: string;
  token?: string;
  createRepository?: boolean;
}

export interface GitHubInitResult {
  success: boolean;
  repository?: {
    owner: string;
    repo: string;
    url: string;
    defaultBranch: string;
  };
  error?: string;
}

/**
 * 仕様書GitHub同期パラメータ
 */
export interface SyncSpecToGitHubParams {
  specId: string;
  owner: string;
  repo: string;
  createIfNotExists?: boolean;
}

export interface SyncSpecToGitHubResult {
  success: boolean;
  issueNumber?: number;
  issueUrl?: string;
  spec?: {
    id: string;
    name: string;
    phase: string;
    githubIssueId: number | null;
  };
  error?: string;
}

/**
 * GitHubからタスク同期パラメータ
 */
export interface SyncTasksFromGitHubParams {
  specId: string;
  owner: string;
  repo: string;
}

export interface SyncTasksFromGitHubResult {
  success: boolean;
  syncedTasks: Array<{
    taskId: string;
    issueNumber: number;
    action: 'created' | 'updated' | 'skipped';
  }>;
  error?: string;
}

/**
 * 双方向同期パラメータ
 */
export interface BidirectionalSyncParams {
  specId: string;
  owner: string;
  repo: string;
}

export interface BidirectionalSyncResult {
  success: boolean;
  toGitHub: SyncSpecToGitHubResult;
  fromGitHub: SyncTasksFromGitHubResult;
  error?: string;
}

/**
 * GitHub Knowledge取得パラメータ
 */
export interface GetGitHubKnowledgeParams {
  query: string;
  owner: string;
  repo: string;
  type?: 'issues' | 'pull_requests' | 'discussions' | 'all';
}

export interface GetGitHubKnowledgeResult {
  success: boolean;
  knowledge: Array<{
    type: string;
    title: string;
    url: string;
    summary: string;
    relevance: number;
  }>;
  error?: string;
}

/**
 * Issue from Knowledge作成パラメータ
 */
export interface CreateIssueFromKnowledgeParams {
  specId: string;
  owner: string;
  repo: string;
  relatedIssues: number[];
}

export interface CreateIssueFromKnowledgeResult {
  success: boolean;
  issueNumber?: number;
  issueUrl?: string;
  relatedKnowledge?: Array<{
    issueNumber: number;
    title: string;
    relevance: string;
  }>;
  error?: string;
}

/**
 * Knowledge update パラメータ
 */
export interface UpdateKnowledgeParams {
  specId: string;
  owner: string;
  repo: string;
  issueNumbers: number[];
}

export interface UpdateKnowledgeResult {
  success: boolean;
  updatedIssues: Array<{
    issueNumber: number;
    title: string;
    linkedSpecs: string[];
  }>;
  error?: string;
}
