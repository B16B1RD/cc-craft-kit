#!/usr/bin/env node
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { getDatabase, closeDatabase } from '../../src/core/database/connection.js';

interface GitHubIssue {
  number: number;
  title: string;
  id: string; // GitHub GraphQL node ID
  body: string | null;
  state: 'OPEN' | 'CLOSED';
}

/**
 * GitHub Issue の本文から仕様書IDを抽出
 */
function extractSpecIdFromBody(body: string | null): string | null {
  if (!body) return null;

  // "**仕様書 ID:** <uuid>" パターンを検索
  const match = body.match(/\*\*仕様書\s*ID:\*\*\s*([a-f0-9-]{36})/i);
  return match ? match[1] : null;
}

/**
 * GitHub Issue 一覧を取得（body を除外して軽量化）
 */
function fetchAllGitHubIssues(): Array<Omit<GitHubIssue, 'body'>> {
  try {
    const result = execSync(
      'gh issue list --repo B16B1RD/cc-craft-kit --limit 300 --state all --json number,title,id,state',
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 }
    );
    return JSON.parse(result);
  } catch (error) {
    console.error('❌ GitHub Issue の取得に失敗しました:', error);
    process.exit(1);
  }
}

/**
 * GitHub Issue の詳細を取得
 */
function fetchIssueDetails(issueNumber: number): string | null {
  try {
    const result = execSync(
      `gh issue view ${issueNumber} --repo B16B1RD/cc-craft-kit --json body --jq .body`,
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 }
    );
    return result.trim();
  } catch (error) {
    console.warn(`⚠️  Issue #${issueNumber} の詳細取得に失敗しました`);
    return null;
  }
}

/**
 * メイン処理
 */
async function main() {
  const db = getDatabase();

  try {
    console.log('📡 GitHub Issue を取得中...\n');
    const issues = fetchAllGitHubIssues();
    console.log(`✅ ${issues.length} 件の Issue を取得しました\n`);

    // データベースから全仕様書を取得
    const specs = await db.selectFrom('specs').selectAll().execute();
    console.log(`📋 データベースに ${specs.length} 件の仕様書が登録されています\n`);

    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const issue of issues) {
      // Issue の詳細（body）を取得
      const body = fetchIssueDetails(issue.number);
      const specId = extractSpecIdFromBody(body);

      if (!specId) {
        console.log(`⏭️  SKIP: Issue #${issue.number} - 仕様書IDが見つかりません`);
        skippedCount++;
        continue;
      }

      // 仕様書がデータベースに存在するか確認
      const spec = specs.find(s => s.id === specId);
      if (!spec) {
        console.log(`⚠️  WARN: Issue #${issue.number} の仕様書 ${specId.substring(0, 8)}... がデータベースに存在しません`);
        errorCount++;
        continue;
      }

      // 既存の同期レコードをチェック
      const existingSync = await db
        .selectFrom('github_sync')
        .selectAll()
        .where('entity_type', '=', 'spec')
        .where('entity_id', '=', specId)
        .executeTakeFirst();

      if (existingSync) {
        console.log(`⏭️  SKIP: ${spec.name} (${specId.substring(0, 8)}...) - 既存の同期レコード`);
        skippedCount++;
        continue;
      }

      // github_sync テーブルに登録
      await db
        .insertInto('github_sync')
        .values({
          id: randomUUID(),
          entity_type: 'spec',
          entity_id: specId,
          github_id: issue.id,
          github_number: issue.number,
          github_node_id: issue.id,
          sync_status: 'success',
          last_synced_at: new Date().toISOString(),
        })
        .execute();

      console.log(`✅ SYNC: ${spec.name} (${specId.substring(0, 8)}...) ↔ Issue #${issue.number}`);
      syncedCount++;
    }

    console.log(`\n📊 同期結果:`);
    console.log(`   ✅ 同期成功: ${syncedCount} 件`);
    console.log(`   ⏭️  スキップ: ${skippedCount} 件`);
    console.log(`   ⚠️  警告: ${errorCount} 件`);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

main();
