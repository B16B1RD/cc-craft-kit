#!/usr/bin/env node
import { getDatabase } from '../core/database/connection.js';

async function deleteSpec(specId: string) {
  const db = await getDatabase();

  try {
    // 仕様書を削除
    const result = await db
      .deleteFrom('specs')
      .where('id', '=', specId)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      console.error(`Spec with ID '${specId}' not found`);
      process.exit(1);
    }

    console.log(`✓ Deleted spec: ${specId}`);

    // 関連するGitHub同期レコードも削除
    const syncResult = await db
      .deleteFrom('github_sync')
      .where('entity_id', '=', specId)
      .executeTakeFirst();

    if (syncResult.numDeletedRows > 0n) {
      console.log(`✓ Deleted ${syncResult.numDeletedRows} GitHub sync record(s)`);
    }

    // 関連するタスクも削除
    const taskResult = await db
      .deleteFrom('tasks')
      .where('spec_id', '=', specId)
      .executeTakeFirst();

    if (taskResult.numDeletedRows > 0n) {
      console.log(`✓ Deleted ${taskResult.numDeletedRows} task(s)`);
    }

    // 仕様書ファイルも削除
    const fs = await import('fs/promises');
    const path = await import('path');
    const specFile = path.join(process.cwd(), 'specs', `${specId}.md`);

    try {
      await fs.unlink(specFile);
      console.log(`✓ Deleted spec file: ${specFile}`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.warn(`⚠ Failed to delete spec file: ${err.message}`);
      }
    }

    console.log('\n✓ Spec deleted successfully');
  } finally {
    await db.destroy();
  }
}

const specId = process.argv[2];
if (!specId) {
  console.error('Usage: npx tsx delete-spec.ts <spec-id>');
  process.exit(1);
}

deleteSpec(specId);
