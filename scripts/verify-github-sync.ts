/**
 * GitHub IssuesとデータベースSpecsの同期状態を検証
 *
 * このスクリプトは以下をチェックします:
 * 1. GitHub Issue の state (open/closed) と Specs の phase (completed) の整合性
 * 2. GitHub Issue の title と Specs の name の整合性
 * 3. GitHub Issue のラベルと Specs の phase の整合性
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

async function fetchGitHubIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string
): Promise<{
  number: number;
  title: string;
  state: 'open' | 'closed';
  labels: string[];
} | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch issue #${issueNumber}: ${response.status}`);
      return null;
    }

    const issue = await response.json();
    return {
      number: issue.number,
      title: issue.title,
      state: issue.state,
      labels: issue.labels.map((l: { name: string }) => l.name),
    };
  } catch (error) {
    console.error(`Error fetching issue #${issueNumber}:`, error);
    return null;
  }
}

async function main() {
  const cwd = process.cwd();
  const takumiDir = join(cwd, '.takumi');

  console.log('=== GitHub Sync Verification ===\n');

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
    // GitHub Issue IDを持つすべての仕様書を取得
    const specs = await db
      .selectFrom('specs')
      .select(['id', 'name', 'phase', 'github_issue_id'])
      .where('github_issue_id', 'is not', null)
      .orderBy('github_issue_id', 'asc')
      .execute();

    console.log(`Found ${specs.length} specs with GitHub Issues\n`);

    const issues: Array<{
      specId: string;
      specName: string;
      specPhase: string;
      issueNumber: number;
      issueTitle: string;
      issueState: string;
      issueLabels: string[];
      syncStatus: 'OK' | 'NAME_MISMATCH' | 'STATE_MISMATCH' | 'LABEL_MISMATCH' | 'FETCH_FAILED';
      details: string[];
    }> = [];

    // 各仕様書のGitHub Issueを取得して比較
    for (const spec of specs) {
      const issue = await fetchGitHubIssue(
        githubConfig.owner,
        githubConfig.repo,
        spec.github_issue_id!,
        githubToken
      );

      if (!issue) {
        issues.push({
          specId: spec.id.substring(0, 8),
          specName: spec.name,
          specPhase: spec.phase,
          issueNumber: spec.github_issue_id!,
          issueTitle: 'N/A',
          issueState: 'N/A',
          issueLabels: [],
          syncStatus: 'FETCH_FAILED',
          details: ['Failed to fetch issue from GitHub'],
        });
        continue;
      }

      const details: string[] = [];
      let syncStatus: 'OK' | 'NAME_MISMATCH' | 'STATE_MISMATCH' | 'LABEL_MISMATCH' = 'OK';

      // 1. State と Phase の整合性チェック
      const expectedState = spec.phase === 'completed' ? 'closed' : 'open';
      if (issue.state !== expectedState) {
        syncStatus = 'STATE_MISMATCH';
        details.push(
          `State mismatch: Issue is ${issue.state} but spec phase is ${spec.phase} (expected ${expectedState})`
        );
      }

      // 2. Title の整合性チェック（フェーズプレフィックスを除く）
      const titleWithoutPrefix = issue.title.replace(/^\[.*?\]\s*/, '');
      if (titleWithoutPrefix !== spec.name) {
        if (syncStatus === 'OK') syncStatus = 'NAME_MISMATCH';
        details.push(`Title mismatch: "${titleWithoutPrefix}" vs "${spec.name}"`);
      }

      // 3. Label の整合性チェック
      const expectedLabel = `phase:${spec.phase}`;
      const hasCorrectLabel = issue.labels.includes(expectedLabel);
      if (!hasCorrectLabel) {
        if (syncStatus === 'OK') syncStatus = 'LABEL_MISMATCH';
        details.push(`Label mismatch: Expected "${expectedLabel}", got [${issue.labels.join(', ')}]`);
      }

      issues.push({
        specId: spec.id.substring(0, 8),
        specName: spec.name,
        specPhase: spec.phase,
        issueNumber: issue.number,
        issueTitle: issue.title,
        issueState: issue.state,
        issueLabels: issue.labels,
        syncStatus,
        details,
      });

      // API Rate Limit対策: 少し待機
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 結果表示
    console.log('=== Sync Status Summary ===\n');

    const okCount = issues.filter((i) => i.syncStatus === 'OK').length;
    const mismatchCount = issues.filter((i) => i.syncStatus !== 'OK').length;

    console.log(`✅ OK: ${okCount}`);
    console.log(`⚠️  Mismatch: ${mismatchCount}\n`);

    if (mismatchCount > 0) {
      console.log('=== Issues with Sync Problems ===\n');

      for (const issue of issues.filter((i) => i.syncStatus !== 'OK')) {
        console.log(`Issue #${issue.issueNumber} (Spec ${issue.specId})`);
        console.log(`  Spec: ${issue.specName} [${issue.specPhase}]`);
        console.log(`  GitHub: ${issue.issueTitle} [${issue.issueState}]`);
        console.log(`  Status: ${issue.syncStatus}`);
        for (const detail of issue.details) {
          console.log(`    - ${detail}`);
        }
        console.log('');
      }

      console.log('=== Recommended Actions ===\n');
      console.log('For each issue with STATE_MISMATCH:');
      console.log('  - If spec phase is "completed", run: /takumi:github-sync to-github <spec-id>');
      console.log('  - Or manually close the issue on GitHub\n');

      console.log('For each issue with LABEL_MISMATCH:');
      console.log('  - Run: /takumi:github-sync to-github <spec-id>');
      console.log('  - This will update the label to match the current phase\n');

      console.log('For each issue with NAME_MISMATCH:');
      console.log('  - Run: /takumi:github-sync to-github <spec-id>');
      console.log('  - This will update the title to match the spec name\n');
    } else {
      console.log('✅ All issues are in sync!\n');
    }

    await db.destroy();
  } catch (error) {
    console.error('Error:', error);
    await db.destroy();
    process.exit(1);
  }
}

main();
