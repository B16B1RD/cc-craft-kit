#!/usr/bin/env npx tsx

import { execSync } from 'child_process';

/**
 * データベースに存在しない古いGitHub Issueを一括クローズ
 */
async function closeOrphanIssues() {
  // データベースに存在しない古いIssue番号
  const orphanIssues = [115, 35, 52, 47, 48, 103, 130];

  console.log(`🔍 Closing ${orphanIssues.length} orphan issues...`);

  let successCount = 0;
  let failureCount = 0;
  const errors: Array<{ issueId: number; error: string }> = [];

  for (const issueId of orphanIssues) {
    console.log(`\n📝 Processing Issue #${issueId}`);

    try {
      // GitHub Issue の現在の状態を確認
      const issueState = execSync(
        `gh issue view ${issueId} --json state --jq '.state'`,
        { encoding: 'utf-8' }
      ).trim();

      if (issueState === 'CLOSED') {
        console.log(`   ⏭️  Already closed`);
        successCount++;
        continue;
      }

      // Issueをクローズ
      execSync(
        `gh issue close ${issueId} --comment "この Issue はデータベースに存在しない古い Issue のため、自動クローズします。\\n\\n**理由**: 対応する仕様書がデータベースから削除されています。"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );

      console.log(`   ✅ Closed successfully`);
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Failed to close: ${errorMessage}`);
      errors.push({ issueId, error: errorMessage });
      failureCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successfully closed: ${successCount}`);
  console.log(`❌ Failed to close: ${failureCount}`);
  console.log('='.repeat(60));

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(({ issueId, error }) => {
      console.log(`   Issue #${issueId}: ${error}`);
    });
  }
}

// スクリプト実行
closeOrphanIssues()
  .then(() => {
    console.log('\n✅ Orphan issues close operation finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Operation failed:', error);
    process.exit(1);
  });
