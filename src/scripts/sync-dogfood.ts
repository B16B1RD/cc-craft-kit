#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';
import { checkSync } from './check-sync.js';

/**
 * 同期オプション
 */
export interface SyncOptions {
  dryRun?: boolean;
  verbose?: boolean;
  baseDir?: string;
}

/**
 * 同期結果
 */
export interface SyncResult {
  success: boolean;
  copiedFiles: number;
  deletedFiles: number;
  errors: Array<{ file: string; error: string }>;
}

/**
 * ファイルをコピー
 */
async function copyFile(
  srcPath: string,
  destPath: string,
  options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<void> {
  const { dryRun = false, verbose = false } = options;

  if (dryRun) {
    if (verbose) {
      console.log(`[DRY RUN] Would copy: ${srcPath} → ${destPath}`);
    }
    return;
  }

  // ディレクトリ作成
  const destDir = path.dirname(destPath);
  await fs.mkdir(destDir, { recursive: true });

  // ファイルコピー
  await fs.copyFile(srcPath, destPath);

  if (verbose) {
    console.log(`✓ Copied: ${srcPath} → ${destPath}`);
  }
}

/**
 * ファイルを削除
 */
async function deleteFile(
  filePath: string,
  options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<void> {
  const { dryRun = false, verbose = false } = options;

  if (dryRun) {
    if (verbose) {
      console.log(`[DRY RUN] Would delete: ${filePath}`);
    }
    return;
  }

  await fs.unlink(filePath);

  if (verbose) {
    console.log(`✓ Deleted: ${filePath}`);
  }
}

/**
 * src/ から .takumi/ へ同期
 */
export async function syncSourceToTakumi(options: SyncOptions = {}): Promise<SyncResult> {
  const { dryRun = false, verbose = false, baseDir = process.cwd() } = options;

  const result: SyncResult = {
    success: true,
    copiedFiles: 0,
    deletedFiles: 0,
    errors: [],
  };

  try {
    if (verbose) {
      console.log('🔄 Syncing src/ to .takumi/...\n');
    }

    // 整合性チェック実行
    const checkResult = await checkSync({ baseDir, verbose: false });

    if (checkResult.inSync) {
      if (verbose) {
        console.log('✅ Already in sync. Nothing to do.\n');
      }
      return result;
    }

    if (verbose) {
      console.log(`📋 Found ${checkResult.diffs.length} differences\n`);
    }

    // 差分を処理
    for (const diff of checkResult.diffs) {
      try {
        if (diff.status === 'modified' || diff.status === 'missing_in_takumi') {
          // src/ から .takumi/ へコピー
          const srcPath = path.join(baseDir, 'src', diff.path);
          const takumiPath = path.join(baseDir, '.takumi', diff.path);

          await copyFile(srcPath, takumiPath, { dryRun, verbose });
          result.copiedFiles++;
        } else if (diff.status === 'extra_in_takumi') {
          // .takumi/ から削除
          const takumiPath = path.join(baseDir, '.takumi', diff.path);

          await deleteFile(takumiPath, { dryRun, verbose });
          result.deletedFiles++;
        }
      } catch (error) {
        result.errors.push({
          file: diff.path,
          error: error instanceof Error ? error.message : String(error),
        });
        result.success = false;
      }
    }

    if (verbose) {
      console.log('\n📊 Sync Summary:');
      console.log(`   Copied: ${result.copiedFiles} files`);
      console.log(`   Deleted: ${result.deletedFiles} files`);
      console.log(`   Errors: ${result.errors.length}`);

      if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.forEach((err) => {
          console.log(`   - ${err.file}: ${err.error}`);
        });
      }
    }

    if (result.success && !dryRun) {
      console.log('\n✅ Sync completed successfully!\n');
    } else if (dryRun) {
      console.log('\n✅ Dry run completed. No files were modified.\n');
    }

    return result;
  } catch (error) {
    console.error('❌ Sync failed:', error);
    result.success = false;
    return result;
  }
}

/**
 * .claude/commands/ の同期
 */
export async function syncSlashCommands(options: SyncOptions = {}): Promise<SyncResult> {
  const { dryRun = false, verbose = false, baseDir = process.cwd() } = options;

  const result: SyncResult = {
    success: true,
    copiedFiles: 0,
    deletedFiles: 0,
    errors: [],
  };

  try {
    if (verbose) {
      console.log('🔄 Syncing .claude/commands/takumi/ to .takumi/slash-commands/...\n');
    }

    const sourceDir = path.join(baseDir, '.claude', 'commands', 'takumi');
    const destDir = path.join(baseDir, '.takumi', 'slash-commands');

    // ソースディレクトリが存在しない場合はスキップ
    try {
      await fs.access(sourceDir);
    } catch {
      if (verbose) {
        console.log('⚠️  .claude/commands/takumi/ does not exist, skipping...\n');
      }
      return result;
    }

    // ソースディレクトリのファイルを取得
    const files = await fs.readdir(sourceDir, { withFileTypes: true });

    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.md')) {
        const srcPath = path.join(sourceDir, file.name);
        const destPath = path.join(destDir, file.name);

        try {
          await copyFile(srcPath, destPath, { dryRun, verbose });
          result.copiedFiles++;
        } catch (error) {
          result.errors.push({
            file: file.name,
            error: error instanceof Error ? error.message : String(error),
          });
          result.success = false;
        }
      }
    }

    if (verbose) {
      console.log('\n📊 Slash Commands Sync Summary:');
      console.log(`   Copied: ${result.copiedFiles} files`);
      console.log(`   Errors: ${result.errors.length}\n`);
    }

    return result;
  } catch (error) {
    console.error('❌ Slash commands sync failed:', error);
    result.success = false;
    return result;
  }
}

/**
 * 完全同期実行
 */
export async function syncAll(options: SyncOptions = {}): Promise<boolean> {
  const { verbose = false } = options;

  if (verbose) {
    console.log('🚀 Starting full sync...\n');
  }

  // src/ → .takumi/ 同期
  const sourceResult = await syncSourceToTakumi(options);

  // .claude/commands/ 同期
  const commandsResult = await syncSlashCommands(options);

  const success = sourceResult.success && commandsResult.success;

  if (verbose) {
    console.log('🎉 Full sync completed!');
    console.log(`   Total files copied: ${sourceResult.copiedFiles + commandsResult.copiedFiles}`);
    console.log(`   Total files deleted: ${sourceResult.deletedFiles}`);
    console.log(`   Total errors: ${sourceResult.errors.length + commandsResult.errors.length}\n`);
  }

  return success;
}

// CLI実行時
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');
    const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

    const success = await syncAll({ dryRun, verbose });

    process.exit(success ? 0 : 1);
  })();
}
