#!/usr/bin/env node
import 'dotenv/config';
import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEventBus } from '../core/workflow/event-bus.js';
import { getDatabase } from '../core/database/connection.js';
import { registerGitHubIntegrationHandlers } from '../core/workflow/github-integration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * パッケージ情報を取得
 */
function getPackageInfo(): { name: string; version: string } {
  const packageJsonPath = join(__dirname, '../../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  return {
    name: packageJson.name,
    version: packageJson.version,
  };
}

/**
 * ヘルプメッセージを表示
 */
function showHelp(): void {
  const { name, version } = getPackageInfo();
  console.log(`
${name} v${version} - 仕様駆動開発ツールキット

使用方法:
  takumi <command> [subcommand] [options] [...args]

コマンド:
  init [project-name]              プロジェクト初期化
  status                           プロジェクト状態表示

  spec create <name> [description] 仕様書作成
  spec list [phase] [limit]        仕様書一覧
  spec get <id>                    仕様書取得
  spec phase <id> <phase>          フェーズ更新

  github init <owner> <repo>       GitHub初期化
  github issue create <spec-id>    Issue作成
  github sync to-github <spec-id>  仕様書→GitHub同期
  github sync from-github <spec-id> GitHub→仕様書同期
  github project add <spec-id> <project-id> Projectボード追加

  knowledge progress <spec-id> <message>           進捗記録
  knowledge error <spec-id> <error> <solution>     エラー解決策記録
  knowledge tip <spec-id> <category> <tip>         Tips記録

グローバルオプション:
  --help, -h     このヘルプを表示
  --version, -v  バージョンを表示
  --format       出力形式 (table|json|markdown) [default: table]
  --no-color     カラー出力を無効化

例:
  takumi init my-project
  takumi spec create "ユーザー認証機能"
  takumi spec list requirements
  takumi github init myorg myrepo
`);
}

/**
 * バージョンを表示
 */
function showVersion(): void {
  const { version } = getPackageInfo();
  console.log(version);
}

/**
 * コマンドライン引数をパース
 */
interface ParsedArgs {
  command?: string;
  subcommand?: string;
  action?: string;
  args: string[];
  options: {
    help: boolean;
    version: boolean;
    format: 'table' | 'json' | 'markdown';
    color: boolean;
  };
}

function parseCliArgs(argv: string[]): ParsedArgs {
  // グローバルオプションをパース
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
      format: { type: 'string', default: 'table' },
      'no-color': { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const format = values.format as 'table' | 'json' | 'markdown';
  if (!['table', 'json', 'markdown'].includes(format)) {
    throw new Error(`Invalid format: ${format}. Must be table, json, or markdown.`);
  }

  // コマンド構造を解析
  const [command, subcommand, action, ...args] = positionals;

  return {
    command,
    subcommand,
    action,
    args,
    options: {
      help: values.help as boolean,
      version: values.version as boolean,
      format,
      color: !values['no-color'],
    },
  };
}

/**
 * コマンドルーティング
 */
async function routeCommand(parsed: ParsedArgs): Promise<void> {
  const { command, subcommand, action, args, options } = parsed;

  // グローバルオプション処理
  if (options.help) {
    showHelp();
    return;
  }

  if (options.version) {
    showVersion();
    return;
  }

  // コマンドが指定されていない場合
  if (!command) {
    showHelp();
    process.exit(1);
  }

  // コマンドルーティング
  switch (command) {
    case 'init': {
      const { initProject } = await import('./commands/init.js');
      const projectName = subcommand;
      await initProject(projectName, { color: options.color });
      break;
    }

    case 'status': {
      const { showStatus } = await import('./commands/status.js');
      await showStatus({ format: options.format, color: options.color });
      break;
    }

    case 'spec':
      await routeSpecCommand(subcommand, action, args, options);
      break;

    case 'github':
      await routeGitHubCommand(subcommand, action, args, options);
      break;

    case 'knowledge':
      await routeKnowledgeCommand(subcommand, action, args, options);
      break;

    default:
      console.error(`Error: Unknown command: ${command}`);
      console.error('Run "takumi --help" for usage information.');
      process.exit(1);
  }
}

/**
 * spec サブコマンドルーティング
 */
async function routeSpecCommand(
  subcommand: string | undefined,
  action: string | undefined,
  args: string[],
  options: ParsedArgs['options']
): Promise<void> {
  if (!subcommand) {
    console.error('Error: spec command requires a subcommand (create|list|get|phase)');
    process.exit(1);
  }

  switch (subcommand) {
    case 'create': {
      const { createSpec } = await import('./commands/spec/create.js');
      const name = action || ''; // actionが最初の引数
      const description = args[0]; // argsの最初が2番目の引数
      await createSpec(name, description, { color: options.color });
      break;
    }

    case 'list': {
      const { listSpecs } = await import('./commands/spec/list.js');
      const phase = action; // フェーズフィルター（オプション）
      const limit = args[0] ? parseInt(args[0], 10) : undefined;
      await listSpecs(phase, limit, { format: options.format, color: options.color });
      break;
    }

    case 'get': {
      const { getSpec } = await import('./commands/spec/get.js');
      const specId = action || '';
      await getSpec(specId, { color: options.color });
      break;
    }

    case 'phase': {
      const { updateSpecPhase } = await import('./commands/spec/phase.js');
      const specId = action || '';
      const newPhase = args[0] || '';
      await updateSpecPhase(specId, newPhase, { color: options.color });
      break;
    }

    default:
      console.error(`Error: Unknown spec subcommand: ${subcommand}`);
      process.exit(1);
  }
}

/**
 * github サブコマンドルーティング
 */
async function routeGitHubCommand(
  subcommand: string | undefined,
  action: string | undefined,
  args: string[],
  options: ParsedArgs['options']
): Promise<void> {
  if (!subcommand) {
    console.error('Error: github command requires a subcommand (init|issue|sync|project)');
    process.exit(1);
  }

  switch (subcommand) {
    case 'init': {
      const { initGitHub } = await import('./commands/github/init.js');
      const owner = action || '';
      const repo = args[0] || '';
      await initGitHub(owner, repo, { color: options.color });
      break;
    }

    case 'issue': {
      const issueSubcommand = action;
      if (issueSubcommand === 'create') {
        const { createGitHubIssue } = await import('./commands/github/issue-create.js');
        const specId = args[0] || '';
        await createGitHubIssue(specId, { color: options.color });
      } else {
        console.error(`Error: Unknown issue subcommand: ${issueSubcommand}`);
        process.exit(1);
      }
      break;
    }

    case 'sync': {
      const syncDirection = action;
      const specId = args[0] || '';
      if (syncDirection === 'to-github') {
        const { syncToGitHub } = await import('./commands/github/sync.js');
        await syncToGitHub(specId, { color: options.color });
      } else if (syncDirection === 'from-github') {
        const { syncFromGitHub } = await import('./commands/github/sync.js');
        await syncFromGitHub(specId, { color: options.color });
      } else {
        console.error(`Error: Unknown sync direction: ${syncDirection}`);
        console.error('Use "to-github" or "from-github"');
        process.exit(1);
      }
      break;
    }

    case 'project': {
      const projectSubcommand = action;
      if (projectSubcommand === 'add') {
        const { addSpecToProject } = await import('./commands/github/project-add.js');
        const specId = args[0] || '';
        const projectId = args[1] || '';
        await addSpecToProject(specId, projectId, { color: options.color });
      } else {
        console.error(`Error: Unknown project subcommand: ${projectSubcommand}`);
        process.exit(1);
      }
      break;
    }

    default:
      console.error(`Error: Unknown github subcommand: ${subcommand}`);
      process.exit(1);
  }
}

/**
 * knowledge サブコマンドルーティング
 */
async function routeKnowledgeCommand(
  subcommand: string | undefined,
  action: string | undefined,
  args: string[],
  options: ParsedArgs['options']
): Promise<void> {
  if (!subcommand) {
    console.error('Error: knowledge command requires a subcommand (progress|error|tip)');
    process.exit(1);
  }

  switch (subcommand) {
    case 'progress': {
      const { recordProgress } = await import('./commands/knowledge/record.js');
      const specId = action || '';
      const message = args[0] || '';
      await recordProgress(specId, message, { color: options.color });
      break;
    }

    case 'error': {
      const { recordErrorSolution } = await import('./commands/knowledge/record.js');
      const specId = action || '';
      const errorDescription = args[0] || '';
      const solution = args[1] || '';
      await recordErrorSolution(specId, errorDescription, solution, { color: options.color });
      break;
    }

    case 'tip': {
      const { recordTip } = await import('./commands/knowledge/record.js');
      const specId = action || '';
      const category = args[0] || '';
      const content = args[1] || '';
      await recordTip(specId, category, content, { color: options.color });
      break;
    }

    default:
      console.error(`Error: Unknown knowledge subcommand: ${subcommand}`);
      process.exit(1);
  }
}

/**
 * GitHub統合イベントハンドラーを初期化
 */
function initializeGitHubIntegration(): void {
  try {
    const cwd = process.cwd();
    const takumiDir = join(cwd, '.takumi');

    // .takumiディレクトリが存在する場合のみ初期化
    if (existsSync(takumiDir)) {
      const eventBus = getEventBus();
      const db = getDatabase();
      registerGitHubIntegrationHandlers(eventBus, db);
    }
  } catch {
    // 初期化エラーは無視（プロジェクト未初期化の場合など）
  }
}

/**
 * メイン関数
 */
async function main() {
  try {
    // GitHub統合ハンドラーを初期化
    initializeGitHubIntegration();

    const args = process.argv.slice(2);
    const parsed = parseCliArgs(args);
    await routeCommand(parsed);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Unknown error occurred');
    }
    process.exit(1);
  }
}

// 実行
main();
