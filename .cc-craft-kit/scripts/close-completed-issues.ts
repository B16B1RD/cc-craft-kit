#!/usr/bin/env npx tsx

import { getDatabase } from '../core/database/connection.js';
import { execSync } from 'child_process';

/**
 * completed フェーズの仕様書に対応するGitHub Issueを一括クローズ
 */
async function closeCompletedIssues() {
  const db = getDatabase();

  console.log('🔍 Fetching completed specs from database...');

  // completed フェーズの仕様書を取得
  const completedSpecs = await db
    .selectFrom('specs')
    .selectAll()
    .where('phase', '=', 'completed')
    .where('github_issue_id', 'is not', null)
    .execute();

  console.log(`📄 Found ${completedSpecs.length} completed specs with GitHub Issues`);

  if (completedSpecs.length === 0) {
    console.log('✅ No issues to close');
    return;
  }

  let successCount = 0;
  let failureCount = 0;
  const errors: Array<{ issueId: number; error: string }> = [];

  for (const spec of completedSpecs) {
    const issueId = spec.github_issue_id;

    if (!issueId) {
      continue;
    }

    console.log(`\n📝 Processing: ${spec.name}`);
    console.log(`   Issue: #${issueId}`);

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
        `gh issue close ${issueId} --comment "仕様書の実装が完了したため、自動クローズします。\\n\\n- **仕様書ID**: ${spec.id}\\n- **フェーズ**: completed\\n- **完了日時**: ${spec.updated_at}"`,
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
closeCompletedIssues()
  .then(() => {
    console.log('\n✅ Completed issues close operation finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Operation failed:', error);
    process.exit(1);
  });
