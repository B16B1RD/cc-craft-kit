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
export async function syncSourceToCcCraftKit(options: SyncOptions = {}): Promise<SyncResult> {
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
    const directories = ['commands', 'core', 'hooks', 'integrations', 'plugins', 'scripts'];

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
 * スラッシュコマンドの同期（src/slash-commands/ → .claude/commands/cft/）
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
      console.log('🔄 Syncing src/slash-commands/ to .claude/commands/cft/...\n');
    }

    const sourceDir = path.join(baseDir, 'src', 'slash-commands');
    const destDir = path.join(baseDir, '.claude', 'commands', 'cft');

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
 * スキルの同期（src/skills/ → .claude/skills/）
 */
export async function syncSkills(options: SyncOptions = {}): Promise<SyncResult> {
  const { dryRun = false, verbose = false, baseDir = process.cwd() } = options;

  const result: SyncResult = {
    success: true,
    copiedFiles: 0,
    deletedFiles: 0,
    errors: [],
  };

  try {
    if (verbose) {
      console.log('🔄 Syncing src/skills/ to .claude/skills/...\n');
    }

    const sourceDir = path.join(baseDir, 'src', 'skills');
    const destDir = path.join(baseDir, '.claude', 'skills');

    // ソースディレクトリが存在しない場合はスキップ
    try {
      await fs.access(sourceDir);
    } catch {
      if (verbose) {
        console.log('⚠️  src/skills/ does not exist, skipping...\n');
      }
      return result;
    }

    // ディレクトリを再帰的にコピー
    const copied = await copyDirectory(sourceDir, destDir, { dryRun, verbose });
    result.copiedFiles = copied;

    if (verbose) {
      console.log('\n📊 Skills Sync Summary:');
      console.log(`   Copied: ${result.copiedFiles} files`);
      console.log(`   Errors: ${result.errors.length}\n`);
    }

    return result;
  } catch (error) {
    console.error('❌ Skills sync failed:', error);
    result.success = false;
    return result;
  }
}

/**
 * エージェントの同期（src/agents/ → .claude/agents/）
 */
export async function syncAgents(options: SyncOptions = {}): Promise<SyncResult> {
  const { dryRun = false, verbose = false, baseDir = process.cwd() } = options;

  const result: SyncResult = {
    success: true,
    copiedFiles: 0,
    deletedFiles: 0,
    errors: [],
  };

  try {
    if (verbose) {
      console.log('🔄 Syncing src/agents/ to .claude/agents/...\n');
    }

    const sourceDir = path.join(baseDir, 'src', 'agents');
    const destDir = path.join(baseDir, '.claude', 'agents');

    // ソースディレクトリが存在しない場合はスキップ
    try {
      await fs.access(sourceDir);
    } catch {
      if (verbose) {
        console.log('⚠️  src/agents/ does not exist, skipping...\n');
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
      console.log('\n📊 Agents Sync Summary:');
      console.log(`   Copied: ${result.copiedFiles} files`);
      console.log(`   Errors: ${result.errors.length}\n`);
    }

    return result;
  } catch (error) {
    console.error('❌ Agents sync failed:', error);
    result.success = false;
    return result;
  }
}

/**
 * 開発用スクリプトを削除（.cc-craft-kit/scripts/ から不要なファイルを削除）
 */
export async function cleanDevScripts(options: SyncOptions = {}): Promise<SyncResult> {
  const { dryRun = false, verbose = false, baseDir = process.cwd() } = options;

  const result: SyncResult = {
    success: true,
    copiedFiles: 0,
    deletedFiles: 0,
    errors: [],
  };

  // 削除対象のパターン
  const deletePatterns = [
    /^add-.*\.ts$/,
    /^check-.*\.ts$/,
    /^cleanup-.*\.ts$/,
    /^close-.*\.ts$/,
    /^delete-.*\.ts$/,
    /^fix-.*\.ts$/,
    /^import-.*\.ts$/,
    /^migrate-.*\.ts$/,
    /^monitor-.*\.ts$/,
    /^rebuild-.*\.ts$/,
    /^repair-.*\.ts$/,
    /^run-.*\.ts$/,
    /^sync-github-.*\.ts$/,
    /^test-.*\.ts$/,
    /^update-.*\.ts$/,
  ];

  try {
    if (verbose) {
      console.log('🧹 Cleaning development scripts from .cc-craft-kit/scripts/...\n');
    }

    const scriptsDir = path.join(baseDir, '.cc-craft-kit', 'scripts');

    // ディレクトリが存在しない場合はスキップ
    try {
      await fs.access(scriptsDir);
    } catch {
      if (verbose) {
        console.log('⚠️  .cc-craft-kit/scripts/ does not exist, skipping...\n');
      }
      return result;
    }

    const files = await fs.readdir(scriptsDir, { withFileTypes: true });

    for (const file of files) {
      if (file.isFile()) {
        const shouldDelete = deletePatterns.some((pattern) => pattern.test(file.name));

        if (shouldDelete) {
          const filePath = path.join(scriptsDir, file.name);

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
          result.deletedFiles++;
        }
      }
    }

    if (verbose) {
      console.log('\n📊 Dev Scripts Cleanup Summary:');
      console.log(`   Deleted: ${result.deletedFiles} files\n`);
    }

    return result;
  } catch (error) {
    console.error('❌ Dev scripts cleanup failed:', error);
    result.success = false;
    return result;
  }
}

/**
 * 不要ファイルを削除（.cc-craft-kit/ 直下のゴミファイル）
 */
export async function cleanUnusedFiles(options: SyncOptions = {}): Promise<SyncResult> {
  const { dryRun = false, verbose = false, baseDir = process.cwd() } = options;

  const result: SyncResult = {
    success: true,
    copiedFiles: 0,
    deletedFiles: 0,
    errors: [],
  };

  // 削除対象ファイルリスト（固定）
  const unusedFiles = ['cc-craft-kit-new.db', 'cc-craft-kit-recovered.db', 'test-archive.tar.gz'];

  try {
    if (verbose) {
      console.log('🧹 Cleaning unused files from .cc-craft-kit/...\n');
    }

    const ccCraftKitDir = path.join(baseDir, '.cc-craft-kit');

    for (const fileName of unusedFiles) {
      const filePath = path.join(ccCraftKitDir, fileName);

      // ファイルが存在するか確認
      try {
        await fs.access(filePath);
      } catch {
        // ファイルが存在しない場合はスキップ
        continue;
      }

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
      result.deletedFiles++;
    }

    if (verbose) {
      console.log('\n📊 Unused Files Cleanup Summary:');
      console.log(`   Deleted: ${result.deletedFiles} files\n`);
    }

    return result;
  } catch (error) {
    console.error('❌ Unused files cleanup failed:', error);
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

  // src/ → .cc-craft-kit/ 同期（TypeScript ファイル）
  const sourceResult = await syncSourceToCcCraftKit(options);

  // src/slash-commands/ → .claude/commands/cft/ 同期
  const commandsResult = await syncSlashCommands(options);

  // src/skills/ → .claude/skills/ 同期
  const skillsResult = await syncSkills(options);

  // src/agents/ → .claude/agents/ 同期
  const agentsResult = await syncAgents(options);

  // 開発用スクリプト削除
  const cleanupResult = await cleanDevScripts(options);

  const success =
    sourceResult.success &&
    commandsResult.success &&
    skillsResult.success &&
    agentsResult.success &&
    cleanupResult.success;

  const totalCopied =
    sourceResult.copiedFiles +
    commandsResult.copiedFiles +
    skillsResult.copiedFiles +
    agentsResult.copiedFiles;

  const totalDeleted = sourceResult.deletedFiles + cleanupResult.deletedFiles;

  const totalErrors =
    sourceResult.errors.length +
    commandsResult.errors.length +
    skillsResult.errors.length +
    agentsResult.errors.length;

  if (verbose) {
    console.log('🎉 Full sync completed!');
    console.log(`   Total files copied: ${totalCopied}`);
    console.log(`   Total files deleted: ${totalDeleted}`);
    console.log(`   Total errors: ${totalErrors}\n`);
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
