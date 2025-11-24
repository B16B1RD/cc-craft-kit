/**
 * GitHub プルリクエスト統合機能
 *
 * 注意: PR 自動作成処理は、プロンプトベース実装（spec-phase.md）に移行されました。
 * このファイルには、PR URL を GitHub Issue に記録する機能のみが残されています。
 */

import { Kysely } from 'kysely';
import { Database } from '../../core/database/schema.js';
import { getGitHubClient } from './client.js';
import { execSync } from 'node:child_process';
import { getGitHubConfig } from '../../core/config/github-config.js';

/**
 * 現在のリポジトリ名を取得
 */
function getCurrentRepository(): { owner: string; repo: string } | null {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    // SSH形式: git@github.com:owner/repo.git
    // HTTPS形式: https://github.com/owner/repo.git
    const sshMatch = remoteUrl.match(/git@github\.com:(.+?)\/(.+?)\.git$/);
    const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/(.+?)\/(.+?)\.git$/);

    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    } else if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * PR URLをGitHub Issueに記録
 */
export async function recordPullRequestToIssue(
  db: Kysely<Database>,
  specId: string,
  pullRequestUrl: string
): Promise<void> {
  try {
    // GitHub同期レコードを取得
    const syncRecord = await db
      .selectFrom('github_sync')
      .where('entity_id', '=', specId)
      .where('entity_type', '=', 'spec')
      .selectAll()
      .executeTakeFirst();

    if (!syncRecord || !syncRecord.issue_number) {
      // Issueが存在しない場合はスキップ
      return;
    }

    // リポジトリ情報取得
    const config = getGitHubConfig();
    const repository = getCurrentRepository();
    const owner = config.owner || repository?.owner;
    const repo = config.repo || repository?.repo;

    if (!owner || !repo) {
      return;
    }

    // GitHub クライアント取得
    const client = getGitHubClient();

    // IssueにPR URLをコメント
    await client.rest.issues.createComment({
      owner,
      repo,
      issue_number: syncRecord.issue_number,
      body: `プルリクエストが作成されました: ${pullRequestUrl}`,
    });
  } catch (error) {
    // エラーが発生してもPR作成は成功させる
    console.warn('Failed to record PR URL to issue:', error);
  }
}
