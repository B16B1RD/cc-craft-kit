/**
 * テスト用 JSON ストレージヘルパー
 *
 * テストで使用するストレージの初期化とクリーンアップを提供します。
 */

import fs from 'fs';
import path from 'path';
import {
  ensureMetaDir,
  loadSpecs,
  loadGitHubSyncs,
  readLogs,
  loadWorkflowState,
} from '../../src/core/storage/index.js';

/**
 * テスト用ストレージディレクトリを作成
 */
export function createTestStorageDir(): string {
  const testDir = path.join(process.cwd(), '.cc-craft-kit-test', `test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  process.env.CC_CRAFT_KIT_DIR = testDir;
  ensureMetaDir();
  return testDir;
}

/**
 * テスト用ストレージをクリーンアップ
 */
export function cleanupTestStorage(testDir: string): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

/**
 * ストレージの状態を取得（デバッグ用）
 */
export function getStorageState(): {
  specs: number;
  githubSyncs: number;
  logs: number;
  workflowStates: number;
} {
  return {
    specs: loadSpecs().length,
    githubSyncs: loadGitHubSyncs().length,
    logs: readLogs().length,
    workflowStates: loadWorkflowState().length,
  };
}

/**
 * テストストレージライフサイクルを提供
 */
export interface StorageLifecycle {
  testDir: string;
  cleanup: () => void;
}

/**
 * ストレージライフサイクルをセットアップ
 *
 * テストファイルで以下のように使用:
 * ```typescript
 * let lifecycle: StorageLifecycle;
 *
 * beforeEach(() => {
 *   lifecycle = setupStorageLifecycle();
 * });
 *
 * afterEach(() => {
 *   lifecycle.cleanup();
 * });
 * ```
 */
export function setupStorageLifecycle(): StorageLifecycle {
  const testDir = createTestStorageDir();

  return {
    testDir,
    cleanup: () => cleanupTestStorage(testDir),
  };
}
