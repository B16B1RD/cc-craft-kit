#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';

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
 * ディレクトリを再帰的にコピー
 */
async function copyDirectory(
  srcDir: string,
  destDir: string,
  options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<number> {
  const { dryRun = false, verbose = false } = options;
  let copiedCount = 0;

  // ソースディレクトリが存在しない場合はスキップ
  try {
    await fs.access(srcDir);
  } catch {
    return copiedCount;
  }

  // ディレクトリ内のファイルを取得
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      // サブディレクトリを再帰的にコピー
      copiedCount += await copyDirectory(srcPath, destPath, options);
    } else if (entry.isFile()) {
      // ファイルをコピー
      await copyFile(srcPath, destPath, { dryRun, verbose });
      copiedCount++;
    }
  }

  return copiedCount;
}

/**
 * ディレクトリ内の不要なファイルを削除
 */
async function cleanDirectory(
  dir: string,
  options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<number> {
  const { dryRun = false, verbose = false } = options;
  let deletedCount = 0;

  // ディレクトリが存在しない場合はスキップ
  try {
    await fs.access(dir);
  } catch {
    return deletedCount;
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // サブディレクトリを再帰的にクリーン
      deletedCount += await cleanDirectory(filePath, options);
    } else if (entry.isFile()) {
      // .js および .d.ts ファイルを削除
      if (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts')) {
        if (dryRun) {
          if (verbose) {
            console.log(`[DRY RUN] Would delete: ${filePath}`);
          }
        } else {
          await fs.unlink(filePath);
          if (verbose) {
            console.log(`✓ Deleted: ${filePath}`);
          }
        }
        deletedCount++;
      }
    }
  }

  return deletedCount;
}

/**
 * src/ から .cc-craft-kit/ へ同期
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
      console.log('🔄 Syncing src/ to .cc-craft-kit/...\n');
    }

    // src/ から .cc-craft-kit/ へコピーするディレクトリ
    const directories = ['commands', 'core', 'integrations', 'plugins', 'scripts'];

    // 古い .js と .d.ts ファイルを削除
    if (verbose) {
      console.log('🧹 Cleaning old JavaScript files...\n');
    }
    for (const dir of directories) {
      const destDir = path.join(baseDir, '.cc-craft-kit', dir);
      try {
        const deleted = await cleanDirectory(destDir, { dryRun, verbose });
        result.deletedFiles += deleted;
      } catch (error) {
        // クリーンエラーは警告のみ
        if (verbose) {
          console.warn(`⚠️  Failed to clean ${dir}:`, error);
        }
      }
    }

    // TypeScript ファイルをコピー
    for (const dir of directories) {
      const srcDir = path.join(baseDir, 'src', dir);
      const destDir = path.join(baseDir, '.cc-craft-kit', dir);

      try {
        const copied = await copyDirectory(srcDir, destDir, { dryRun, verbose });
        result.copiedFiles += copied;
      } catch (error) {
        result.errors.push({
          file: dir,
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
      console.log('🔄 Syncing src/slash-commands/ to .cc-craft-kit/slash-commands/...\n');
    }

    const sourceDir = path.join(baseDir, 'src', 'slash-commands');
    const destDir = path.join(baseDir, '.cc-craft-kit', 'slash-commands');

    // ソースディレクトリが存在しない場合はスキップ
    try {
      await fs.access(sourceDir);
    } catch {
      if (verbose) {
        console.log('⚠️  src/slash-commands/ does not exist, skipping...\n');
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

  // dist/ → .cc-craft-kit/ 同期
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
