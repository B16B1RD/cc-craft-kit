/**
 * GitHub Sub Issue 一括作成コマンド
 *
 * 仕様書の「8. 実装タスクリスト」からタスクを解析し、
 * Sub Issue として一括作成します。
 */

import '../../core/config/env.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDatabase, closeDatabase } from '../../core/database/connection.js';
import { getSpecWithGitHubInfo } from '../../core/database/helpers.js';
import { SubIssueManager } from '../../integrations/github/sub-issues.js';
import {
  formatSuccess,
  formatHeading,
  formatKeyValue,
  formatInfo,
  formatWarning,
} from '../utils/output.js';
import {
  createProjectNotInitializedError,
  createSpecNotFoundError,
  createGitHubNotConfiguredError,
  handleCLIError,
} from '../utils/error-handler.js';
import { validateSpecId } from '../utils/validation.js';

/**
 * タスク情報
 */
interface TaskInfo {
  id: string;
  title: string;
  description?: string;
}

/**
 * GitHub設定を取得
 */
function getGitHubConfig(ccCraftKitDir: string): { owner: string; repo: string } | null {
  const configPath = join(ccCraftKitDir, 'config.json');
  if (!existsSync(configPath)) {
    return null;
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  if (!config.github || !config.github.owner || !config.github.repo) {
    return null;
  }

  return {
    owner: config.github.owner,
    repo: config.github.repo,
  };
}

/**
 * タスクタイトルから説明文を生成
 *
 * タスクタイトルに含まれるファイルパスや変更内容を解析して、
 * Sub Issue の本文に設定する説明文を生成します。
 */
function generateTaskDescription(title: string, phaseName?: string): string {
  const lines: string[] = [];

  // Phase 情報があれば追加
  if (phaseName) {
    lines.push(`## Phase: ${phaseName}`);
    lines.push('');
  }

  lines.push('## タスク内容');
  lines.push('');
  lines.push(title);
  lines.push('');

  // ファイルパスを検出（バッククォートで囲まれたパス）
  const filePathMatches = title.match(/`([^`]+\.[a-z]+)`/gi);
  if (filePathMatches && filePathMatches.length > 0) {
    lines.push('## 対象ファイル');
    lines.push('');
    for (const match of filePathMatches) {
      const filePath = match.replace(/`/g, '');
      lines.push(`- \`${filePath}\``);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*この Issue は cc-craft-kit によって自動生成されました。*');

  return lines.join('\n');
}

/**
 * 仕様書から実装タスクリストを解析
 */
function parseTaskListFromSpecContent(content: string): TaskInfo[] {
  // 「## 8. 実装タスクリスト」セクションを抽出
  const taskSectionMatch = content.match(
    /##\s*8\.\s*実装タスクリスト[\s\S]*?(?=\n##\s|\n---\s|$)/i
  );

  if (!taskSectionMatch) {
    return [];
  }

  const taskSection = taskSectionMatch[0];
  const tasks: TaskInfo[] = [];

  // 複数のパターンに対応
  // パターン 1: 「- [ ] **タスク X**: ...」
  // パターン 2: 「- [ ] タスク内容」（シンプルな形式）
  // パターン 3: 「- [ ] `ファイル名` の変更内容」
  const lines = taskSection.split('\n');

  // 現在の Phase 名を追跡
  let currentPhase: string | undefined;

  for (const line of lines) {
    // Phase ヘッダーを検出（### Phase X: ... 形式）
    const phaseMatch = line.match(/^###\s*Phase\s*\d+:\s*(.+)$/i);
    if (phaseMatch) {
      currentPhase = phaseMatch[1].trim();
      continue;
    }

    // チェックボックス行を検出
    const checkboxMatch = line.match(/^\s*-\s*\[\s*\]\s*(.+)$/);
    if (!checkboxMatch) {
      continue;
    }

    const rawTitle = checkboxMatch[1].trim();

    // 空のタイトルはスキップ
    if (!rawTitle) {
      continue;
    }

    // UUID を生成
    const taskId = randomUUID();

    tasks.push({
      id: taskId,
      title: rawTitle,
      description: generateTaskDescription(rawTitle, currentPhase),
    });
  }

  return tasks;
}

/**
 * Sub Issue 一括作成
 */
export async function createSubIssues(
  specId: string,
  options: { color: boolean } = { color: true }
): Promise<void> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    throw createProjectNotInitializedError();
  }

  // 仕様書IDの検証
  validateSpecId(specId);

  // GitHub設定チェック
  const githubConfig = getGitHubConfig(ccCraftKitDir);
  if (!githubConfig) {
    throw createGitHubNotConfiguredError();
  }

  // GITHUB_TOKENチェック
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw createGitHubNotConfiguredError();
  }

  // データベース取得
  const db = getDatabase();

  // 仕様書検索
  const spec = await getSpecWithGitHubInfo(db, specId);

  if (!spec) {
    throw createSpecNotFoundError(specId);
  }

  // GitHub Issue が存在しない場合
  if (!spec.github_issue_number) {
    console.log(formatWarning('GitHub Issue not found for this spec.', options.color));
    console.log('');
    console.log('Create a GitHub Issue first:');
    console.log(`  /cft:github-issue-create ${spec.id.substring(0, 8)}`);
    console.log('');
    return;
  }

  console.log(formatHeading('Creating Sub Issues', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Spec ID', spec.id, options.color));
  console.log(formatKeyValue('Spec Name', spec.name, options.color));
  console.log(formatKeyValue('Parent Issue', `#${spec.github_issue_number}`, options.color));
  console.log('');

  // 仕様書ファイルを読み込み
  const specPath = join(ccCraftKitDir, 'specs', `${spec.id}.md`);
  if (!existsSync(specPath)) {
    console.log(formatWarning('Spec file not found.', options.color));
    return;
  }

  const specContent = readFileSync(specPath, 'utf-8');

  // タスクリストを解析
  const tasks = parseTaskListFromSpecContent(specContent);

  if (tasks.length === 0) {
    console.log(
      formatWarning('No tasks found in "## 8. 実装タスクリスト" section.', options.color)
    );
    console.log('');
    console.log('Make sure the spec file contains a task list section with checkboxes:');
    console.log('');
    console.log('  ## 8. 実装タスクリスト');
    console.log('  - [ ] Task 1');
    console.log('  - [ ] Task 2');
    console.log('');
    return;
  }

  console.log(formatInfo(`Found ${tasks.length} tasks to create as Sub Issues.`, options.color));
  console.log('');

  // Sub Issue Manager を使用して一括作成
  const subIssueManager = new SubIssueManager(db);

  try {
    await subIssueManager.createSubIssuesFromTaskList({
      owner: githubConfig.owner,
      repo: githubConfig.repo,
      parentIssueNumber: spec.github_issue_number,
      taskList: tasks,
      githubToken,
    });

    console.log('');
    console.log(formatSuccess(`Created ${tasks.length} Sub Issues successfully!`, options.color));
    console.log('');
    console.log(formatHeading('Created Sub Issues', 2, options.color));
    console.log('');

    for (const task of tasks) {
      console.log(`  • ${task.title}`);
    }

    console.log('');
    console.log(formatHeading('Next Actions', 2, options.color));
    console.log('');
    console.log(
      `  • View parent issue: https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/${spec.github_issue_number}`
    );
    console.log(`  • Start implementation: /cft:spec-phase ${spec.id.substring(0, 8)} impl`);
    console.log('');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create Sub Issues: ${error.message}`);
    }
    throw error;
  }
}

// 出力データ（JSON形式）
interface CreateSubIssuesOutput {
  success: boolean;
  specId: string;
  specName: string;
  parentIssueNumber: number | null;
  createdTasks: number;
  error?: string;
}

/**
 * JSON 出力形式で実行（プロンプトからの呼び出し用）
 */
export async function createSubIssuesJson(specId: string): Promise<void> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const output: CreateSubIssuesOutput = {
    success: false,
    specId: '',
    specName: '',
    parentIssueNumber: null,
    createdTasks: 0,
  };

  try {
    // プロジェクト初期化チェック
    if (!existsSync(ccCraftKitDir)) {
      output.error = 'Project not initialized';
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // GitHub設定チェック
    const githubConfig = getGitHubConfig(ccCraftKitDir);
    if (!githubConfig) {
      output.error = 'GitHub not configured';
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      output.error = 'GITHUB_TOKEN not set';
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    const db = getDatabase();
    const spec = await getSpecWithGitHubInfo(db, specId);

    if (!spec) {
      output.error = `Spec not found: ${specId}`;
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    output.specId = spec.id;
    output.specName = spec.name;
    output.parentIssueNumber = spec.github_issue_number;

    if (!spec.github_issue_number) {
      output.error = 'GitHub Issue not found for this spec';
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    const specPath = join(ccCraftKitDir, 'specs', `${spec.id}.md`);
    if (!existsSync(specPath)) {
      output.error = 'Spec file not found';
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    const specContent = readFileSync(specPath, 'utf-8');
    const tasks = parseTaskListFromSpecContent(specContent);

    if (tasks.length === 0) {
      output.error = 'No tasks found in spec';
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    const subIssueManager = new SubIssueManager(db);
    await subIssueManager.createSubIssuesFromTaskList({
      owner: githubConfig.owner,
      repo: githubConfig.repo,
      parentIssueNumber: spec.github_issue_number,
      taskList: tasks,
      githubToken,
    });

    output.success = true;
    output.createdTasks = tasks.length;
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    output.error = error instanceof Error ? error.message : 'Unknown error';
    console.log(JSON.stringify(output, null, 2));
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const specId = process.argv[2];
  const jsonMode = process.argv.includes('--json');

  if (!specId) {
    console.error('Error: spec-id is required');
    console.error('Usage: npx tsx create-sub-issues.ts <spec-id> [--json]');
    process.exit(1);
  }

  if (jsonMode) {
    createSubIssuesJson(specId)
      .catch((error) => {
        console.log(JSON.stringify({ success: false, error: error.message }));
      })
      .finally(() => closeDatabase());
  } else {
    createSubIssues(specId)
      .catch((error) => handleCLIError(error))
      .finally(() => closeDatabase());
  }
}
