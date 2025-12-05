#!/usr/bin/env node

/**
 * .md ファイルから specs.json への一括移行スクリプト
 *
 * このスクリプトは、.cc-craft-kit/specs/ 内の全 .md ファイルを
 * specs.json に同期します。SyncService.importFromDirectory() を使用します。
 *
 * 使用方法:
 *   npx tsx src/scripts/migrate-specs-from-files.ts [--verbose]
 */

import { join } from 'path';
import { readdir } from 'fs/promises';
import { SyncService } from '../core/sync/sync-service.js';
import { loadSpecs } from '../core/storage/specs-storage.js';

interface MigrateOptions {
  verbose?: boolean;
  baseDir?: string;
}

/**
 * 移行前後の状態を比較するためのカウント取得
 */
async function getFileCount(specsDir: string): Promise<number> {
  try {
    const files = await readdir(specsDir);
    return files.filter((f) => f.endsWith('.md')).length;
  } catch {
    return 0;
  }
}

/**
 * .md ファイルから specs.json への一括移行
 */
export async function migrateSpecsFromFiles(options: MigrateOptions = {}): Promise<{
  success: boolean;
  fileCount: number;
  jsonCountBefore: number;
  jsonCountAfter: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
}> {
  const { verbose = false, baseDir = process.cwd() } = options;

  const specsDir = join(baseDir, '.cc-craft-kit', 'specs');

  if (verbose) {
    console.log('🔄 .md ファイルから specs.json への移行を開始...\n');
  }

  // 移行前の状態
  const fileCount = await getFileCount(specsDir);
  const jsonCountBefore = loadSpecs(baseDir).length;

  if (verbose) {
    console.log('📊 移行前の状態:');
    console.log(`   .md ファイル数: ${fileCount}`);
    console.log(`   specs.json 件数: ${jsonCountBefore}\n`);
  }

  // SyncService を使用して移行
  const syncService = new SyncService();

  if (verbose) {
    console.log('📥 .md ファイルをインポート中...\n');
  }

  const result = await syncService.importFromDirectory(specsDir);

  // 移行後の状態
  const jsonCountAfter = loadSpecs(baseDir).length;

  if (verbose) {
    console.log('\n📊 移行結果:');
    console.log(`   インポート成功: ${result.imported}`);
    console.log(`   スキップ（既存）: ${result.skipped}`);
    console.log(`   失敗: ${result.failed}`);
    console.log(`\n📊 移行後の状態:`);
    console.log(
      `   specs.json 件数: ${jsonCountAfter} (${jsonCountAfter - jsonCountBefore >= 0 ? '+' : ''}${jsonCountAfter - jsonCountBefore})`
    );

    if (result.errors.length > 0) {
      console.log('\n❌ エラー一覧:');
      for (const err of result.errors) {
        console.log(`   - ${err.file}: ${err.error}`);
      }
    }

    if (result.failed === 0) {
      console.log('\n✅ 移行が完了しました！');
    } else {
      console.log('\n⚠️  一部のファイルで移行に失敗しました。');
    }
  }

  return {
    success: result.failed === 0,
    fileCount,
    jsonCountBefore,
    jsonCountAfter,
    imported: result.imported,
    skipped: result.skipped,
    failed: result.failed,
    errors: result.errors,
  };
}

// CLI 実行時
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

    const result = await migrateSpecsFromFiles({ verbose });

    // JSON 形式で結果を出力（スクリプトからの呼び出し用）
    if (!verbose) {
      console.log(JSON.stringify(result, null, 2));
    }

    process.exit(result.success ? 0 : 1);
  })();
}
