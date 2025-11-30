#!/usr/bin/env node
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { getDatabase, closeDatabase } from '../../src/core/database/connection.js';

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
function extractSpecMetadata(content: string, filename: string): SpecMetadata | null {
  const lines = content.split('\n');

  const id = filename.replace('.md', '');
  let name = '';
  let phase = 'requirements';
  let createdAt = new Date().toISOString();
  let updatedAt = new Date().toISOString();
  let description = '';

  // タイトル（# で始まる行）を取得
  for (const line of lines) {
    if (line.startsWith('# ')) {
      name = line.substring(2).trim();
      break;
    }
  }

  // メタデータを抽出
  for (const line of lines) {
    if (line.startsWith('**仕様書 ID:**')) {
      // ID は既にファイル名から取得済み
      continue;
    }
    if (line.startsWith('**フェーズ:**')) {
      phase = line.replace('**フェーズ:**', '').trim();
    }
    if (line.startsWith('**作成日時:**')) {
      const dateStr = line.replace('**作成日時:**', '').trim();
      createdAt = parseDateString(dateStr);
    }
    if (line.startsWith('**更新日時:**')) {
      const dateStr = line.replace('**更新日時:**', '').trim();
      updatedAt = parseDateString(dateStr);
    }
  }

  // 説明（## 1. 背景と目的セクション）を抽出
  const backgroundIndex = lines.findIndex(line => line.startsWith('## 1. 背景と目的'));
  if (backgroundIndex !== -1) {
    const purposeIndex = lines.findIndex((line, idx) => idx > backgroundIndex && line.startsWith('### 目的'));
    if (purposeIndex !== -1) {
      const nextSectionIndex = lines.findIndex((line, idx) => idx > purposeIndex && line.startsWith('##'));
      const descriptionLines = lines.slice(purposeIndex + 1, nextSectionIndex !== -1 ? nextSectionIndex : undefined);
      description = descriptionLines
        .filter(line => line.trim() !== '' && !line.startsWith('---'))
        .join('\n')
        .trim();
    }
  }

  if (!name) {
    console.error(`⚠️  ファイル ${filename} からタイトルを抽出できませんでした`);
    return null;
  }

  return {
    id,
    name,
    phase,
    createdAt,
    updatedAt,
    description: description || null,
  };
}

/**
 * 日付文字列をISO 8601形式に変換
 */
function parseDateString(dateStr: string): string {
  // "2025/11/20 11:08:42" 形式を想定
  const match = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    ).toISOString();
  }
  return new Date().toISOString();
}

/**
 * メイン処理
 */
async function main() {
  const specsDir = join(process.cwd(), '.cc-craft-kit/specs');
  const db = getDatabase();

  try {
    // 仕様書ファイル一覧を取得
    const files = await readdir(specsDir);
    const mdFiles = files.filter(file => file.endsWith('.md'));

    console.log(`📂 ${mdFiles.length} 件の仕様書ファイルを検出しました\n`);

    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const file of mdFiles) {
      const filePath = join(specsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const metadata = extractSpecMetadata(content, file);

      if (!metadata) {
        errorCount++;
        continue;
      }

      // データベースに既存のレコードがあるかチェック
      const existing = await db
        .selectFrom('specs')
        .select('id')
        .where('id', '=', metadata.id)
        .executeTakeFirst();

      if (existing) {
        console.log(`⏭️  SKIP: ${metadata.name} (${metadata.id.substring(0, 8)}...) - 既存レコード`);
        skippedCount++;
        continue;
      }

      // データベースにインサート
      await db
        .insertInto('specs')
        .values({
          id: metadata.id,
          name: metadata.name,
          description: metadata.description || null,
          phase: metadata.phase,
          created_at: metadata.createdAt,
          updated_at: metadata.updatedAt,
        })
        .execute();

      console.log(`✅ IMPORT: ${metadata.name} (${metadata.id.substring(0, 8)}...) - ${metadata.phase}`);
      importedCount++;
    }

    console.log(`\n📊 インポート結果:`);
    console.log(`   ✅ インポート成功: ${importedCount} 件`);
    console.log(`   ⏭️  スキップ: ${skippedCount} 件`);
    console.log(`   ❌ エラー: ${errorCount} 件`);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

main();
