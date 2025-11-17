/**
 * GitHub Project追加コマンド
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../../core/database/connection.js';
import { GitHubClient } from '../../integrations/github/client.js';
import { GitHubIssues } from '../../integrations/github/issues.js';
import { GitHubProjects } from '../../integrations/github/projects.js';
import { GitHubSyncService } from '../../integrations/github/sync.js';
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
 * GitHub Projectにspec追加
 */
export async function addSpecToProject(
  specId: string,
  projectId: string,
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

  // Project番号のバリデーション
  const projectNumber = parseInt(projectId, 10);
  if (isNaN(projectNumber) || projectNumber <= 0) {
    throw new Error(`Invalid project ID: ${projectId}. Must be a positive number.`);
  }

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

  console.log(formatHeading('Adding Spec to GitHub Project', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Spec ID', spec.id, options.color));
  console.log(formatKeyValue('Spec Name', spec.name, options.color));
  console.log(formatKeyValue('GitHub Issue', `#${spec.github_issue_id}`, options.color));
  console.log(formatKeyValue('Project Number', projectNumber, options.color));
  console.log('');

  // GitHub APIクライアント作成
  const client = new GitHubClient({ token: githubToken });
  const issues = new GitHubIssues(client);
  const projects = new GitHubProjects(client);
  const syncService = new GitHubSyncService(db, issues, projects);

  try {
    console.log(formatInfo('Adding to project...', options.color));
    const itemId = await syncService.addSpecToProject({
      specId: spec.id,
      owner: githubConfig.owner,
      projectNumber,
    });

    console.log('');
    console.log(formatSuccess('Spec added to project successfully!', options.color));
    console.log('');
    console.log(formatKeyValue('Project Item ID', itemId, options.color));
    console.log('');

    // 次のアクション
    console.log(formatHeading('Next Actions', 2, options.color));
    console.log('');
    console.log(
      `  • View project: https://github.com/${githubConfig.owner}/${githubConfig.repo}/projects/${projectNumber}`
    );
    console.log(`  • Sync spec: /takumi:github-sync to-github ${spec.id.substring(0, 8)}`);
    console.log('');
  } catch (error) {
    if (error instanceof Error) {
      // Projects v2 権限エラーの場合は、詳細なヘルプメッセージを表示
      if (error.message.includes('Resource not accessible by personal access token')) {
        throw new Error(
          `Failed to add spec to project: ${error.message}\n\n` +
            `個人アカウントの Projects v2 にアクセスするには、Classic Personal Access Token が必要です。\n` +
            `Fine-grained PAT は Organization の Projects のみ対応しています。\n\n` +
            `解決方法:\n` +
            `1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)\n` +
            `2. "Generate new token (classic)" をクリック\n` +
            `3. スコープで 'repo' と 'project' を選択\n` +
            `4. GITHUB_TOKEN 環境変数を更新\n\n` +
            `詳細: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens`
        );
      }
      throw new Error(`Failed to add spec to project: ${error.message}`);
    }
    throw error;
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const specId = process.argv[2];
  const projectId = process.argv[3];

  if (!specId || !projectId) {
    console.error('Error: spec-id and project-id are required');
    console.error('Usage: npx tsx project-add.ts <spec-id> <project-id>');
    process.exit(1);
  }

  addSpecToProject(specId, projectId).catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
