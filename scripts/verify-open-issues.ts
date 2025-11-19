import { getDatabase } from '../.cc-craft-kit/core/database/connection.js';
import { execSync } from 'child_process';

(async () => {
  const db = getDatabase();

  console.log('=== Verifying OPEN Issues ===\n');

  // OPEN状態のGitHub Issueを取得
  const openIssuesJson = execSync('gh issue list --state open --limit 50 --json number,title,labels,state', {
    encoding: 'utf-8',
  });

  const openIssues = JSON.parse(openIssuesJson);

  console.log(`Found ${openIssues.length} OPEN issues\n`);

  for (const issue of openIssues) {
    const issueId = issue.number;
    const issueTitle = issue.title;
    const issueState = issue.state;
    const labels = issue.labels || [];

    // phase:xxx ラベルを抽出
    const phaseLabel = labels.find((l: { name: string }) => l.name.startsWith('phase:'));
    const issuePhase = phaseLabel ? phaseLabel.name.replace('phase:', '') : null;

    // データベースから対応する仕様書を検索
    const spec = await db
      .selectFrom('specs')
      .selectAll()
      .where('github_issue_id', '=', issueId)
      .executeTakeFirst();

    console.log(`Issue #${issueId}: ${issueTitle}`);
    console.log(`  State: ${issueState}`);
    console.log(`  Phase Label: ${issuePhase || '(none)'}`);

    if (spec) {
      console.log(`  ✅ Found in DB`);
      console.log(`     Spec ID: ${spec.id}`);
      console.log(`     Spec Phase: ${spec.phase}`);

      if (spec.phase !== issuePhase) {
        console.log(`     ⚠️  MISMATCH: DB phase (${spec.phase}) != Issue label (${issuePhase})`);
      }

      if (spec.phase === 'completed' && issueState === 'OPEN') {
        console.log(`     ⚠️  MISMATCH: Spec is completed but Issue is OPEN`);
      }
    } else {
      console.log(`  ❌ Not found in DB (orphan issue)`);
    }

    console.log('');
  }
})();
