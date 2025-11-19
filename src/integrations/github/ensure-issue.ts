/**
 * GitHub Issue 自動リカバリー機能
 *
 * 仕様書に対応する GitHub Issue が存在するか確認し、
 * 存在しない場合は自動的に作成する
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Kysely } from 'kysely';
import { Database } from '../../core/database/schema.js';
import { GitHubClient } from './client.js';
import { GitHubIssues } from './issues.js';
import { GitHubProjects } from './projects.js';
import { GitHubSyncService } from './sync.js';
import { resolveProjectId } from './project-resolver.js';

/**
 * GitHub設定を取得
 */
function getGitHubConfig(): { owner: string; repo: string } | null {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const configPath = join(ccCraftKitDir, 'config.json');

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (!config.github || !config.github.owner || !config.github.repo) {
      return null;
    }

    return {
      owner: config.github.owner,
      repo: config.github.repo,
    };
  } catch {
    return null;
  }
}

/**
 * ensureGitHubIssue の戻り値
 */
export interface EnsureGitHubIssueResult {
  issueNumber: number | null;
  wasCreated: boolean;
}

/**
 * 仕様書に対応する GitHub Issue が存在するか確認し、
 * 存在しない場合は自動的に作成する
 *
 * @param db - Kysely データベースインスタンス
 * @param specId - 仕様書 ID
 * @returns Issue 番号と作成フラグ
 */
export async function ensureGitHubIssue(
  db: Kysely<Database>,
  specId: string
): Promise<EnsureGitHubIssueResult> {
  // 1. GitHub 設定チェック
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    // トークン未設定の場合は静かにスキップ
    return { issueNumber: null, wasCreated: false };
  }

  const githubConfig = getGitHubConfig();
  if (!githubConfig) {
    // GitHub 設定がない場合はスキップ
    return { issueNumber: null, wasCreated: false };
  }

  // 2. Issue 存在チェック（specs.github_issue_id を確認）
  const spec = await db
    .selectFrom('specs')
    .where('id', '=', specId)
    .select(['github_issue_id'])
    .executeTakeFirst();

  if (spec?.github_issue_id) {
    // データベースに Issue 番号が記録されている場合、GitHub API で実際に存在するか確認
    try {
      const client = new GitHubClient({ token: githubToken });
      const issues = new GitHubIssues(client);

      await issues.get(githubConfig.owner, githubConfig.repo, spec.github_issue_id);

      // Issue が存在する場合は何もしない
      return { issueNumber: spec.github_issue_id, wasCreated: false };
    } catch (error: unknown) {
      // 410 Gone または 404 Not Found の場合は Issue が削除されているため、再作成が必要
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('410') ||
        errorMessage.includes('404') ||
        errorMessage.includes('Not Found') ||
        errorMessage.includes('deleted')
      ) {
        console.warn(`⚠️  Issue #${spec.github_issue_id} not found on GitHub. Will recreate.`);

        // データベースから古い Issue 番号をクリア
        await db
          .updateTable('specs')
          .set({ github_issue_id: null })
          .where('id', '=', specId)
          .execute();
      } else {
        // その他のエラー（ネットワークエラー等）の場合は、Issue が存在すると仮定
        console.warn(`Warning: Failed to verify Issue #${spec.github_issue_id}:`, error);
        return { issueNumber: spec.github_issue_id, wasCreated: false };
      }
    }
  }

  // 3. Issue 自動作成
  console.log(`ℹ Auto-recovering GitHub Issue for spec ${specId}...`);

  try {
    // GitHub クライアント初期化
    const client = new GitHubClient({ token: githubToken });
    const issues = new GitHubIssues(client);
    const projects = new GitHubProjects(client);
    const syncService = new GitHubSyncService(db, issues, projects);

    // Issue 作成
    const issueNumber = await syncService.syncSpecToIssue({
      specId,
      owner: githubConfig.owner,
      repo: githubConfig.repo,
      createIfNotExists: true,
    });

    // 4. GitHub Project に追加
    try {
      const cwd = process.cwd();
      const ccCraftKitDir = join(cwd, '.cc-craft-kit');
      const projectNumber = await resolveProjectId(ccCraftKitDir, githubToken);

      if (projectNumber) {
        await syncService.addSpecToProject({
          specId,
          owner: githubConfig.owner,
          projectNumber,
        });

        console.log(`✓ Added to GitHub Project #${projectNumber}`);
      }
    } catch (projectError) {
      // Project 追加失敗は警告のみ（Issue 作成は成功）
      console.warn('Warning: Failed to add to GitHub Project:', projectError);
    }

    console.log(`✓ GitHub Issue created automatically: #${issueNumber}`);

    // 5. リカバリーログ記録
    await db
      .insertInto('logs')
      .values({
        spec_id: specId,
        task_id: null,
        action: 'auto_recover_github_issue',
        level: 'info',
        message: `Auto-recovered GitHub Issue #${issueNumber} for spec ${specId}`,
        metadata: JSON.stringify({ specId, issueNumber }),
        timestamp: new Date().toISOString(),
      })
      .execute();

    return { issueNumber, wasCreated: true };
  } catch (error) {
    // エラーログを記録し、手動作成を案内
    console.error(`✗ Failed to auto-create GitHub Issue for spec ${specId}:`, error);
    console.log(`  Manual creation: /cft:github-issue-create ${specId.substring(0, 8)}`);

    await db
      .insertInto('logs')
      .values({
        spec_id: specId,
        task_id: null,
        action: 'auto_recover_github_issue_failed',
        level: 'error',
        message: `Failed to auto-create GitHub Issue for spec ${specId}`,
        metadata: JSON.stringify({ specId, error: String(error) }),
        timestamp: new Date().toISOString(),
      })
      .execute();

    return { issueNumber: null, wasCreated: false };
  }
}
