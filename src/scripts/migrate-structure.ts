#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * マイグレーション設定
 */
export interface MigrationConfig {
  dryRun: boolean;
  verbose: boolean;
  skipImportFix: boolean;
  baseDir: string;
}

/**
 * マイグレーション結果
 */
export interface MigrationResult {
  success: boolean;
  movedFiles: string[];
  createdSymlinks: string[];
  errors: Array<{ file: string; error: string }>;
  warnings: string[];
}

/**
 * 事前チェック: 移動先ディレクトリが既に存在するか確認
 */
export async function preflightCheck(config: MigrationConfig): Promise<{
  canProceed: boolean;
  conflicts: string[];
}> {
  const { baseDir, verbose } = config;
  const conflicts: string[] = [];

  if (verbose) {
    console.log('🔍 Running preflight check...\n');
  }

  // チェック対象のディレクトリ
  const checks = [
    { path: path.join(baseDir, 'src', 'commands'), label: 'src/commands/' },
    { path: path.join(baseDir, 'src', 'slash-commands'), label: 'src/slash-commands/' },
  ];

  for (const check of checks) {
    try {
      await fs.access(check.path);
      conflicts.push(check.label);
      if (verbose) {
        console.log(`⚠️  ${check.label} already exists`);
      }
    } catch {
      // ディレクトリが存在しない = OK
      if (verbose) {
        console.log(`✓ ${check.label} does not exist (OK)`);
      }
    }
  }

  const canProceed = conflicts.length === 0;

  if (verbose) {
    console.log(
      `\n${canProceed ? '✅' : '❌'} Preflight check ${canProceed ? 'passed' : 'failed'}\n`
    );
  }

  return { canProceed, conflicts };
}

/**
 * ディレクトリ配下の全ファイルを再帰的に取得
 */
async function getAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        const subFiles = await getAllFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  } catch {
    // ディレクトリが存在しない場合は空配列を返す
  }

  return files;
}

/**
 * ファイルを移動
 */
async function moveFile(
  sourcePath: string,
  destPath: string,
  options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<void> {
  const { dryRun = false, verbose = false } = options;

  if (dryRun) {
    if (verbose) {
      console.log(`[DRY RUN] Would move: ${sourcePath} → ${destPath}`);
    }
    return;
  }

  // ディレクトリ作成
  const destDir = path.dirname(destPath);
  await fs.mkdir(destDir, { recursive: true });

  // ファイル移動
  await fs.rename(sourcePath, destPath);

  if (verbose) {
    console.log(`✓ Moved: ${sourcePath} → ${destPath}`);
  }
}

/**
 * シンボリックリンクを作成
 */
async function createSymlink(
  targetPath: string,
  linkPath: string,
  options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<void> {
  const { dryRun = false, verbose = false } = options;

  if (dryRun) {
    if (verbose) {
      console.log(`[DRY RUN] Would create symlink: ${linkPath} → ${targetPath}`);
    }
    return;
  }

  // 既存のファイル/ディレクトリを削除
  try {
    const stats = await fs.lstat(linkPath);
    if (stats.isSymbolicLink()) {
      await fs.unlink(linkPath);
    } else if (stats.isDirectory()) {
      await fs.rm(linkPath, { recursive: true });
    } else {
      await fs.unlink(linkPath);
    }
  } catch {
    // ファイルが存在しない場合は無視
  }

  // 親ディレクトリを作成
  await fs.mkdir(path.dirname(linkPath), { recursive: true });

  // シンボリックリンク作成
  await fs.symlink(targetPath, linkPath, 'dir');

  if (verbose) {
    console.log(`✓ Created symlink: ${linkPath} → ${targetPath}`);
  }
}

/**
 * .takumi/commands/ → src/commands/ へ移動
 */
async function migrateCommands(config: MigrationConfig): Promise<{
  movedFiles: string[];
  errors: Array<{ file: string; error: string }>;
}> {
  const { baseDir, dryRun, verbose } = config;
  const movedFiles: string[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  const sourceDir = path.join(baseDir, '.takumi', 'commands');
  const destDir = path.join(baseDir, 'src', 'commands');

  if (verbose) {
    console.log('📦 Migrating .takumi/commands/ → src/commands/...\n');
  }

  // ソースディレクトリが存在するか確認
  try {
    await fs.access(sourceDir);
  } catch {
    if (verbose) {
      console.log('⚠️  .takumi/commands/ does not exist, skipping...\n');
    }
    return { movedFiles, errors };
  }

  // 全ファイルを取得
  const files = await getAllFiles(sourceDir, sourceDir);

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);

    try {
      await moveFile(sourcePath, destPath, { dryRun, verbose });
      movedFiles.push(file);
    } catch (error) {
      errors.push({
        file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (verbose) {
    console.log(`\n✓ Migrated ${movedFiles.length} files from .takumi/commands/\n`);
  }

  return { movedFiles, errors };
}

/**
 * .claude/commands/takumi/ → src/slash-commands/ へ移動
 */
async function migrateSlashCommands(config: MigrationConfig): Promise<{
  movedFiles: string[];
  errors: Array<{ file: string; error: string }>;
}> {
  const { baseDir, dryRun, verbose } = config;
  const movedFiles: string[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  const sourceDir = path.join(baseDir, '.claude', 'commands', 'takumi');
  const destDir = path.join(baseDir, 'src', 'slash-commands');

  if (verbose) {
    console.log('📦 Migrating .claude/commands/takumi/ → src/slash-commands/...\n');
  }

  // ソースディレクトリが存在するか確認
  try {
    await fs.access(sourceDir);
  } catch {
    if (verbose) {
      console.log('⚠️  .claude/commands/takumi/ does not exist, skipping...\n');
    }
    return { movedFiles, errors };
  }

  // 全ファイルを取得
  const files = await getAllFiles(sourceDir, sourceDir);

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);

    try {
      await moveFile(sourcePath, destPath, { dryRun, verbose });
      movedFiles.push(file);
    } catch (error) {
      errors.push({
        file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (verbose) {
    console.log(`\n✓ Migrated ${movedFiles.length} files from .claude/commands/takumi/\n`);
  }

  return { movedFiles, errors };
}

/**
 * シンボリックリンク作成: .claude/commands/takumi/ → src/slash-commands/
 */
async function createSlashCommandsSymlink(config: MigrationConfig): Promise<{
  created: boolean;
  error?: string;
}> {
  const { baseDir, dryRun, verbose } = config;

  if (verbose) {
    console.log('🔗 Creating symlink: .claude/commands/takumi/ → src/slash-commands/...\n');
  }

  const targetPath = path.join('..', '..', '..', 'src', 'slash-commands');
  const linkPath = path.join(baseDir, '.claude', 'commands', 'takumi');

  try {
    await createSymlink(targetPath, linkPath, { dryRun, verbose });
    return { created: true };
  } catch (error) {
    return {
      created: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * マイグレーション実行
 */
export async function migrate(config: MigrationConfig): Promise<MigrationResult> {
  const { verbose, dryRun } = config;

  const result: MigrationResult = {
    success: true,
    movedFiles: [],
    createdSymlinks: [],
    errors: [],
    warnings: [],
  };

  try {
    if (verbose) {
      console.log('🚀 Starting structure migration...\n');
      if (dryRun) {
        console.log('⚠️  DRY RUN MODE - No actual changes will be made\n');
      }
    }

    // 事前チェック
    const precheck = await preflightCheck(config);
    if (!precheck.canProceed) {
      result.success = false;
      result.errors.push({
        file: 'preflight',
        error: `Conflicts detected: ${precheck.conflicts.join(', ')}`,
      });
      return result;
    }

    // .takumi/commands/ → src/commands/
    const commandsResult = await migrateCommands(config);
    result.movedFiles.push(...commandsResult.movedFiles);
    result.errors.push(...commandsResult.errors);

    // .claude/commands/takumi/ → src/slash-commands/
    const slashCommandsResult = await migrateSlashCommands(config);
    result.movedFiles.push(...slashCommandsResult.movedFiles);
    result.errors.push(...slashCommandsResult.errors);

    // シンボリックリンク作成
    const symlinkResult = await createSlashCommandsSymlink(config);
    if (symlinkResult.created) {
      result.createdSymlinks.push('.claude/commands/takumi → src/slash-commands');
    } else if (symlinkResult.error) {
      result.errors.push({ file: 'symlink', error: symlinkResult.error });
    }

    // エラーがあれば失敗とする
    if (result.errors.length > 0) {
      result.success = false;
    }

    if (verbose) {
      console.log('\n📊 Migration Summary:');
      console.log(`   Moved files: ${result.movedFiles.length}`);
      console.log(`   Created symlinks: ${result.createdSymlinks.length}`);
      console.log(`   Errors: ${result.errors.length}`);
      console.log(`   Warnings: ${result.warnings.length}`);

      if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.forEach((err) => {
          console.log(`   - ${err.file}: ${err.error}`);
        });
      }

      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach((warning) => {
          console.log(`   - ${warning}`);
        });
      }
    }

    if (result.success && !dryRun) {
      console.log('\n✅ Migration completed successfully!\n');
    } else if (dryRun) {
      console.log('\n✅ Dry run completed. No files were modified.\n');
    }

    return result;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    result.success = false;
    result.errors.push({
      file: 'migration',
      error: error instanceof Error ? error.message : String(error),
    });
    return result;
  }
}

// CLI実行時
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');
    const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
    const skipImportFix = process.argv.includes('--skip-import-fix');

    const config: MigrationConfig = {
      dryRun,
      verbose: verbose || dryRun, // dry-runの場合は自動的にverbose
      skipImportFix,
      baseDir: process.cwd(),
    };

    const result = await migrate(config);

    process.exit(result.success ? 0 : 1);
  })();
}
