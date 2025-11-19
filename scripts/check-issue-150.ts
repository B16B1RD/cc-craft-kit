import { getDatabase } from '../.cc-craft-kit/core/database/connection.js';

(async () => {
  const db = getDatabase();

  console.log('=== Checking Issue #150 ===\n');

  // Issue #150に対応する仕様書を検索
  const specByIssue = await db
    .selectFrom('specs')
    .selectAll()
    .where('github_issue_id', '=', 150)
    .executeTakeFirst();

  if (specByIssue) {
    console.log('✅ Found by Issue ID:');
    console.log(`   Spec ID: ${specByIssue.id}`);
    console.log(`   Name: ${specByIssue.name}`);
    console.log(`   Phase: ${specByIssue.phase}`);
  } else {
    console.log('❌ Not found by Issue ID #150');
  }

  // "Test Spec for Error Level" という名前で検索
  const specByName = await db
    .selectFrom('specs')
    .selectAll()
    .where('name', 'like', '%Test Spec for Error Level%')
    .execute();

  console.log(`\n=== Specs matching "Test Spec for Error Level" ===`);
  console.log(`Found ${specByName.length} specs\n`);

  specByName.forEach((spec) => {
    console.log(`  Spec ID: ${spec.id}`);
    console.log(`  Name: ${spec.name}`);
    console.log(`  Phase: ${spec.phase}`);
    console.log(`  GitHub Issue: #${spec.github_issue_id || 'none'}`);
    console.log('');
  });

  // すべての仕様書を確認
  const allSpecs = await db.selectFrom('specs').selectAll().execute();
  console.log(`\n=== Total specs in database: ${allSpecs.length} ===`);
})();
