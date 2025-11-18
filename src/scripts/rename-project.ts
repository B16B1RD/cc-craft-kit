#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * プロジェクト名称変更スクリプト
 *
 * Takumi → cc-craft-kit への名称変更を一括実行
 */

export interface RenameConfig {
  dryRun: boolean;
  verbose: boolean;
  baseDir: string;
  oldName: string;
  newName: string;
  oldCommand: string;
  newCommand: string;
}

export interface RenameResult {
  success: boolean;
  renamedDirs: string[];
  modifiedFiles: string[];
  errors: Array<{ file: string; error: string }>;
  warnings: string[];
}

/**
 * テキストファイルの内容を一括置換
 */
async function replaceInFile(
  filePath: string,
  replacements: Array<{ from: string | RegExp; to: string }>,
  config: RenameConfig
): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    let newContent = content;

    for (const { from, to } of replacements) {
      newContent = newContent.replace(from, to);
    }

    if (newContent !== content) {
      if (!config.dryRun) {
        await fs.writeFile(filePath, newContent, 'utf-8');
      }
      if (config.verbose) {
        console.log(`  ✓ Modified: ${filePath}`);
      }
      return true;
    }

    return false;
  } catch (error) {
    throw new Error(`Failed to replace in ${filePath}: ${error}`);
  }
}

/**
 * ディレクトリ配下の全ファイルを再帰的に取得
 */
async function getAllFiles(dir: string, extensions: string[] = []): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await getAllFiles(fullPath, extensions);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        if (extensions.length === 0 || extensions.some((ext) => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // ディレクトリが存在しない場合は空配列を返す
  }

  return files;
}

/**
 * ディレクトリをリネーム
 */
async function renameDirectory(
  oldPath: string,
  newPath: string,
  config: RenameConfig
): Promise<void> {
  if (!config.dryRun) {
    await fs.rename(oldPath, newPath);
  }
  if (config.verbose) {
    console.log(`  ✓ Renamed: ${oldPath} → ${newPath}`);
  }
}

/**
 * メイン処理: プロジェクト名称変更
 */
export async function renameProject(config: RenameConfig): Promise<RenameResult> {
  const result: RenameResult = {
    success: true,
    renamedDirs: [],
    modifiedFiles: [],
    errors: [],
    warnings: [],
  };

  console.log('🔄 Starting project renaming...\n');
  console.log(`  Old name: ${config.oldName}`);
  console.log(`  New name: ${config.newName}`);
  console.log(`  Old command: ${config.oldCommand}`);
  console.log(`  New command: ${config.newCommand}`);
  console.log(`  Dry run: ${config.dryRun ? 'YES' : 'NO'}\n`);

  try {
    // Step 1: ディレクトリリネーム
    console.log('📁 Step 1: Renaming directories...\n');

    const dirRenames = [
      {
        old: path.join(config.baseDir, '.claude', 'commands', 'takumi'),
        new: path.join(config.baseDir, '.claude', 'commands', 'cft'),
      },
    ];

    for (const { old, new: newPath } of dirRenames) {
      try {
        await fs.access(old);
        await renameDirectory(old, newPath, config);
        result.renamedDirs.push(old);
      } catch {
        if (config.verbose) {
          console.log(`  ℹ️  Skipped (not found): ${old}`);
        }
      }
    }

    // Step 2: シンボリックリンク再作成
    console.log('\n🔗 Step 2: Recreating symlinks...\n');

    const symlinkPath = path.join(config.baseDir, '.claude', 'commands', 'cft');
    const targetPath = path.join(config.baseDir, 'src', 'slash-commands');

    try {
      // 既存のシンボリックリンクを削除（存在する場合）
      try {
        await fs.unlink(symlinkPath);
        if (config.verbose) {
          console.log(`  ✓ Removed old symlink: ${symlinkPath}`);
        }
      } catch {
        // シンボリックリンクが存在しない場合は無視
      }

      // 新しいシンボリックリンクを作成
      if (!config.dryRun) {
        await fs.symlink(targetPath, symlinkPath, 'dir');
      }
      if (config.verbose) {
        console.log(`  ✓ Created symlink: ${symlinkPath} → ${targetPath}`);
      }
    } catch (error) {
      result.errors.push({
        file: symlinkPath,
        error: `Failed to recreate symlink: ${error}`,
      });
    }

    // Step 3: ファイル内容の置換
    console.log('\n📝 Step 3: Replacing content in files...\n');

    const replacements = [
      { from: /Takumi（匠）/g, to: 'cc-craft-kit' },
      { from: /Takumi/g, to: 'cc-craft-kit' },
      { from: /takumi/g, to: 'cc-craft-kit' },
      { from: /\/cft:/g, to: '/cft:' },
      { from: /\.claude\/commands\/takumi\//g, to: '.claude/commands/cft/' },
    ];

    const targetFiles = [
      // package.json
      path.join(config.baseDir, 'package.json'),
      // ドキュメント
      path.join(config.baseDir, 'README.md'),
      path.join(config.baseDir, 'CLAUDE.md'),
      path.join(config.baseDir, 'docs', 'ARCHITECTURE.md'),
      path.join(config.baseDir, 'docs', 'QUICK_START.md'),
      path.join(config.baseDir, 'docs', 'trademark-research-report.md'),
    ];

    // スラッシュコマンド定義ファイル
    const slashCommandFiles = await getAllFiles(
      path.join(config.baseDir, 'src', 'slash-commands'),
      ['.md']
    );
    targetFiles.push(...slashCommandFiles);

    for (const file of targetFiles) {
      try {
        await fs.access(file);
        const modified = await replaceInFile(file, replacements, config);
        if (modified) {
          result.modifiedFiles.push(file);
        }
      } catch {
        if (config.verbose) {
          console.log(`  ℹ️  Skipped (not found): ${file}`);
        }
      }
    }

    console.log('\n✅ Project renaming completed!\n');
    console.log(`  Renamed directories: ${result.renamedDirs.length}`);
    console.log(`  Modified files: ${result.modifiedFiles.length}`);
    console.log(`  Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      for (const error of result.errors) {
        console.log(`  - ${error.file}: ${error.error}`);
      }
      result.success = false;
    }
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error}`);
    result.success = false;
    result.errors.push({ file: 'general', error: String(error) });
  }

  return result;
}

/**
 * CLI エントリーポイント
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const verbose = args.includes('--verbose') || args.includes('-v');

  const config: RenameConfig = {
    dryRun,
    verbose,
    baseDir: process.cwd(),
    oldName: 'takumi',
    newName: 'cc-craft-kit',
    oldCommand: '/cft:',
    newCommand: '/cft:',
  };

  const result = await renameProject(config);

  if (!result.success) {
    process.exit(1);
  }
}

// スクリプトとして実行された場合のみ main() を呼び出す (ES Module 対応)
// import.meta.url を使用して、このファイルが直接実行されたか判定
const isMainModule = process.argv[1] && process.argv[1].endsWith('rename-project.ts');
if (isMainModule) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
