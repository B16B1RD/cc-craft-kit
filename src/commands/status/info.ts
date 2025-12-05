/**
 * プロジェクト状態情報取得コマンド - CLI エントリポイント
 *
 * DB からプロジェクト状態を取得し、JSON 形式で出力します。
 * 表示ロジックはプロンプト側で処理するため、このスクリプトはデータ取得のみを担当します。
 */

import '../../core/config/env.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getStatusFromStorage, type SpecsInfo, type LogsInfo } from './get-status.js';

/**
 * プロジェクト情報
 */
export interface ProjectInfo {
  name: string;
  initialized_at: string;
  directory: string;
}

/**
 * GitHub 連携情報
 */
export interface GitHubInfo {
  configured: boolean;
  owner?: string;
  repo?: string;
  project_number?: number;
}

/**
 * ステータス情報全体
 */
export interface StatusInfo {
  project: ProjectInfo;
  github: GitHubInfo;
  specs: SpecsInfo;
  logs: LogsInfo;
}

/**
 * プロジェクト設定ファイルの型
 */
interface ProjectConfig {
  project: {
    name: string;
    initialized_at: string;
  };
  github?: {
    owner: string;
    repo: string;
    project_id?: number;
  };
}

/**
 * プロジェクト状態情報を取得
 *
 * @returns StatusInfo オブジェクト
 * @throws プロジェクトが初期化されていない場合
 */
export async function getStatusInfo(): Promise<StatusInfo> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const configPath = join(ccCraftKitDir, 'config.json');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir) || !existsSync(configPath)) {
    throw new Error('Project not initialized. Run /cft:init first.');
  }

  // 設定ファイル読み込み
  const config: ProjectConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

  // プロジェクト情報
  const project: ProjectInfo = {
    name: config.project.name,
    initialized_at: config.project.initialized_at,
    directory: ccCraftKitDir,
  };

  // GitHub 連携情報
  const github: GitHubInfo = config.github
    ? {
        configured: true,
        owner: config.github.owner,
        repo: config.github.repo,
        project_number: config.github.project_id,
      }
    : { configured: false };

  // JSON ストレージから仕様書・ログ情報を取得
  const { specs, logs } = getStatusFromStorage();

  return {
    project,
    github,
    specs,
    logs,
  };
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  getStatusInfo()
    .then((info) => {
      console.log(JSON.stringify(info, null, 2));
    })
    .catch((error) => {
      console.error(JSON.stringify({ error: error.message }));
      process.exit(1);
    });
}
