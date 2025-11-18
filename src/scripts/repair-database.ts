#!/usr/bin/env tsx
/**
 * データベース修復スクリプト
 *
 * ファイルシステム内の仕様書ファイルを読み込み、データベースに再登録します。
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { getDatabase } from '../core/database/connection.js';

interface SpecMetadata {
  id: string;
  name: string;
  phase: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
}

/**
 * 仕様書ファイルからメタデータを抽出
 */
function parseSpecFile(content: string): SpecMetadata | null {
  const lines = content.split('\n');

  // タイトル（1行目）
  const titleMatch = lines[0]?.match(/^# (.+)$/);
  if (!titleMatch) return null;
  const name = titleMatch[1];

  // メタデータ行を探す
  let id = '';
  let phase = '';
  let createdAt = '';
  let updatedAt = '';

  for (const line of lines) {
    const idMatch = line.match(/^\*\*仕様書 ID:\*\* (.+)$/);
    if (idMatch) id = idMatch[1];

    const phaseMatch = line.match(/^\*\*フェーズ:\*\* (.+)$/);
    if (phaseMatch) phase = phaseMatch[1];

    const createdMatch = line.match(/^\*\*作成日時:\*\* (.+)$/);
    if (createdMatch) createdAt = createdMatch[1];

    const updatedMatch = line.match(/^\*\*更新日時:\*\* (.+)$/);
    if (updatedMatch) updatedAt = updatedMatch[1];
  }

  if (!id || !phase || !createdAt || !updatedAt) {
    return null;
  }

  // 背景セクションから説明を抽出
  const backgroundIndex = lines.findIndex((line) => line.includes('### 背景'));
  let description = '';
  if (backgroundIndex !== -1) {
    // 背景の次の行から、次のセクションまでを取得
    for (let i = backgroundIndex + 2; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#') || line.startsWith('**')) break;
      if (line.trim()) {
        description = line.trim();
        break;
      }
    }
  }

  return {
    id,
    name,
    phase,
    createdAt,
    updatedAt,
    description: description || `${name}の仕様書`,
  };
}

/**
 * 日時文字列をISO形式に変換
 */
function parseDateTime(dateStr: string): string {
  // "2025/11/18 21:54:20" -> "2025-11-18T21:54:20Z"
  const match = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    console.warn(`Invalid date format: ${dateStr}, using current time`);
    return new Date().toISOString();
  }

  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

/**
 * メイン処理
 */
async function main() {
  console.log('# Database Repair Tool\n');

  const specsDir = join(process.cwd(), '.cc-craft-kit', 'specs');
  const db = await getDatabase();

  // 既存のデータベース内容を確認
  const existingSpecs = await db.selectFrom('specs').selectAll().execute();

  console.log(`📊 Current database state:`);
  console.log(`   Specs in database: ${existingSpecs.length}`);

  // ファイルシステムから仕様書ファイルを読み込み
  const files = await readdir(specsDir);
  const specFiles = files.filter((f) => f.endsWith('.md'));

  console.log(`   Specs in filesystem: ${specFiles.length}\n`);

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const file of specFiles) {
    const filePath = join(specsDir, file);

    try {
      const content = await readFile(filePath, 'utf-8');
      const metadata = parseSpecFile(content);

      if (!metadata) {
        console.log(`⚠️  [SKIP] ${file}: Failed to parse metadata`);
        skippedCount++;
        continue;
      }

      // データベースに既存レコードがあるかチェック
      const existing = existingSpecs.find((s) => s.id === metadata.id);

      if (existing) {
        // 既存レコードを更新
        await db
          .updateTable('specs')
          .set({
            name: metadata.name,
            phase: metadata.phase as
              | 'requirements'
              | 'design'
              | 'tasks'
              | 'implementation'
              | 'testing'
              | 'completed',
            updated_at: parseDateTime(metadata.updatedAt),
          })
          .where('id', '=', metadata.id)
          .execute();

        console.log(`✓  [UPDATE] ${metadata.name} (${metadata.id.substring(0, 8)}...)`);
        updatedCount++;
      } else {
        // 新規レコードを追加
        await db
          .insertInto('specs')
          .values({
            id: metadata.id,
            name: metadata.name,
            description: metadata.description,
            phase: metadata.phase as
              | 'requirements'
              | 'design'
              | 'tasks'
              | 'implementation'
              | 'testing'
              | 'completed',
            created_at: parseDateTime(metadata.createdAt),
            updated_at: parseDateTime(metadata.updatedAt),
          })
          .execute();

        console.log(`✓  [ADD] ${metadata.name} (${metadata.id.substring(0, 8)}...)`);
        addedCount++;
      }
    } catch (error) {
      console.error(`❌ [ERROR] ${file}:`, error instanceof Error ? error.message : String(error));
      errorCount++;
    }
  }

  console.log('\n📊 Repair Summary:');
  console.log(`   Added: ${addedCount}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total processed: ${specFiles.length}`);

  // 修復後の状態を確認
  const finalSpecs = await db.selectFrom('specs').selectAll().execute();

  console.log(`\n✅ Database repaired successfully!`);
  console.log(`   Final spec count: ${finalSpecs.length}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
