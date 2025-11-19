import { getDatabase } from '../.cc-craft-kit/core/database/connection.js';

(async () => {
  const db = getDatabase();

  const issueNumbers = [115, 35, 111, 52, 137, 47, 48, 103, 130];

  console.log('=== Checking orphan issues ===\n');

  for (const issueNum of issueNumbers) {
    const spec = await db
      .selectFrom('specs')
      .selectAll()
      .where('github_issue_id', '=', issueNum)
      .executeTakeFirst();

    if (spec) {
      console.log(`Issue #${issueNum}: ✅ Found in DB`);
      console.log(`  ID: ${spec.id}`);
      console.log(`  Name: ${spec.name}`);
      console.log(`  Phase: ${spec.phase}`);
    } else {
      console.log(`Issue #${issueNum}: ❌ Not found in DB (orphan)`);
    }
  }
})();
