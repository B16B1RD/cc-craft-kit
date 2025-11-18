import { getDatabase } from '../.cc-craft-kit/core/database/connection.js';

async function main() {
  const db = getDatabase();

  const latestSpec = await db
    .selectFrom('specs')
    .select(['id', 'name', 'github_issue_id'])
    .where('github_issue_id', 'is not', null)
    .orderBy('created_at', 'desc')
    .limit(1)
    .executeTakeFirst();

  if (!latestSpec) {
    console.log('No specs with GitHub Issues found');
    await db.destroy();
    return;
  }

  console.log('=== Latest Spec ===');
  console.log('ID:', latestSpec.id.substring(0, 8));
  console.log('Name:', latestSpec.name);
  console.log('GitHub Issue ID:', latestSpec.github_issue_id);
  console.log('');

  const syncRecord = await db
    .selectFrom('github_sync')
    .select(['entity_type', 'entity_id', 'github_id', 'sync_status'])
    .where('entity_id', '=', latestSpec.id)
    .executeTakeFirst();

  if (!syncRecord) {
    console.log('❌ NO github_sync record found for this spec');
    await db.destroy();
    return;
  }

  console.log('=== GitHub Sync Record ===');
  console.log('Entity Type:', syncRecord.entity_type);
  console.log('Entity ID:', syncRecord.entity_id.substring(0, 8));
  console.log('GitHub ID:', syncRecord.github_id);
  console.log('Sync Status:', syncRecord.sync_status);
  console.log('');

  if (syncRecord.entity_type === 'spec') {
    console.log('✅ SUCCESS: entity_type is correctly set to "spec"');
  } else {
    console.log(`❌ FAIL: entity_type is "${syncRecord.entity_type}" but expected "spec"`);
  }

  await db.destroy();
}

main();
