/**
 * プロジェクト初期化コマンド
 */

import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../../core/database/connection.js';
import { migrateToLatest } from '../../core/database/migrator.js';
import { formatSuccess, formatHeading, formatKeyValue, formatInfo } from '../utils/output.js';
import { createProjectAlreadyInitializedError } from '../utils/error-handler.js';

/**
 * プロジェクト設定
 */
interface ProjectConfig {
  project: {
    name: string;
    initialized_at: string;
  };
  github?: {
    owner: string;
    repo: string;
    token?: string;
    project_id?: number;
  };
}

/**
 * プロジェクト初期化
 */
export async function initProject(
  projectName?: string,
  options: { color: boolean } = { color: true }
): Promise<void> {
  const cwd = process.cwd();
  const takumiDir = join(cwd, '.takumi');
  const specsDir = join(takumiDir, 'specs');
  const configPath = join(takumiDir, 'config.json');

  // 既存プロジェクトチェック
  if (existsSync(takumiDir)) {
    throw createProjectAlreadyInitializedError();
  }

  // プロジェクト名のデフォルト値
  const name = projectName || 'takumi-project';

  console.log(formatHeading('Initializing Takumi Project', 1, options.color));
  console.log('');

  // .takumi/ ディレクトリ作成
  console.log(formatInfo('Creating .takumi directory...', options.color));
  mkdirSync(takumiDir, { recursive: true });
  mkdirSync(specsDir, { recursive: true });

  // データベース初期化
  console.log(formatInfo('Initializing database...', options.color));
  const db = getDatabase();
  await migrateToLatest(db);

  // 設定ファイル生成
  console.log(formatInfo('Creating configuration file...', options.color));
  const config: ProjectConfig = {
    project: {
      name,
      initialized_at: new Date().toISOString(),
    },
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  console.log('');
  console.log(formatSuccess('Project initialized successfully!', options.color));
  console.log('');
  console.log(formatKeyValue('Project name', name, options.color));
  console.log(formatKeyValue('Directory', takumiDir, options.color));
  console.log(formatKeyValue('Database', join(takumiDir, 'takumi.db'), options.color));
  console.log(formatKeyValue('Config', configPath, options.color));
  console.log('');
  console.log('Next steps:');
  console.log('  1. Create a spec: /takumi:spec-create "<name>"');
  console.log('  2. Configure GitHub: /takumi:github-init <owner> <repo>');
  console.log('  3. Check status: /takumi:status');
}
