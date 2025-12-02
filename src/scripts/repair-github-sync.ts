#!/usr/bin/env tsx
/**
 * GitHub Issue 紐付け復旧スクリプト
 *
 * 古い仕様書と GitHub Issue の紐付けが欠落している問題を修復します。
 * 仕様書名と GitHub Issue タイトルを照合し、一致するものを github_sync テーブルに登録します。
 *
 * 使用方法:
 *   npx tsx src/scripts/repair-github-sync.ts [--dry-run]
 *
 * オプション:
 *   --dry-run  実際にはデータベースを更新せず、照合結果のみを表示
 */

import '../core/config/env.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase, closeDatabase } from '../core/database/connection.js';
import { GitHubClient } from '../integrations/github/client.js';
import { GitHubIssues, IssueResponse } from '../integrations/github/issues.js';

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
 * Issue タイトルから仕様書名を抽出
 * "[phase] Name" 形式や "[tag] Name" 形式からタイトル部分を取り出す
 */
function extractSpecNameFromIssueTitle(title: string): string {
  // "[completed] Phase 1 検証テスト" → "Phase 1 検証テスト"
  // "[phase:requirements] 仕様書名" → "仕様書名"
  const match = title.match(/^\[.*?\]\s*(.+)$/);
  return match ? match[1].trim() : title.trim();
}

/**
 * 全 GitHub Issue を取得（ページネーション対応）
 */
async function fetchAllIssues(
  issues: GitHubIssues,
  owner: string,
  repo: string
): Promise<IssueResponse[]> {
  const allIssues: IssueResponse[] = [];
  let page = 1;
  const perPage = 100; // 最大値

  console.log('📥 Fetching all GitHub Issues...');

  while (true) {
    const pageIssues = await issues.list(owner, repo, {
      state: 'all',
      per_page: perPage,
      page,
    });

    if (pageIssues.length === 0) {
      break;
    }

    allIssues.push(...pageIssues);
    console.log(`   Page ${page}: ${pageIssues.length} issues (total: ${allIssues.length})`);

    if (pageIssues.length < perPage) {
      break;
    }

    page++;
  }

  console.log(`✓ Fetched ${allIssues.length} issues total\n`);
  return allIssues;
}

/**
 * 照合結果
 */
interface MatchResult {
  specId: string;
  specName: string;
  issueNumber: number;
  issueTitle: string;
  issueNodeId: string;
  matchType: 'exact' | 'normalized';
}

/**
 * 仕様書名と Issue タイトルを照合
 */
function matchSpecsWithIssues(
  specs: Array<{ id: string; name: string }>,
  issues: IssueResponse[]
): {
  matched: MatchResult[];
  unmatched: Array<{ id: string; name: string }>;
  duplicates: Array<{ specId: string; specName: string; issues: IssueResponse[] }>;
} {
  const matched: MatchResult[] = [];
  const unmatched: Array<{ id: string; name: string }> = [];
  const duplicates: Array<{ specId: string; specName: string; issues: IssueResponse[] }> = [];

  // Issue タイトルから仕様書名へのマッピングを作成
  const issuesBySpecName = new Map<string, IssueResponse[]>();
  for (const issue of issues) {
    const normalizedTitle = extractSpecNameFromIssueTitle(issue.title);
    const existing = issuesBySpecName.get(normalizedTitle) || [];
    existing.push(issue);
    issuesBySpecName.set(normalizedTitle, existing);
  }

  for (const spec of specs) {
    const matchingIssues = issuesBySpecName.get(spec.name);

    if (!matchingIssues || matchingIssues.length === 0) {
      unmatched.push(spec);
    } else if (matchingIssues.length === 1) {
      // 一致するものが1つだけ → 確定
      const issue = matchingIssues[0];
      matched.push({
        specId: spec.id,
        specName: spec.name,
        issueNumber: issue.number,
        issueTitle: issue.title,
        issueNodeId: issue.node_id,
        matchType: 'exact',
      });
    } else {
      // 複数一致 → 最新の Issue（番号が大きい方）を優先
      duplicates.push({
        specId: spec.id,
        specName: spec.name,
        issues: matchingIssues,
      });

      // 最新の Issue を選択
      const latestIssue = matchingIssues.reduce((latest, issue) =>
        issue.number > latest.number ? issue : latest
      );
      matched.push({
        specId: spec.id,
        specName: spec.name,
        issueNumber: latestIssue.number,
        issueTitle: latestIssue.title,
        issueNodeId: latestIssue.node_id,
        matchType: 'normalized',
      });
    }
  }

  return { matched, unmatched, duplicates };
}

/**
 * メイン処理
 */
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');

  console.log('# GitHub Issue 紐付け復旧スクリプト\n');

  if (dryRun) {
    console.log('⚠️  DRY RUN モード: データベースは更新されません\n');
  }

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    console.error('❌ Error: .cc-craft-kit ディレクトリが見つかりません');
    console.error('   /cft:init を実行してプロジェクトを初期化してください');
    process.exit(1);
  }

  // GitHub 設定チェック
  const githubConfig = getGitHubConfig(ccCraftKitDir);
  if (!githubConfig) {
    console.error('❌ Error: GitHub 設定が見つかりません');
    console.error('   /cft:github-init を実行して GitHub 連携を設定してください');
    process.exit(1);
  }

  // GITHUB_TOKEN チェック
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error('❌ Error: GITHUB_TOKEN 環境変数が設定されていません');
    process.exit(1);
  }

  console.log(`📌 Repository: ${githubConfig.owner}/${githubConfig.repo}\n`);

  const db = getDatabase();

  try {
    // Step 1: 未同期の仕様書を取得
    console.log('📋 Step 1: 未同期の仕様書を検索...\n');

    const unsyncedSpecs = await db
      .selectFrom('specs')
      .leftJoin('github_sync', (join) =>
        join
          .onRef('github_sync.entity_id', '=', 'specs.id')
          .on('github_sync.entity_type', '=', 'spec')
      )
      .select(['specs.id', 'specs.name'])
      .where('github_sync.id', 'is', null)
      .execute();

    console.log(`   未同期の仕様書: ${unsyncedSpecs.length} 件\n`);

    if (unsyncedSpecs.length === 0) {
      console.log('✅ すべての仕様書が GitHub Issue と紐付け済みです');
      return;
    }

    // Step 2: GitHub Issue 一覧を取得
    console.log('📋 Step 2: GitHub Issue 一覧を取得...\n');

    const client = new GitHubClient({ token: githubToken });
    const issues = new GitHubIssues(client);
    const allIssues = await fetchAllIssues(issues, githubConfig.owner, githubConfig.repo);

    // Step 3: 仕様書名と Issue タイトルを照合
    console.log('📋 Step 3: 仕様書名と Issue タイトルを照合...\n');

    const { matched, unmatched, duplicates } = matchSpecsWithIssues(unsyncedSpecs, allIssues);

    console.log(`   照合結果:`);
    console.log(`   - 一致: ${matched.length} 件`);
    console.log(`   - 未一致: ${unmatched.length} 件`);
    console.log(`   - 複数候補: ${duplicates.length} 件\n`);

    // 複数候補があった場合は警告
    if (duplicates.length > 0) {
      console.log('⚠️  複数の Issue 候補が見つかった仕様書:');
      for (const dup of duplicates.slice(0, 5)) {
        console.log(`   - ${dup.specName}`);
        for (const issue of dup.issues) {
          console.log(`     #${issue.number}: ${issue.title}`);
        }
      }
      if (duplicates.length > 5) {
        console.log(`   ... 他 ${duplicates.length - 5} 件\n`);
      }
      console.log('   → 最新の Issue（番号が大きい方）を自動選択しました\n');
    }

    // Step 4: github_sync レコードを作成
    if (matched.length > 0) {
      console.log('📋 Step 4: github_sync レコードを作成...\n');

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      for (const match of matched) {
        if (dryRun) {
          console.log(`   [DRY RUN] ${match.specName.slice(0, 40)} → #${match.issueNumber}`);
          successCount++;
          continue;
        }

        try {
          // 既存レコードをチェック（念のため）
          const existing = await db
            .selectFrom('github_sync')
            .where('entity_type', '=', 'spec')
            .where('entity_id', '=', match.specId)
            .selectAll()
            .executeTakeFirst();

          if (existing) {
            console.log(`   [SKIP] ${match.specName.slice(0, 40)} (既に登録済み)`);
            skipCount++;
            continue;
          }

          // github_sync レコードを作成
          await db
            .insertInto('github_sync')
            .values({
              entity_type: 'spec',
              entity_id: match.specId,
              github_id: match.issueNumber.toString(),
              github_number: match.issueNumber,
              github_node_id: match.issueNodeId,
              last_synced_at: new Date().toISOString(),
              sync_status: 'success',
            })
            .execute();

          console.log(`   ✓ ${match.specName.slice(0, 40)} → #${match.issueNumber}`);
          successCount++;
        } catch (error) {
          console.error(
            `   ❌ ${match.specName.slice(0, 40)}: ${error instanceof Error ? error.message : String(error)}`
          );
          errorCount++;
        }
      }

      console.log(`\n📊 結果サマリー:`);
      console.log(`   成功: ${successCount} 件`);
      console.log(`   スキップ: ${skipCount} 件`);
      console.log(`   エラー: ${errorCount} 件`);
    }

    // Step 5: 未一致リストを表示
    if (unmatched.length > 0) {
      console.log('\n📋 Step 5: 未一致の仕様書一覧\n');
      console.log('以下の仕様書は GitHub Issue との照合ができませんでした:');
      for (const spec of unmatched.slice(0, 10)) {
        console.log(`   - ${spec.name} (${spec.id.slice(0, 8)}...)`);
      }
      if (unmatched.length > 10) {
        console.log(`   ... 他 ${unmatched.length - 10} 件`);
      }
      console.log('\nこれらの仕様書には手動で Issue を作成してください:');
      console.log('   /cft:github-issue-create <spec-id>');
    }

    // Step 6: 最終確認
    console.log('\n📋 Step 6: 最終確認...\n');

    const finalUnsyncedCount = await db
      .selectFrom('specs')
      .leftJoin('github_sync', (join) =>
        join
          .onRef('github_sync.entity_id', '=', 'specs.id')
          .on('github_sync.entity_type', '=', 'spec')
      )
      .select(db.fn.count('specs.id').as('count'))
      .where('github_sync.id', 'is', null)
      .executeTakeFirstOrThrow();

    const unsyncedAfter = Number(finalUnsyncedCount.count);

    console.log(`修復前: ${unsyncedSpecs.length} 件の未同期仕様書`);
    console.log(`修復後: ${unsyncedAfter} 件の未同期仕様書`);
    console.log(`削減数: ${unsyncedSpecs.length - unsyncedAfter} 件\n`);

    if (unsyncedAfter === 0) {
      console.log('✅ すべての仕様書が GitHub Issue と紐付けされました！');
    } else {
      console.log(`⚠️  ${unsyncedAfter} 件の仕様書がまだ未同期です`);
      console.log('   手動で Issue を作成するか、Issue タイトルを仕様書名と一致させてください');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
