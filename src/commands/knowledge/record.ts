/**
 * ナレッジベース記録コマンド
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../../core/database/connection.js';
import { GitHubClient } from '../../integrations/github/client.js';
import { GitHubIssues } from '../../integrations/github/issues.js';
import { GitHubKnowledgeBase } from '../../integrations/github/knowledge-base.js';
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
function getGitHubConfig(takumiDir: string): { owner: string; repo: string } | null {
  const configPath = join(takumiDir, 'config.json');
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
  const takumiDir = join(cwd, '.takumi');

  // プロジェクト初期化チェック
  if (!existsSync(takumiDir)) {
    throw createProjectNotInitializedError();
  }

  // 仕様書IDの検証
  validateSpecId(specId);

  // GitHub設定チェック
  const githubConfig = getGitHubConfig(takumiDir);
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
      'Spec has no linked GitHub Issue. Create an issue first with "/takumi:github-issue-create".'
    );
  }

  console.log(formatHeading('Recording Progress', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Spec ID', spec.id, options.color));
  console.log(formatKeyValue('Spec Name', spec.name, options.color));
  console.log(formatKeyValue('GitHub Issue', `#${spec.github_issue_id}`, options.color));
  console.log('');

  // GitHub APIクライアント作成
  const client = new GitHubClient({ token: githubToken });
  const issues = new GitHubIssues(client);
  const knowledgeBase = new GitHubKnowledgeBase(db, issues);

  try {
    console.log(formatInfo('Recording progress to GitHub Issue...', options.color));
    const commentId = await knowledgeBase.recordProgress({
      specId: spec.id,
      owner: githubConfig.owner,
      repo: githubConfig.repo,
      summary: message,
      details: message,
    });

    console.log('');
    console.log(formatSuccess('Progress recorded successfully!', options.color));
    console.log('');
    console.log(formatKeyValue('Comment ID', commentId, options.color));
    console.log(
      formatKeyValue(
        'URL',
        `https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/${spec.github_issue_id}#issuecomment-${commentId}`,
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
  const takumiDir = join(cwd, '.takumi');

  // プロジェクト初期化チェック
  if (!existsSync(takumiDir)) {
    throw createProjectNotInitializedError();
  }

  // 仕様書IDの検証
  validateSpecId(specId);

  // GitHub設定チェック
  const githubConfig = getGitHubConfig(takumiDir);
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
      'Spec has no linked GitHub Issue. Create an issue first with "/takumi:github-issue-create".'
    );
  }

  console.log(formatHeading('Recording Error Solution', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Spec ID', spec.id, options.color));
  console.log(formatKeyValue('Spec Name', spec.name, options.color));
  console.log(formatKeyValue('GitHub Issue', `#${spec.github_issue_id}`, options.color));
  console.log('');

  // GitHub APIクライアント作成
  const client = new GitHubClient({ token: githubToken });
  const issues = new GitHubIssues(client);
  const knowledgeBase = new GitHubKnowledgeBase(db, issues);

  try {
    console.log(formatInfo('Recording error solution to GitHub Issue...', options.color));
    const commentId = await knowledgeBase.recordErrorSolution({
      specId: spec.id,
      owner: githubConfig.owner,
      repo: githubConfig.repo,
      errorDescription,
      solution,
    });

    console.log('');
    console.log(formatSuccess('Error solution recorded successfully!', options.color));
    console.log('');
    console.log(formatKeyValue('Comment ID', commentId, options.color));
    console.log(
      formatKeyValue(
        'URL',
        `https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/${spec.github_issue_id}#issuecomment-${commentId}`,
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
  const takumiDir = join(cwd, '.takumi');

  // プロジェクト初期化チェック
  if (!existsSync(takumiDir)) {
    throw createProjectNotInitializedError();
  }

  // 仕様書IDの検証
  validateSpecId(specId);

  // GitHub設定チェック
  const githubConfig = getGitHubConfig(takumiDir);
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
      'Spec has no linked GitHub Issue. Create an issue first with "/takumi:github-issue-create".'
    );
  }

  console.log(formatHeading('Recording Tip', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Spec ID', spec.id, options.color));
  console.log(formatKeyValue('Spec Name', spec.name, options.color));
  console.log(formatKeyValue('GitHub Issue', `#${spec.github_issue_id}`, options.color));
  console.log(formatKeyValue('Category', category, options.color));
  console.log('');

  // GitHub APIクライアント作成
  const client = new GitHubClient({ token: githubToken });
  const issues = new GitHubIssues(client);
  const knowledgeBase = new GitHubKnowledgeBase(db, issues);

  try {
    console.log(formatInfo('Recording tip to GitHub Issue...', options.color));
    const commentId = await knowledgeBase.recordTip({
      specId: spec.id,
      owner: githubConfig.owner,
      repo: githubConfig.repo,
      title: category,
      content,
      category,
    });

    console.log('');
    console.log(formatSuccess('Tip recorded successfully!', options.color));
    console.log('');
    console.log(formatKeyValue('Comment ID', commentId, options.color));
    console.log(
      formatKeyValue(
        'URL',
        `https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/${spec.github_issue_id}#issuecomment-${commentId}`,
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
