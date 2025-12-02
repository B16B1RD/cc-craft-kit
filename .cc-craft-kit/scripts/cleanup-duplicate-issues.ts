#!/usr/bin/env npx tsx
/**
 * 不整合な GitHub Issue 番号をクリーンアップするスクリプト
 *
 * データベースに記録されているが、GitHub 上に存在しない Issue 番号を検出し、
 * データベースから削除して再作成できるようにする
 */

import { join } from 'node:path';
import { getDatabase } from '../../.cc-craft-kit/core/database/connection.js';
import { GitHubClient } from '../../.cc-craft-kit/integrations/github/client.js';
import { GitHubIssues } from '../../.cc-craft-kit/integrations/github/issues.js';
import { readFileSync, existsSync } from 'node:fs';

interface GitHubConfig {
  owner: string;
  repo: string;
}

/**
 * GitHub 設定を取得
 */
function getGitHubConfig(): GitHubConfig | null {
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

async function main() {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const dbPath = join(ccCraftKitDir, 'cc-craft-kit.db');
  const db = getDatabase({ databasePath: dbPath });

  console.log('# 不整合な GitHub Issue 番号のクリーンアップ\n');

  // GitHub 設定チェック
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error('✗ GITHUB_TOKEN が設定されていません');
    process.exit(1);
  }

  const githubConfig = getGitHubConfig();
  if (!githubConfig) {
    console.error('✗ GitHub 設定が見つかりません');
    process.exit(1);
  }

  console.log(`Repository: ${githubConfig.owner}/${githubConfig.repo}\n`);

  // GitHub クライアント初期化
  const client = new GitHubClient({ token: githubToken });
  const issues = new GitHubIssues(client);

  // github_issue_id が設定されているすべての仕様書を取得
  const specs = await db
    .selectFrom('specs')
    .where('github_issue_id', 'is not', null)
    .select(['id', 'name', 'phase', 'github_issue_id'])
    .execute();

  console.log(`## チェック対象: ${specs.length} 件\n`);

  let invalidCount = 0;
  const invalidSpecs: Array<{ id: string; name: string; issueNumber: number }> = [];

  for (const spec of specs) {
    if (!spec.github_issue_id) continue;

    const shortId = spec.id.substring(0, 8);
    process.stdout.write(`[${shortId}] Issue #${spec.github_issue_id} を確認中...`);

    try {
      // GitHub API で Issue の存在を確認
      await issues.get(githubConfig.owner, githubConfig.repo, spec.github_issue_id);
      console.log(' ✓');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 410 Gone または 404 Not Found の場合は削除済み
      if (
        errorMessage.includes('410') ||
        errorMessage.includes('404') ||
        errorMessage.includes('Not Found') ||
        errorMessage.includes('deleted')
      ) {
        console.log(' ✗ (存在しない)');
        invalidCount++;
        invalidSpecs.push({
          id: spec.id,
          name: spec.name,
          issueNumber: spec.github_issue_id,
        });
      } else {
        console.log(` ⚠️  (確認失敗: ${errorMessage})`);
      }
    }
  }

  console.log(`\n## 結果\n`);
  console.log(`有効な Issue: ${specs.length - invalidCount} 件`);
  console.log(`無効な Issue: ${invalidCount} 件\n`);

  if (invalidCount === 0) {
    console.log('✓ すべての Issue が有効です');
    return;
  }

  console.log('## 無効な Issue の詳細\n');
  for (const spec of invalidSpecs) {
    const shortId = spec.id.substring(0, 8);
    console.log(`- [${shortId}] ${spec.name}`);
    console.log(`  Issue #${spec.issueNumber} (削除済み)\n`);
  }

  // クリーンアップ実行
  console.log('## クリーンアップ実行\n');

  for (const spec of invalidSpecs) {
    const shortId = spec.id.substring(0, 8);
    console.log(`[${shortId}] Issue #${spec.issueNumber} をデータベースから削除...`);

    await db
      .updateTable('specs')
      .set({ github_issue_id: null })
      .where('id', '=', spec.id)
      .execute();

    console.log('  ✓ クリア完了\n');
  }

  console.log(`✓ ${invalidCount} 件の不整合な Issue 番号をクリアしました\n`);
  console.log('次回のコマンド実行時に、自動的に Issue が再作成されます。');
}

main().catch(console.error);
