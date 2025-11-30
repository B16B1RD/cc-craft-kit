#!/usr/bin/env tsx
/**
 * 孤立データベースレコードのクリーンアップ
 *
 * ファイルが存在しないデータベースレコードを削除します。
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { getDatabase, closeDatabase } from '../core/database/connection.js';

async function main() {
  console.log('# Cleanup Orphaned Database Records\n');

  const db = getDatabase();
  const specsDir = join(process.cwd(), '.cc-craft-kit', 'specs');

  // すべての仕様書レコードを取得
  const specs = await db.selectFrom('specs').selectAll().execute();

  console.log(`Found ${specs.length} database records\n`);

  let deletedCount = 0;

  for (const spec of specs) {
    const filePath = join(specsDir, `${spec.id}.md`);

    if (!existsSync(filePath)) {
      console.log(`❌ File not found: ${spec.id} (${spec.name})`);
      console.log(`   Deleting orphaned record...`);

      await db.deleteFrom('specs').where('id', '=', spec.id).execute();

      console.log(`   ✓ Deleted\n`);
      deletedCount++;
    }
  }

  await closeDatabase();

  console.log(`\n📊 Summary:`);
  console.log(`   Deleted: ${deletedCount}`);
  console.log(`   Total: ${specs.length}`);

  if (deletedCount > 0) {
    console.log('\n✅ Orphaned records cleaned up!');
  } else {
    console.log('\n✅ No orphaned records found!');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
