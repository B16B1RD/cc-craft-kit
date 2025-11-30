#!/usr/bin/env npx tsx

import { getDatabase } from '../core/database/connection.js';
import { execSync } from 'child_process';

/**
 * データベースの仕様書とGitHub Issueのステータス整合性をチェック
 */
async function checkStatusMismatch() {
  const db = getDatabase();

  console.log('🔍 Checking status consistency between database and GitHub Issues...\n');

  // GitHub Issue IDを持つすべての仕様書を取得
  const specs = await db
    .selectFrom('specs')
    .selectAll()
    .where('github_issue_id', 'is not', null)
    .execute();

  console.log(`📄 Found ${specs.length} specs with GitHub Issues\n`);

  const mismatches: Array<{
    specId: string;
    specName: string;
    specPhase: string;
    issueId: number;
    issuePhaseLabel: string | null;
    issueState: string;
  }> = [];

  for (const spec of specs) {
    const issueId = spec.github_issue_id;

    if (!issueId) {
      continue;
    }

    try {
      // GitHub Issue の情報を取得
      const issueJson = execSync(
        `gh issue view ${issueId} --json state,labels`,
        { encoding: 'utf-8' }
      );

      const issue = JSON.parse(issueJson);
      const issueState = issue.state;
      const labels = issue.labels || [];

      // phase:xxx ラベルを抽出
      const phaseLabel = labels.find((l: { name: string }) =>
        l.name.startsWith('phase:')
      );
      const issuePhase = phaseLabel ? phaseLabel.name.replace('phase:', '') : null;

      // ステータスの不一致をチェック
      const phaseMismatch = issuePhase !== spec.phase;
      const stateMismatch =
        (spec.phase === 'completed' && issueState === 'OPEN') ||
        (spec.phase !== 'completed' && issueState === 'CLOSED');

      if (phaseMismatch || stateMismatch) {
        console.log(`❌ Mismatch detected:`);
        console.log(`   Spec: ${spec.name.substring(0, 60)}...`);
        console.log(`   Issue #${issueId}`);
        console.log(`   Database Phase: ${spec.phase}`);
        console.log(`   Issue Phase Label: ${issuePhase || '(none)'}`);
        console.log(`   Issue State: ${issueState}`);
        console.log('');

        mismatches.push({
          specId: spec.id,
          specName: spec.name,
          specPhase: spec.phase,
          issueId,
          issuePhaseLabel: issuePhase,
          issueState,
        });
      }
    } catch (error) {
      console.error(`⚠️  Failed to check Issue #${issueId}:`, error);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Total specs checked: ${specs.length}`);
  console.log(`Mismatches found: ${mismatches.length}`);
  console.log('='.repeat(70));

  if (mismatches.length > 0) {
    console.log('\n📋 Mismatch Summary:');
    mismatches.forEach((m) => {
      console.log(
        `  #${m.issueId}: ${m.specPhase} (DB) vs ${m.issuePhaseLabel || 'none'} (Issue) - ${m.issueState}`
      );
    });

    // 修正用のデータをJSONで出力
    const fs = await import('fs/promises');
    const outputPath = '.cc-craft-kit/scripts/mismatches.json';
    await fs.writeFile(outputPath, JSON.stringify(mismatches, null, 2));
    console.log(`\n💾 Mismatch data saved to: ${outputPath}`);
  } else {
    console.log('\n✅ All statuses are consistent!');
  }
}

// スクリプト実行
checkStatusMismatch()
  .then(() => {
    console.log('\n✅ Status consistency check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
