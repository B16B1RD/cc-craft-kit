/**
 * プロジェクト状態表示コマンド
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../../core/database/connection.js';
import {
  formatHeading,
  formatKeyValue,
  formatTable,
  formatInfo,
  OutputOptions,
} from '../utils/output.js';
import { createProjectNotInitializedError } from '../utils/error-handler.js';

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
 * 仕様書レコード
 */
interface Spec {
  id: string;
  name: string;
  phase: string;
  github_issue_id: number | null;
  created_at: Date;
}

/**
 * プロジェクト状態表示
 */
export async function showStatus(
  options: OutputOptions = { format: 'table', color: true }
): Promise<void> {
  const cwd = process.cwd();
  const takumiDir = join(cwd, '.takumi');
  const configPath = join(takumiDir, 'config.json');

  // プロジェクト初期化チェック
  if (!existsSync(takumiDir)) {
    throw createProjectNotInitializedError();
  }

  // 設定ファイル読み込み
  const config: ProjectConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

  console.log(formatHeading('Takumi Project Status', 1, options.color));
  console.log('');

  // プロジェクト情報
  console.log(formatHeading('Project', 2, options.color));
  console.log(formatKeyValue('Name', config.project.name, options.color));
  console.log(
    formatKeyValue(
      'Initialized',
      new Date(config.project.initialized_at).toLocaleString(),
      options.color
    )
  );
  console.log(formatKeyValue('Directory', takumiDir, options.color));
  console.log('');

  // GitHub 連携状態
  if (config.github) {
    console.log(formatHeading('GitHub Integration', 2, options.color));
    console.log(
      formatKeyValue('Repository', `${config.github.owner}/${config.github.repo}`, options.color)
    );
    console.log(
      formatKeyValue('Project ID', config.github.project_id || '(not set)', options.color)
    );
    // 環境変数GITHUB_TOKENの存在をチェック
    const hasToken = !!process.env.GITHUB_TOKEN;
    console.log(formatKeyValue('Token', hasToken ? '✓ Configured' : '✗ Not set', options.color));
    console.log('');
  } else {
    console.log(
      formatInfo('GitHub is not configured. Run "takumi github init" to set up.', options.color)
    );
    console.log('');
  }

  // データベース取得
  const db = getDatabase();

  // フェーズ別仕様書集計
  const specs = await db
    .selectFrom('specs')
    .select(['id', 'name', 'phase', 'github_issue_id', 'created_at'])
    .orderBy('created_at', 'desc')
    .execute();

  const specsByPhase = specs.reduce(
    (acc, spec) => {
      if (!acc[spec.phase]) {
        acc[spec.phase] = [];
      }
      acc[spec.phase].push(spec);
      return acc;
    },
    {} as Record<string, Spec[]>
  );

  // 仕様書一覧
  console.log(formatHeading('Specifications', 2, options.color));
  console.log(formatKeyValue('Total', specs.length, options.color));
  console.log('');

  const phases = ['requirements', 'design', 'tasks', 'implementation', 'completed'];
  const phaseCounts: string[][] = [];

  for (const phase of phases) {
    const count = specsByPhase[phase]?.length || 0;
    phaseCounts.push([phase, String(count)]);
  }

  console.log(formatTable(['Phase', 'Count'], phaseCounts, options));
  console.log('');

  // 最近の仕様書（最新5件）
  if (specs.length > 0) {
    console.log(formatHeading('Recent Specifications', 2, options.color));
    const recentSpecs = specs.slice(0, 5);
    const rows = recentSpecs.map((spec) => [
      spec.id.substring(0, 8) + '...',
      spec.name,
      spec.phase,
      spec.github_issue_id ? `#${spec.github_issue_id}` : '-',
    ]);
    console.log(formatTable(['ID', 'Name', 'Phase', 'GitHub'], rows, options));
    console.log('');
  }

  // 最近の活動（ログから取得）
  const logs = await db
    .selectFrom('logs')
    .select(['level', 'message', 'timestamp'])
    .orderBy('timestamp', 'desc')
    .limit(5)
    .execute();

  if (logs.length > 0) {
    console.log(formatHeading('Recent Activity', 2, options.color));
    const logRows = logs.map((log) => [
      new Date(log.timestamp).toLocaleTimeString(),
      log.level,
      log.message.substring(0, 60) + (log.message.length > 60 ? '...' : ''),
    ]);
    console.log(formatTable(['Time', 'Level', 'Message'], logRows, options));
    console.log('');
  }

  // 次のアクション提案
  console.log(formatHeading('Suggested Actions', 2, options.color));
  if (specs.length === 0) {
    console.log('  • Create your first spec: takumi spec create "<name>"');
  }
  if (!config.github) {
    console.log('  • Configure GitHub: takumi github init <owner> <repo>');
  }
  if (specs.length > 0) {
    console.log('  • View specs: takumi spec list');
    console.log('  • Create a spec: takumi spec create "<name>"');
  }
}
