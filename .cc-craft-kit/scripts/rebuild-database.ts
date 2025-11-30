#!/usr/bin/env npx tsx

import fs from 'fs/promises';
import path from 'path';
import { getDatabase } from '../core/database/connection.js';
import type { SpecPhase } from '../core/database/types.js';

/**
 * 仕様書ファイルからメタデータを抽出
 */
async function parseSpecFile(filePath: string) {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  // タイトル（1行目）
  const title = lines[0].replace(/^#\s*/, '').trim();

  // メタデータ抽出
  const idMatch = content.match(/\*\*仕様書 ID:\*\*\s*(.+)/);
  const phaseMatch = content.match(/\*\*フェーズ:\*\*\s*(.+)/);
  const createdMatch = content.match(/\*\*作成日時:\*\*\s*(.+)/);
  const updatedMatch = content.match(/\*\*更新日時:\*\*\s*(.+)/);

  if (!idMatch || !phaseMatch) {
    return null;
  }

  const id = idMatch[1].trim();
  const phase = phaseMatch[1].trim() as SpecPhase;
  const createdAt = createdMatch?.[1].trim();
  const updatedAt = updatedMatch?.[1].trim();

  return {
    id,
    name: title,
    phase,
    createdAt: createdAt ? new Date(createdAt.replace(/\//g, '-')) : new Date(),
    updatedAt: updatedAt ? new Date(updatedAt.replace(/\//g, '-')) : new Date(),
  };
}

/**
 * GitHub IssueからGitHub Issue番号を取得
 */
async function getGitHubIssueNumber(specName: string): Promise<number | null> {
  try {
    const { execSync } = await import('child_process');
    const result = execSync(
      `gh issue list --state all --limit 200 --json number,title --jq '.[] | select(.title | contains("${specName}")) | .number'`,
      { encoding: 'utf-8' }
    );
    const numbers = result
      .trim()
      .split('\n')
      .filter((n) => n)
      .map((n) => parseInt(n, 10));
    return numbers.length > 0 ? numbers[0] : null;
  } catch (error) {
    console.error(`Failed to get GitHub Issue for "${specName}":`, error);
    return null;
  }
}

/**
 * データベースを仕様書ファイルから再構築
 */
async function rebuildDatabase() {
  const specsDir = path.join(process.cwd(), '.cc-craft-kit', 'specs');
  const db = getDatabase();

  console.log('🔍 Scanning spec files...');
  const files = await fs.readdir(specsDir);
  const specFiles = files.filter((f) => f.endsWith('.md'));

  console.log(`📄 Found ${specFiles.length} spec files`);

  // 既存のspecsをすべて削除
  console.log('🗑️  Clearing existing specs from database...');
  await db.deleteFrom('specs').execute();

  let successCount = 0;
  let failureCount = 0;

  for (const file of specFiles) {
    const filePath = path.join(specsDir, file);
    const spec = await parseSpecFile(filePath);

    if (!spec) {
      console.log(`⚠️  Skipped: ${file} (invalid format)`);
      failureCount++;
      continue;
    }

    console.log(`\n📝 Processing: ${spec.name}`);
    console.log(`   ID: ${spec.id}`);
    console.log(`   Phase: ${spec.phase}`);

    // GitHub Issue番号を取得
    const githubIssueId = await getGitHubIssueNumber(spec.name);
    if (githubIssueId) {
      console.log(`   GitHub Issue: #${githubIssueId}`);
    } else {
      console.log(`   GitHub Issue: Not found`);
    }

    try {
      // データベースに挿入
      await db
        .insertInto('specs')
        .values({
          id: spec.id,
          name: spec.name,
          description: null,
          phase: spec.phase,
          github_issue_id: githubIssueId,
          github_project_id: null,
          github_milestone_id: null,
          github_project_item_id: null,
          created_at: spec.createdAt.toISOString(),
          updated_at: spec.updatedAt.toISOString(),
        })
        .execute();

      console.log(`   ✅ Inserted into database`);
      successCount++;
    } catch (error) {
      console.error(`   ❌ Failed to insert:`, error);
      failureCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Successfully inserted: ${successCount}`);
  console.log(`❌ Failed to insert: ${failureCount}`);
  console.log('='.repeat(50));

  // 結果確認
  const totalSpecs = await db
    .selectFrom('specs')
    .select(({ fn }) => [fn.count<number>('id').as('count')])
    .executeTakeFirst();

  console.log(`\n📊 Total specs in database: ${totalSpecs?.count || 0}`);

  // フェーズ別の集計
  const specsByPhase = await db
    .selectFrom('specs')
    .select(['phase', ({ fn }) => fn.count<number>('id').as('count')])
    .groupBy('phase')
    .execute();

  console.log('\n📈 Specs by phase:');
  specsByPhase.forEach((row) => {
    console.log(`   ${row.phase}: ${row.count}`);
  });
}

// スクリプト実行
rebuildDatabase()
  .then(() => {
    console.log('\n✅ Database rebuild completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Database rebuild failed:', error);
    process.exit(1);
  });
