/**
 * Completed フェーズの仕様書に紐づくIssueを自動クローズ
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../.takumi/core/database/connection.js';

interface GitHubConfig {
  owner: string;
  repo: string;
}

function getGitHubConfig(takumiDir: string): GitHubConfig | null {
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

async function closeIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: 'closed',
        }),
      }
    );

    if (!response.ok) {
      console.error(`Failed to close issue #${issueNumber}: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error closing issue #${issueNumber}:`, error);
    return false;
  }
}

async function addComment(
  owner: string,
  repo: string,
  issueNumber: number,
  comment: string,
  token: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: comment }),
      }
    );

    if (!response.ok) {
      console.error(`Failed to add comment to issue #${issueNumber}: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error adding comment to issue #${issueNumber}:`, error);
    return false;
  }
}

async function main() {
  const cwd = process.cwd();
  const takumiDir = join(cwd, '.takumi');

  console.log('=== Close Completed Issues ===\n');

  // GitHub設定チェック
  const githubConfig = getGitHubConfig(takumiDir);
  if (!githubConfig) {
    console.error('Error: GitHub not configured');
    process.exit(1);
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error('Error: GITHUB_TOKEN not set');
    process.exit(1);
  }

  console.log(`Repository: ${githubConfig.owner}/${githubConfig.repo}\n`);

  // データベース接続
  const db = getDatabase();

  try {
    // completed フェーズの仕様書でGitHub Issue IDを持つものを取得
    const completedSpecs = await db
      .selectFrom('specs')
      .select(['id', 'name', 'github_issue_id'])
      .where('phase', '=', 'completed')
      .where('github_issue_id', 'is not', null)
      .execute();

    console.log(`Found ${completedSpecs.length} completed specs with GitHub Issues\n`);

    if (completedSpecs.length === 0) {
      console.log('No issues to close.\n');
      await db.destroy();
      return;
    }

    for (const spec of completedSpecs) {
      const issueNumber = spec.github_issue_id!;

      console.log(`Processing Issue #${issueNumber} (${spec.name})...`);

      // クローズコメント追加
      const closeComment = `## ✅ 実装完了

この仕様書の実装が完了しました。

**完了日時:** ${new Date().toLocaleString('ja-JP')}
**最終フェーズ:** completed
**仕様書:** [\`.takumi/specs/${spec.id}.md\`](../../.takumi/specs/${spec.id}.md)
`;

      const commentAdded = await addComment(
        githubConfig.owner,
        githubConfig.repo,
        issueNumber,
        closeComment,
        githubToken
      );

      if (commentAdded) {
        console.log(`  ✓ Comment added`);
      }

      // Issueクローズ
      const closed = await closeIssue(githubConfig.owner, githubConfig.repo, issueNumber, githubToken);

      if (closed) {
        console.log(`  ✓ Issue #${issueNumber} closed\n`);
      } else {
        console.log(`  ✗ Failed to close issue #${issueNumber}\n`);
      }

      // API Rate Limit対策: 少し待機
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('✓ All completed issues processed\n');

    await db.destroy();
  } catch (error) {
    console.error('Error:', error);
    await db.destroy();
    process.exit(1);
  }
}

main();
