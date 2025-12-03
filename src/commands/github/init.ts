/**
 * GitHub初期化コマンド
 */

import '../../core/config/env.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatSuccess,
  formatHeading,
  formatKeyValue,
  formatInfo,
  formatError,
  formatWarning,
} from '../utils/output.js';
import {
  createProjectNotInitializedError,
  createGitHubNotConfiguredError,
  handleCLIError,
} from '../utils/error-handler.js';
import { validateGitHubRepo } from '../utils/validation.js';
import { GitHubClient } from '../../integrations/github/client.js';
import { GitHubProjects } from '../../integrations/github/projects.js';
import {
  DEFAULT_STATUS_CONFIG,
  type GitHubStatusConfig,
} from '../../core/config/github-status-config.js';

/**
 * GitHub初期化オプション
 */
export interface InitGitHubOptions {
  color: boolean;
  projectNumber?: number;
}

/**
 * GitHub初期化
 */
export async function initGitHub(
  owner: string,
  repo: string,
  options: InitGitHubOptions = { color: true }
): Promise<void> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const configPath = join(ccCraftKitDir, 'config.json');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
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

  // 既存の statusConfig を取得（あれば）
  const existingGitHub = config.github as Record<string, unknown> | undefined;
  const existingStatusConfig = existingGitHub?.statusConfig as
    | Partial<GitHubStatusConfig>
    | undefined;

  // デフォルトの statusConfig を設定
  let statusConfig: GitHubStatusConfig = {
    ...DEFAULT_STATUS_CONFIG,
    ...existingStatusConfig,
    cachedAt: null,
  };

  config.github = {
    owner,
    repo,
    initialized_at: new Date().toISOString(),
    statusConfig,
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

    // Projects からステータスを自動検出（projectNumber が指定されている場合）
    if (options.projectNumber) {
      console.log(formatHeading('Status Detection', 2, options.color));
      console.log('');
      console.log(
        formatInfo(
          `Detecting available statuses from Project #${options.projectNumber}...`,
          options.color
        )
      );

      try {
        const client = new GitHubClient({ token: githubToken });
        const projects = new GitHubProjects(client);

        const detectedStatuses = await projects.detectAvailableStatuses(
          owner,
          options.projectNumber
        );

        if (detectedStatuses.length > 0) {
          console.log(
            formatSuccess(`Found ${detectedStatuses.length} status options:`, options.color)
          );
          detectedStatuses.forEach((status) => {
            console.log(`    • ${status}`);
          });
          console.log('');

          // statusConfig を更新
          statusConfig = {
            ...statusConfig,
            availableStatuses: detectedStatuses,
            cachedAt: new Date().toISOString(),
          };

          // In Review の有無をチェックしてマッピングを調整
          if (!detectedStatuses.includes('In Review')) {
            console.log(
              formatWarning(
                'Note: "In Review" status not found. Using "In Progress" as fallback for implementation phase.',
                options.color
              )
            );
            statusConfig.statusMapping = {
              ...statusConfig.statusMapping,
              implementation: 'In Progress',
            };
          }

          // config.json を再保存
          config.github = {
            ...(config.github as Record<string, unknown>),
            statusConfig,
          };
          writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

          console.log(formatSuccess('Status configuration saved to config.json', options.color));
          console.log('');
        } else {
          console.log(
            formatWarning('No status options found. Using default configuration.', options.color)
          );
          console.log('');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(formatWarning(`Failed to detect statuses: ${errorMessage}`, options.color));
        console.log(formatInfo('Using default status configuration.', options.color));
        console.log('');
      }
    }
  }

  // 次のアクション
  console.log(formatHeading('Next Actions', 2, options.color));
  console.log('');
  console.log('  • Create GitHub Issue from spec:');
  console.log(`    /cft:github-issue-create <spec-id>`);
  console.log('');
  console.log('  • Sync spec to GitHub:');
  console.log(`    /cft:github-sync to-github <spec-id>`);
  console.log('');
  console.log('  • Sync GitHub to spec:');
  console.log(`    /cft:github-sync from-github <spec-id>`);
  console.log('');

  if (!githubToken) {
    throw createGitHubNotConfiguredError();
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const owner = process.argv[2];
  const repo = process.argv[3];
  const projectNumberArg = process.argv[4];

  if (!owner || !repo) {
    console.error('Error: owner and repo are required');
    console.error('Usage: npx tsx init.ts <owner> <repo> [project-number]');
    console.error('');
    console.error('Options:');
    console.error('  project-number  GitHub Project number for status detection');
    process.exit(1);
  }

  const options: InitGitHubOptions = { color: true };
  if (projectNumberArg) {
    const projectNumber = parseInt(projectNumberArg, 10);
    if (isNaN(projectNumber) || projectNumber <= 0) {
      console.error(`Error: Invalid project number: ${projectNumberArg}`);
      process.exit(1);
    }
    options.projectNumber = projectNumber;
  }

  initGitHub(owner, repo, options).catch((error) => handleCLIError(error));
}
