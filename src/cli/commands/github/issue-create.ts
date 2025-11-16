/**
 * GitHub Issue作成コマンド
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../../../core/database/connection.js';
import { GitHubClient } from '../../../integrations/github/client.js';
import { GitHubIssues } from '../../../integrations/github/issues.js';
import { formatSuccess, formatHeading, formatKeyValue, formatInfo } from '../../utils/output.js';
import {
  createProjectNotInitializedError,
  createSpecNotFoundError,
  createGitHubNotConfiguredError,
} from '../../utils/error-handler.js';
import { validateSpecId } from '../../utils/validation.js';

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
 * GitHub Issue作成
 */
export async function createGitHubIssue(
  specId: string,
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

  // 既にIssueが作成されている場合
  if (spec.github_issue_id) {
    console.log(formatHeading('GitHub Issue Already Exists', 1, options.color));
    console.log('');
    console.log(formatKeyValue('Spec ID', spec.id, options.color));
    console.log(formatKeyValue('Spec Name', spec.name, options.color));
    console.log(formatKeyValue('Issue Number', `#${spec.github_issue_id}`, options.color));
    console.log('');
    console.log(
      `View issue: https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/${spec.github_issue_id}`
    );
    console.log('');
    return;
  }

  console.log(formatHeading('Creating GitHub Issue', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Spec ID', spec.id, options.color));
  console.log(formatKeyValue('Spec Name', spec.name, options.color));
  console.log(formatKeyValue('Phase', spec.phase, options.color));
  console.log(
    formatKeyValue('Repository', `${githubConfig.owner}/${githubConfig.repo}`, options.color)
  );
  console.log('');

  // Markdownファイルを読み込んでIssue bodyとして使用
  const specPath = join(takumiDir, 'specs', `${spec.id}.md`);
  let body = '';
  if (existsSync(specPath)) {
    body = readFileSync(specPath, 'utf-8');
  } else {
    body = spec.description || '';
  }

  // GitHub APIクライアント作成
  console.log(formatInfo('Creating GitHub issue...', options.color));
  const client = new GitHubClient({ token: githubToken });
  const issues = new GitHubIssues(client);

  try {
    // Issue作成
    const issue = await issues.create({
      owner: githubConfig.owner,
      repo: githubConfig.repo,
      title: spec.name,
      body,
      labels: [`phase:${spec.phase}`],
    });

    // データベース更新
    console.log(formatInfo('Updating database...', options.color));
    await db
      .updateTable('specs')
      .set({
        github_issue_id: issue.number,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', spec.id)
      .execute();

    // 同期ログ記録
    await db
      .insertInto('github_sync')
      .values({
        entity_type: 'issue',
        entity_id: spec.id,
        github_id: issue.number.toString(),
        last_synced_at: new Date().toISOString(),
        sync_status: 'success',
      })
      .execute();

    console.log('');
    console.log(formatSuccess('GitHub issue created successfully!', options.color));
    console.log('');
    console.log(formatKeyValue('Issue Number', `#${issue.number}`, options.color));
    console.log(formatKeyValue('URL', issue.html_url, options.color));
    console.log('');

    // 次のアクション
    console.log(formatHeading('Next Actions', 2, options.color));
    console.log('');
    console.log(`  • View issue: ${issue.html_url}`);
    console.log(
      `  • Sync spec to GitHub: /takumi:github-sync to-github ${spec.id.substring(0, 8)}`
    );
    console.log(
      `  • Sync GitHub to spec: /takumi:github-sync from-github ${spec.id.substring(0, 8)}`
    );
    console.log('');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create GitHub issue: ${error.message}`);
    }
    throw error;
  }
}
