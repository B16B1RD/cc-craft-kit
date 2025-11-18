/**
 * ナレッジベース記録コマンド
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../../core/database/connection.js';
import { getEventBusAsync } from '../../core/workflow/event-bus.js';
import { formatSuccess, formatHeading, formatKeyValue, formatInfo } from '../utils/output.js';
import {
  createProjectNotInitializedError,
  createSpecNotFoundError,
  createGitHubNotConfiguredError,
} from '../utils/error-handler.js';
import { validateSpecId } from '../utils/validation.js';

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
 * 進捗記録
 */
export async function recordProgress(
  specId: string,
  message: string,
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

  // 仕様書検索（部分一致対応）
  const spec = await db
    .selectFrom('specs')
    .selectAll()
    .where('id', 'like', `${specId}%`)
    .executeTakeFirst();

  if (!spec) {
    throw createSpecNotFoundError(specId);
  }

  if (!spec.github_issue_id) {
    throw new Error(
      'Spec has no linked GitHub Issue. Create an issue first with "/cft:github-issue-create".'
    );
  }

  console.log(formatHeading('Recording Progress', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Spec ID', spec.id, options.color));
  console.log(formatKeyValue('Spec Name', spec.name, options.color));
  console.log(formatKeyValue('GitHub Issue', `#${spec.github_issue_id}`, options.color));
  console.log('');

  // イベント発火
  try {
    console.log(formatInfo('Recording progress to GitHub Issue...', options.color));
    const eventBus = await getEventBusAsync();
    await eventBus.emit(
      eventBus.createEvent('knowledge.progress_recorded', spec.id, {
        message,
        timestamp: new Date().toISOString(),
      })
    );

    console.log('');
    console.log(formatSuccess('Progress recorded successfully!', options.color));
    console.log('');
    console.log(
      formatKeyValue(
        'URL',
        `https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/${spec.github_issue_id}`,
        options.color
      )
    );
    console.log('');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to record progress: ${error.message}`);
    }
    throw error;
  }
}

/**
 * エラー解決策記録
 */
export async function recordErrorSolution(
  specId: string,
  errorDescription: string,
  solution: string,
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

  // 仕様書検索（部分一致対応）
  const spec = await db
    .selectFrom('specs')
    .selectAll()
    .where('id', 'like', `${specId}%`)
    .executeTakeFirst();

  if (!spec) {
    throw createSpecNotFoundError(specId);
  }

  if (!spec.github_issue_id) {
    throw new Error(
      'Spec has no linked GitHub Issue. Create an issue first with "/cft:github-issue-create".'
    );
  }

  console.log(formatHeading('Recording Error Solution', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Spec ID', spec.id, options.color));
  console.log(formatKeyValue('Spec Name', spec.name, options.color));
  console.log(formatKeyValue('GitHub Issue', `#${spec.github_issue_id}`, options.color));
  console.log('');

  // イベント発火
  try {
    console.log(formatInfo('Recording error solution to GitHub Issue...', options.color));
    const eventBus = await getEventBusAsync();
    await eventBus.emit(
      eventBus.createEvent('knowledge.error_recorded', spec.id, {
        errorDescription,
        solution,
        timestamp: new Date().toISOString(),
      })
    );

    console.log('');
    console.log(formatSuccess('Error solution recorded successfully!', options.color));
    console.log('');
    console.log(
      formatKeyValue(
        'URL',
        `https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/${spec.github_issue_id}`,
        options.color
      )
    );
    console.log('');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to record error solution: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Tips記録
 */
export async function recordTip(
  specId: string,
  category: string,
  content: string,
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

  // 仕様書検索（部分一致対応）
  const spec = await db
    .selectFrom('specs')
    .selectAll()
    .where('id', 'like', `${specId}%`)
    .executeTakeFirst();

  if (!spec) {
    throw createSpecNotFoundError(specId);
  }

  if (!spec.github_issue_id) {
    throw new Error(
      'Spec has no linked GitHub Issue. Create an issue first with "/cft:github-issue-create".'
    );
  }

  console.log(formatHeading('Recording Tip', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Spec ID', spec.id, options.color));
  console.log(formatKeyValue('Spec Name', spec.name, options.color));
  console.log(formatKeyValue('GitHub Issue', `#${spec.github_issue_id}`, options.color));
  console.log(formatKeyValue('Category', category, options.color));
  console.log('');

  // イベント発火
  try {
    console.log(formatInfo('Recording tip to GitHub Issue...', options.color));
    const eventBus = await getEventBusAsync();
    await eventBus.emit(
      eventBus.createEvent('knowledge.tip_recorded', spec.id, {
        category,
        title: category,
        content,
        timestamp: new Date().toISOString(),
      })
    );

    console.log('');
    console.log(formatSuccess('Tip recorded successfully!', options.color));
    console.log('');
    console.log(
      formatKeyValue(
        'URL',
        `https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/${spec.github_issue_id}`,
        options.color
      )
    );
    console.log('');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to record tip: ${error.message}`);
    }
    throw error;
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const specId = process.argv[3];

  if (!command || !specId) {
    console.error('Error: command and spec-id are required');
    console.error('Usage:');
    console.error('  npx tsx record.ts progress <spec-id> <message>');
    console.error('  npx tsx record.ts error <spec-id> <error> <solution>');
    console.error('  npx tsx record.ts tip <spec-id> <category> <tip>');
    process.exit(1);
  }

  if (command === 'progress') {
    const message = process.argv.slice(4).join(' ');
    if (!message) {
      console.error('Error: message is required');
      process.exit(1);
    }
    recordProgress(specId, message).catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
  } else if (command === 'error') {
    const errorMsg = process.argv[4];
    const solution = process.argv.slice(5).join(' ');
    if (!errorMsg || !solution) {
      console.error('Error: error and solution are required');
      process.exit(1);
    }
    recordErrorSolution(specId, errorMsg, solution).catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
  } else if (command === 'tip') {
    const category = process.argv[4];
    const tip = process.argv.slice(5).join(' ');
    if (!category || !tip) {
      console.error('Error: category and tip are required');
      process.exit(1);
    }
    recordTip(specId, category, tip).catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
  } else {
    console.error('Error: command must be "progress", "error", or "tip"');
    process.exit(1);
  }
}
