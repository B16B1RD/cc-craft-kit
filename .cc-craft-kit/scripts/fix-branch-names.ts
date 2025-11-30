import { getDatabase } from '../core/database/connection.js';
import { execSync } from 'child_process';
import * as fs from 'fs';

async function fixBranchNames() {
  const db = getDatabase();

  // 現在のブランチを取得
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  console.log(`Current branch: ${currentBranch}`);

  // すべての仕様書を取得
  const specs = await db.selectFrom('specs').selectAll().execute();
  console.log(`Total specs: ${specs.length}`);

  let mainCount = 0;
  let developCount = 0;
  let currentCount = 0;

  for (const spec of specs) {
    const specPath = `.cc-craft-kit/specs/${spec.id}.md`;

    // ファイルが存在するか確認
    if (!fs.existsSync(specPath)) {
      console.log(`⚠️  File not found: ${spec.id} - ${spec.name}`);
      continue;
    }

    let branchName = currentBranch;

    try {
      // main ブランチに存在するか確認
      execSync(`git show main:${specPath}`, { stdio: 'ignore' });
      branchName = 'main';
      mainCount++;
    } catch {
      try {
        // develop ブランチに存在するか確認
        execSync(`git show develop:${specPath}`, { stdio: 'ignore' });
        branchName = 'develop';
        developCount++;
      } catch {
        // 現在のブランチのみ
        branchName = currentBranch;
        currentCount++;
      }
    }

    // 更新
    await db
      .updateTable('specs')
      .set({ branch_name: branchName })
      .where('id', '=', spec.id)
      .execute();

    const shortId = spec.id.substring(0, 8);
    console.log(`✓ ${shortId} - ${branchName}`);
  }

  console.log(`\n✅ Branch name assignment completed:`);
  console.log(`   main: ${mainCount}`);
  console.log(`   develop: ${developCount}`);
  console.log(`   ${currentBranch}: ${currentCount}`);

  await db.destroy();
}

fixBranchNames().catch(console.error);
