import { getDatabase } from '../.cc-craft-kit/core/database/connection.js';

async function main() {
  const db = await getDatabase();

  // specs テーブルのGitHub連携データを確認
  const specs = await db
    .selectFrom('specs')
    .select([
      'id',
      'name',
      'phase',
      'github_issue_id',
      'github_project_id',
      'github_project_item_id',
      'updated_at',
    ])
    .orderBy('updated_at', 'desc')
    .limit(10)
    .execute();

  console.log('=== Specs Table (GitHub Integration) ===');
  console.table(
    specs.map((s) => ({
      id: s.id.substring(0, 8),
      name: s.name.substring(0, 30),
      phase: s.phase,
      issue_id: s.github_issue_id,
      project_id: s.github_project_id?.substring(0, 20),
      item_id: s.github_project_item_id?.substring(0, 20),
    }))
  );

  // github_sync テーブルの内容を確認
  const syncs = await db
    .selectFrom('github_sync')
    .select([
      'entity_type',
      'entity_id',
      'github_id',
      'github_number',
      'last_synced_at',
      'sync_status',
      'error_message',
    ])
    .orderBy('last_synced_at', 'desc')
    .limit(10)
    .execute();

  console.log('\n=== GitHub Sync Table ===');
  console.table(
    syncs.map((s) => ({
      type: s.entity_type,
      entity_id: s.entity_id.substring(0, 8),
      github_id: s.github_id,
      github_num: s.github_number,
      status: s.sync_status,
      synced_at: new Date(s.last_synced_at).toLocaleString(),
      error: s.error_message?.substring(0, 30),
    }))
  );

  // 不整合チェック: specsテーブルにgithub_issue_idがあるがgithub_syncに記録がない
  const specsWithIssues = await db
    .selectFrom('specs')
    .select(['id', 'name', 'github_issue_id'])
    .where('github_issue_id', 'is not', null)
    .execute();

  console.log('\n=== Inconsistency Check ===');
  for (const spec of specsWithIssues) {
    const syncRecord = await db
      .selectFrom('github_sync')
      .select(['sync_status'])
      .where('entity_type', '=', 'spec')
      .where('entity_id', '=', spec.id)
      .executeTakeFirst();

    if (!syncRecord) {
      console.log(
        `⚠️  Spec ${spec.id.substring(0, 8)} (${spec.name}) has github_issue_id=${spec.github_issue_id} but NO github_sync record`
      );
    }
  }

  await db.destroy();
}

main();
