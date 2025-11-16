/**
 * GitHub初期化コマンド
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatSuccess,
  formatHeading,
  formatKeyValue,
  formatInfo,
  formatError,
} from '../../utils/output.js';
import {
  createProjectNotInitializedError,
  createGitHubNotConfiguredError,
} from '../../utils/error-handler.js';
import { validateGitHubRepo } from '../../utils/validation.js';

/**
 * GitHub初期化
 */
export async function initGitHub(
  owner: string,
  repo: string,
  options: { color: boolean } = { color: true }
): Promise<void> {
  const cwd = process.cwd();
  const takumiDir = join(cwd, '.takumi');
  const configPath = join(takumiDir, 'config.json');

  // プロジェクト初期化チェック
  if (!existsSync(takumiDir)) {
    throw createProjectNotInitializedError();
  }

  // リポジトリ名の検証
  validateGitHubRepo(owner, repo);

  console.log(formatHeading('GitHub Integration Setup', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Owner', owner, options.color));
  console.log(formatKeyValue('Repository', repo, options.color));
  console.log('');

  // 既存設定を読み込み
  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    const configContent = readFileSync(configPath, 'utf-8');
    config = JSON.parse(configContent);
  }

  // GitHub設定を追加
  console.log(formatInfo('Updating configuration...', options.color));
  config.github = {
    owner,
    repo,
    initialized_at: new Date().toISOString(),
  };

  // 設定を保存
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  console.log('');
  console.log(formatSuccess('GitHub integration initialized successfully!', options.color));
  console.log('');

  // 環境変数チェック
  console.log(formatHeading('Environment Setup', 2, options.color));
  console.log('');

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.log(
      formatError('Warning: GITHUB_TOKEN environment variable is not set.', options.color)
    );
    console.log('');
    console.log('To use GitHub integration features, you need to set GITHUB_TOKEN:');
    console.log('');
    console.log('  1. Create a Personal Access Token (Fine-grained):');
    console.log('     https://github.com/settings/tokens?type=beta');
    console.log('');
    console.log('  2. Grant the following permissions:');
    console.log('     - Repository access: Select the target repository');
    console.log('     - Repository permissions:');
    console.log('       • Issues: Read and write');
    console.log('       • Metadata: Read-only');
    console.log('       • Projects: Read and write (if using Projects)');
    console.log('');
    console.log('  3. Set the token in your environment:');
    console.log('     export GITHUB_TOKEN="your_token_here"');
    console.log('');
    console.log('  Or add it to your .env file:');
    console.log('     echo "GITHUB_TOKEN=your_token_here" >> .env');
    console.log('');
  } else {
    console.log(formatSuccess('✓ GITHUB_TOKEN is set', options.color));
    console.log('');
  }

  // 次のアクション
  console.log(formatHeading('Next Actions', 2, options.color));
  console.log('');
  console.log('  • Create GitHub Issue from spec:');
  console.log(`    /takumi:github-issue-create <spec-id>`);
  console.log('');
  console.log('  • Sync spec to GitHub:');
  console.log(`    /takumi:github-sync to-github <spec-id>`);
  console.log('');
  console.log('  • Sync GitHub to spec:');
  console.log(`    /takumi:github-sync from-github <spec-id>`);
  console.log('');

  if (!githubToken) {
    throw createGitHubNotConfiguredError();
  }
}
