/**
 * GitHub Issue作成コマンド
 */

import '../../core/config/env.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSpecWithGitHubInfo, updateSpec, addGitHubSync } from '../../core/storage/index.js';
import { GitHubClient } from '../../integrations/github/client.js';
import { GitHubIssues } from '../../integrations/github/issues.js';
import { formatSuccess, formatHeading, formatKeyValue, formatInfo } from '../utils/output.js';
import {
  createProjectNotInitializedError,
  createSpecNotFoundError,
  createGitHubNotConfiguredError,
  handleCLIError,
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
 * GitHub Issue作成
 */
export async function createGitHubIssue(
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

  // 仕様書検索（JSON ストレージから同期的に取得）
  const spec = getSpecWithGitHubInfo(specId);

  if (!spec) {
    throw createSpecNotFoundError(specId);
  }

  // 既にIssueが作成されている場合
  if (spec.github_issue_number) {
    console.log(formatHeading('GitHub Issue Already Exists', 1, options.color));
    console.log('');
    console.log(formatKeyValue('Spec ID', spec.id, options.color));
    console.log(formatKeyValue('Spec Name', spec.name, options.color));
    console.log(formatKeyValue('Issue Number', `#${spec.github_issue_number}`, options.color));
    console.log('');
    console.log(
      `View issue: https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/${spec.github_issue_number}`
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
  const specPath = join(ccCraftKitDir, 'specs', `${spec.id}.md`);
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

    // JSON ストレージ更新（specs の updated_at のみ）
    console.log(formatInfo('Updating storage...', options.color));
    updateSpec(spec.id, { updated_at: new Date().toISOString() });

    // 同期ログ記録（github-sync.json に追加）
    addGitHubSync({
      entity_type: 'spec',
      entity_id: spec.id,
      github_id: issue.number.toString(),
      github_number: issue.number,
      github_node_id: null,
      issue_number: issue.number,
      issue_url: issue.html_url,
      pr_number: null,
      pr_url: null,
      pr_merged_at: null,
      sync_status: 'success',
      error_message: null,
      checkbox_hash: null,
      last_body_hash: null,
      parent_issue_number: null,
      parent_spec_id: null,
    });

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
    console.log(`  • Sync spec to GitHub: /cft:github-sync to-github ${spec.id.substring(0, 8)}`);
    console.log(`  • Sync GitHub to spec: /cft:github-sync from-github ${spec.id.substring(0, 8)}`);
    console.log('');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create GitHub issue: ${error.message}`);
    }
    throw error;
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const specId = process.argv[2];

  if (!specId) {
    console.error('Error: spec-id is required');
    console.error('Usage: npx tsx issue-create.ts <spec-id>');
    process.exit(1);
  }

  createGitHubIssue(specId).catch((error) => handleCLIError(error));
}
