import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from '../.cc-craft-kit/core/database/types.js';

(async () => {
  const backupPath = '/home/autum/Projects/personal/cc-craft-kit/.cc-craft-kit/backups/cc-craft-kit-2025-11-19T05-20-23-105Z.db';

  const db = new Kysely<DatabaseType>({
    dialect: new SqliteDialect({
      database: new Database(backupPath),
    }),
  });

  console.log('=== Backup Database Specs ===');
  const specs = await db.selectFrom('specs').selectAll().execute();
  console.log(`Total specs: ${specs.length}`);
  specs.forEach(spec => {
    console.log(`- ${spec.id}: ${spec.name} (${spec.phase}) - GitHub Issue #${spec.github_issue_id}`);
  });

  console.log('\n=== GitHub Sync Records ===');
  const syncRecords = await db.selectFrom('github_sync').selectAll().orderBy('synced_at', 'desc').limit(10).execute();
  console.log(`Total sync records: ${syncRecords.length}`);
  syncRecords.forEach(record => {
    console.log(`- ${record.entity_type} ${record.entity_id}: ${record.action} at ${record.synced_at}`);
  });

  await db.destroy();
})();
