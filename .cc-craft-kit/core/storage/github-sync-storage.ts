/**
 * GitHub 同期状態管理
 *
 * github-sync.json ファイルを読み書きし、GitHub との同期状態を管理します。
 */

import { randomUUID } from 'node:crypto';
import { readJsonFile, writeJsonFile, getJsonFilePath } from './json-storage.js';
import {
  GitHubSyncDataSchema,
  GitHubSyncFileSchema,
  type GitHubSyncData,
  type GitHubEntityType,
  type SyncStatus,
} from './schemas.js';

const GITHUB_SYNC_FILE = 'github-sync.json';

/**
 * GitHub 同期ファイルパスを取得
 */
function getGitHubSyncFilePath(baseDir?: string): string {
  return getJsonFilePath(GITHUB_SYNC_FILE, baseDir);
}

/**
 * すべての GitHub 同期データを読み込む
 */
export function loadGitHubSync(baseDir?: string): GitHubSyncData[] {
  const filePath = getGitHubSyncFilePath(baseDir);
  const data = readJsonFile<GitHubSyncData>(filePath);

  // バリデーション
  const result = GitHubSyncFileSchema.safeParse(data);
  if (!result.success) {
    console.warn(`Warning: Invalid data in ${filePath}:`, result.error.issues);
    return data.filter((item) => GitHubSyncDataSchema.safeParse(item).success);
  }

  return result.data;
}

/**
 * すべての GitHub 同期データを保存する
 */
export function saveGitHubSync(syncData: GitHubSyncData[], baseDir?: string): void {
  const filePath = getGitHubSyncFilePath(baseDir);

  const result = GitHubSyncFileSchema.safeParse(syncData);
  if (!result.success) {
    throw new Error(`Invalid GitHub sync data: ${result.error.message}`);
  }

  writeJsonFile(filePath, result.data);
}

/**
 * エンティティ ID と種類で同期データを取得
 */
export function getGitHubSyncByEntity(
  entityId: string,
  entityType: GitHubEntityType,
  baseDir?: string
): GitHubSyncData | undefined {
  const syncData = loadGitHubSync(baseDir);
  return syncData.find((s) => s.entity_id === entityId && s.entity_type === entityType);
}

/**
 * GitHub Issue 番号で同期データを取得
 */
export function getGitHubSyncByIssueNumber(
  issueNumber: number,
  baseDir?: string
): GitHubSyncData | undefined {
  const syncData = loadGitHubSync(baseDir);
  return syncData.find((s) => s.github_number === issueNumber || s.issue_number === issueNumber);
}

/**
 * 仕様書 ID で同期データを取得（spec エンティティのみ）
 */
export function getGitHubSyncBySpecId(
  specId: string,
  baseDir?: string
): GitHubSyncData | undefined {
  return getGitHubSyncByEntity(specId, 'spec', baseDir);
}

/**
 * 親 Issue 番号で Sub Issue を取得
 */
export function getSubIssuesByParent(
  parentIssueNumber: number,
  baseDir?: string
): GitHubSyncData[] {
  const syncData = loadGitHubSync(baseDir);
  return syncData.filter(
    (s) => s.entity_type === 'sub_issue' && s.parent_issue_number === parentIssueNumber
  );
}

/**
 * 新しい GitHub 同期データを追加
 */
export function addGitHubSync(
  sync: Omit<GitHubSyncData, 'id' | 'last_synced_at' | 'updated_at'>,
  baseDir?: string
): GitHubSyncData {
  const syncData = loadGitHubSync(baseDir);
  const now = new Date().toISOString();

  const newSync: GitHubSyncData = {
    id: randomUUID(),
    ...sync,
    last_synced_at: now,
    updated_at: now,
  };

  GitHubSyncDataSchema.parse(newSync);

  syncData.push(newSync);
  saveGitHubSync(syncData, baseDir);

  return newSync;
}

/**
 * GitHub 同期データを更新
 */
export function updateGitHubSync(
  id: string,
  updates: Partial<Omit<GitHubSyncData, 'id'>>,
  baseDir?: string
): GitHubSyncData | undefined {
  const syncData = loadGitHubSync(baseDir);
  const index = syncData.findIndex((s) => s.id === id);

  if (index === -1) {
    return undefined;
  }

  const updatedSync: GitHubSyncData = {
    ...syncData[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  GitHubSyncDataSchema.parse(updatedSync);

  syncData[index] = updatedSync;
  saveGitHubSync(syncData, baseDir);

  return updatedSync;
}

/**
 * エンティティ ID と種類で GitHub 同期データを更新
 */
export function updateGitHubSyncByEntity(
  entityId: string,
  entityType: GitHubEntityType,
  updates: Partial<Omit<GitHubSyncData, 'id' | 'entity_id' | 'entity_type'>>,
  baseDir?: string
): GitHubSyncData | undefined {
  const syncData = loadGitHubSync(baseDir);
  const index = syncData.findIndex((s) => s.entity_id === entityId && s.entity_type === entityType);

  if (index === -1) {
    return undefined;
  }

  const updatedSync: GitHubSyncData = {
    ...syncData[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  GitHubSyncDataSchema.parse(updatedSync);

  syncData[index] = updatedSync;
  saveGitHubSync(syncData, baseDir);

  return updatedSync;
}

/**
 * GitHub 同期データを削除
 */
export function deleteGitHubSync(id: string, baseDir?: string): boolean {
  const syncData = loadGitHubSync(baseDir);
  const index = syncData.findIndex((s) => s.id === id);

  if (index === -1) {
    return false;
  }

  syncData.splice(index, 1);
  saveGitHubSync(syncData, baseDir);

  return true;
}

/**
 * エンティティ ID と種類で GitHub 同期データを削除
 */
export function deleteGitHubSyncByEntity(
  entityId: string,
  entityType: GitHubEntityType,
  baseDir?: string
): boolean {
  const syncData = loadGitHubSync(baseDir);
  const index = syncData.findIndex((s) => s.entity_id === entityId && s.entity_type === entityType);

  if (index === -1) {
    return false;
  }

  syncData.splice(index, 1);
  saveGitHubSync(syncData, baseDir);

  return true;
}

/**
 * 同期ステータスを更新
 */
export function updateSyncStatus(
  entityId: string,
  entityType: GitHubEntityType,
  status: SyncStatus,
  errorMessage?: string,
  baseDir?: string
): GitHubSyncData | undefined {
  return updateGitHubSyncByEntity(
    entityId,
    entityType,
    {
      sync_status: status,
      error_message: errorMessage ?? null,
      last_synced_at: new Date().toISOString(),
    },
    baseDir
  );
}
