/**
 * プロジェクト初期化コマンド
 */

import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../core/database/connection.js';
import { migrateToLatest } from '../core/database/migrator.js';
import { formatSuccess, formatHeading, formatKeyValue, formatInfo } from './utils/output.js';
import { createProjectAlreadyInitializedError, handleCLIError } from './utils/error-handler.js';

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
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const specsDir = join(ccCraftKitDir, 'specs');
  const configPath = join(ccCraftKitDir, 'config.json');

  // 既存プロジェクトチェック
  if (existsSync(ccCraftKitDir)) {
    throw createProjectAlreadyInitializedError();
  }

  // プロジェクト名のデフォルト値
  const name = projectName || 'cc-craft-kit-project';

  console.log(formatHeading('Initializing cc-craft-kit Project', 1, options.color));
  console.log('');

  // .cc-craft-kit/ ディレクトリ作成
  console.log(formatInfo('Creating .cc-craft-kit directory...', options.color));
  mkdirSync(ccCraftKitDir, { recursive: true });
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
  console.log(formatKeyValue('Directory', ccCraftKitDir, options.color));
  console.log(formatKeyValue('Database', join(ccCraftKitDir, 'cc-craft-kit.db'), options.color));
  console.log(formatKeyValue('Config', configPath, options.color));
  console.log('');
  console.log('Next steps:');
  console.log('  1. Create a spec: /cft:spec-create "<name>"');
  console.log('  2. Configure GitHub: /cft:github-init <owner> <repo>');
  console.log('  3. Check status: /cft:status');
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const projectName = process.argv[2];

  initProject(projectName).catch((error) => handleCLIError(error));
}
