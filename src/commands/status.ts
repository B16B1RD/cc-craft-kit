/**
 * プロジェクト状態表示コマンド
 */

import '../core/config/env.js';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../core/database/connection.js';
import { createBackup } from '../core/database/backup.js';
import {
  formatHeading,
  formatKeyValue,
  formatTable,
  formatInfo,
  OutputOptions,
} from './utils/output.js';
import {
  createProjectNotInitializedError,
  exitGracefully,
  handleCLIError,
} from './utils/error-handler.js';
import { resolveProjectId } from '../integrations/github/project-resolver.js';

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
    project_name_cache?: {
      name: string;
      resolved_number: number;
      cached_at: string;
    };
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
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const configPath = join(ccCraftKitDir, 'config.json');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    throw createProjectNotInitializedError();
  }

  // 設定ファイル読み込み
  const config: ProjectConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

  // データベースバックアップ作成（週1回）
  const dbPath = join(ccCraftKitDir, 'cc-craft-kit.db');
  const backupDir = join(ccCraftKitDir, 'backups');
  try {
    // バックアップディレクトリの最終更新日時をチェック
    if (existsSync(backupDir)) {
      const backups = readdirSync(backupDir).filter((f: string) => f.startsWith('cc-craft-kit-'));

      // 最新のバックアップが7日以上前の場合、または バックアップが0件の場合は作成
      if (backups.length === 0) {
        createBackup(dbPath, { backupDir, maxBackups: 10 });
      } else {
        const latestBackup = backups
          .map((f: string) => ({
            path: join(backupDir, f),
            time: statSync(join(backupDir, f)).mtime.getTime(),
          }))
          .sort((a: { time: number }, b: { time: number }) => b.time - a.time)[0];

        const daysSinceBackup = (Date.now() - latestBackup.time) / (1000 * 60 * 60 * 24);
        if (daysSinceBackup >= 7) {
          createBackup(dbPath, { backupDir, maxBackups: 10 });
        }
      }
    } else {
      // 初回バックアップ
      createBackup(dbPath, { backupDir, maxBackups: 10 });
    }
  } catch (error) {
    // バックアップ失敗は警告のみ
    console.warn('Warning: Failed to create database backup:', error);
  }

  console.log(formatHeading('cc-craft-kit Project Status', 1, options.color));
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
  console.log(formatKeyValue('Directory', ccCraftKitDir, options.color));
  console.log('');

  // GitHub 連携状態
  if (config.github) {
    console.log(formatHeading('GitHub Integration', 2, options.color));
    console.log(
      formatKeyValue('Repository', `${config.github.owner}/${config.github.repo}`, options.color)
    );

    // Project ID を解決
    const projectId = await resolveProjectId(ccCraftKitDir);
    console.log(
      formatKeyValue('Project ID', projectId ? `#${projectId}` : '(not set)', options.color)
    );

    // 環境変数GITHUB_TOKENの存在をチェック
    const hasToken = !!process.env.GITHUB_TOKEN;
    console.log(formatKeyValue('Token', hasToken ? '✓ Configured' : '✗ Not set', options.color));
    console.log('');
  } else {
    console.log(
      formatInfo('GitHub is not configured. Run "/cft:github-init" to set up.', options.color)
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

  // GitHub Issue 未作成の仕様書を集計
  // specs.github_issue_id が NULL の仕様書を検索（completed フェーズを除外）
  const specsWithoutIssue = await db
    .selectFrom('specs')
    .where('github_issue_id', 'is', null)
    .where('phase', '!=', 'completed')
    .select(['id', 'name', 'phase'])
    .execute();

  if (specsWithoutIssue.length > 0) {
    console.log(
      formatKeyValue('Issue 未作成の仕様書', `${specsWithoutIssue.length} 件`, options.color)
    );
    console.log(formatInfo('  手動で Issue を作成してください:', options.color));

    // 最初の3件のみ表示
    const displaySpecs = specsWithoutIssue.slice(0, 3);
    for (const spec of displaySpecs) {
      console.log(formatInfo(`    • ${spec.name} (${spec.phase})`, options.color));
      console.log(
        formatInfo(`      /cft:github-issue-create ${spec.id.substring(0, 8)}`, options.color)
      );
    }

    if (specsWithoutIssue.length > 3) {
      console.log(formatInfo(`    ... and ${specsWithoutIssue.length - 3} more`, options.color));
    }

    console.log('');
  }

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

  // 最近のエラーログ（error と warn のみを表示）
  const errorLogs = await db
    .selectFrom('logs')
    .select(['level', 'message', 'timestamp'])
    .where('level', 'in', ['error', 'warn'])
    .orderBy('timestamp', 'desc')
    .limit(10)
    .execute();

  if (errorLogs.length > 0) {
    console.log(formatHeading('Recent Error Logs', 2, options.color));
    const errorLogRows = errorLogs.map((log) => [
      new Date(log.timestamp).toLocaleTimeString(),
      log.level,
      log.message.substring(0, 60) + (log.message.length > 60 ? '...' : ''),
    ]);
    console.log(formatTable(['Time', 'Level', 'Message'], errorLogRows, options));
    console.log('');
  }

  // 最近の活動（すべてのログから取得）
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
    console.log('  • Create your first spec: /cft:spec-create "<name>"');
  }
  if (!config.github) {
    console.log('  • Configure GitHub: /cft:github-init <owner> <repo>');
  }
  if (specs.length > 0) {
    console.log('  • View specs: /cft:spec-list');
    console.log('  • Create a spec: /cft:spec-create "<name>"');
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  showStatus()
    .then(() => exitGracefully(0))
    .catch((error) => handleCLIError(error));
}
