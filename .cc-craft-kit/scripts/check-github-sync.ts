#!/usr/bin/env npx tsx
/**
 * GitHub Issue 同期状態チェックスクリプト
 *
 * データベース上の仕様書と GitHub Issue の整合性をチェックし、
 * Issue が存在しない仕様書を検出する
 */

import { join } from 'node:path';
import { getDatabase } from '../../.cc-craft-kit/core/database/connection.js';

async function main() {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const dbPath = join(ccCraftKitDir, 'cc-craft-kit.db');
  const db = getDatabase({ databasePath: dbPath });

  console.log('# GitHub Issue 同期状態チェック\n');

  // requirements フェーズの仕様書を取得
  const requirementsSpecs = await db
    .selectFrom('specs')
    .where('phase', '=', 'requirements')
    .select(['id', 'name', 'github_issue_id', 'created_at'])
    .orderBy('created_at', 'desc')
    .execute();

  console.log(`## requirements フェーズ: ${requirementsSpecs.length} 件\n`);

  for (const spec of requirementsSpecs) {
    const shortId = spec.id.substring(0, 8);
    const issueStatus = spec.github_issue_id ? `#${spec.github_issue_id}` : '未作成';
    console.log(`- [${shortId}] ${spec.name}`);
    console.log(`  Issue: ${issueStatus}`);
    console.log(`  Created: ${spec.created_at}\n`);
  }

  // Issue 未作成の仕様書をカウント
  const missingIssues = requirementsSpecs.filter((s) => !s.github_issue_id);
  if (missingIssues.length > 0) {
    console.log(`\n⚠️  Issue 未作成: ${missingIssues.length} 件`);
    console.log('\n推奨アクション:');
    for (const spec of missingIssues) {
      const shortId = spec.id.substring(0, 8);
      console.log(`  /cft:github-issue-create ${shortId}`);
    }
  } else {
    console.log('\n✓ すべての仕様書に Issue が作成されています');
  }
}

main().catch(console.error);
