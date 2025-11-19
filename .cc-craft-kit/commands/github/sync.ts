/**
 * GitHub同期コマンド
 */

import '../../core/config/env.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../../core/database/connection.js';
import { GitHubClient } from '../../integrations/github/client.js';
import { GitHubIssues } from '../../integrations/github/issues.js';
import { GitHubProjects } from '../../integrations/github/projects.js';
import { GitHubSyncService } from '../../integrations/github/sync.js';
import { formatSuccess, formatHeading, formatKeyValue, formatInfo } from '../utils/output.js';
import { createProjectNotInitializedError,
  createSpecNotFoundError,
  createGitHubNotConfiguredError, handleCLIError } from '../utils/error-handler.js';
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
 * 仕様書→GitHub同期
 */
export async function syncToGitHub(
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

  // 仕様書検索（部分一致対応）
  const spec = await db
    .selectFrom('specs')
    .selectAll()
    .where('id', 'like', `${specId}%`)
    .executeTakeFirst();

  if (!spec) {
    throw createSpecNotFoundError(specId);
  }

  console.log(formatHeading('Syncing Spec to GitHub', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Spec ID', spec.id, options.color));
  console.log(formatKeyValue('Spec Name', spec.name, options.color));
  console.log(formatKeyValue('Phase', spec.phase, options.color));
  console.log(
    formatKeyValue(
      'GitHub Issue',
      spec.github_issue_id ? `#${spec.github_issue_id}` : '(not created)',
      options.color
    )
  );
  console.log('');

  // GitHub APIクライアント作成
  const client = new GitHubClient({ token: githubToken });
  const issues = new GitHubIssues(client);
  const projects = new GitHubProjects(client);
  const syncService = new GitHubSyncService(db, issues, projects);

  try {
    console.log(formatInfo('Syncing to GitHub...', options.color));
    const issueNumber = await syncService.syncSpecToIssue({
      specId: spec.id,
      owner: githubConfig.owner,
      repo: githubConfig.repo,
      createIfNotExists: true,
    });

    console.log('');
    console.log(formatSuccess('Spec synced to GitHub successfully!', options.color));
    console.log('');
    console.log(formatKeyValue('Issue Number', `#${issueNumber}`, options.color));
    console.log(
      formatKeyValue(
        'URL',
        `https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/${issueNumber}`,
        options.color
      )
    );
    console.log('');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to sync to GitHub: ${error.message}`);
    }
    throw error;
  }
}

/**
 * GitHub→仕様書同期
 */
export async function syncFromGitHub(
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
    throw new Error('Spec has no linked GitHub Issue. Use "sync to-github" first.');
  }

  console.log(formatHeading('Syncing from GitHub', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Spec ID', spec.id, options.color));
  console.log(formatKeyValue('Spec Name', spec.name, options.color));
  console.log(formatKeyValue('GitHub Issue', `#${spec.github_issue_id}`, options.color));
  console.log('');

  // GitHub APIクライアント作成
  const client = new GitHubClient({ token: githubToken });
  const issues = new GitHubIssues(client);
  const projects = new GitHubProjects(client);
  const syncService = new GitHubSyncService(db, issues, projects);

  try {
    console.log(formatInfo('Syncing from GitHub...', options.color));
    await syncService.syncIssueToSpec({
      owner: githubConfig.owner,
      repo: githubConfig.repo,
      issueNumber: spec.github_issue_id,
    });

    console.log('');
    console.log(formatSuccess('Spec updated from GitHub successfully!', options.color));
    console.log('');

    // 更新後の仕様書を表示
    const updatedSpec = await db
      .selectFrom('specs')
      .selectAll()
      .where('id', '=', spec.id)
      .executeTakeFirstOrThrow();

    console.log(formatKeyValue('Updated Name', updatedSpec.name, options.color));
    console.log(formatKeyValue('Updated Phase', updatedSpec.phase, options.color));
    console.log('');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to sync from GitHub: ${error.message}`);
    }
    throw error;
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const direction = process.argv[2];
  const specId = process.argv[3];

  if (!direction || !specId) {
    console.error('Error: direction and spec-id are required');
    console.error('Usage: npx tsx sync.ts <to-github|from-github> <spec-id>');
    process.exit(1);
  }

  if (direction === 'to-github') {
    syncToGitHub(specId).catch((error) => handleCLIError(error));
  } else if (direction === 'from-github') {
    syncFromGitHub(specId).catch((error) => handleCLIError(error));
  } else {
    console.error('Error: direction must be "to-github" or "from-github"');
    process.exit(1);
  }
}
