#!/usr/bin/env tsx
/**
 * すべてのコマンドファイルに closeDatabase() 呼び出しを追加するスクリプト
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface FileModification {
  filePath: string;
  status: 'added' | 'skipped' | 'error';
  reason?: string;
}

/**
 * ディレクトリを再帰的に走査して TypeScript ファイルを収集
 */
function findTsFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // utils ディレクトリはスキップ
      if (!filePath.includes('/utils')) {
        findTsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

async function addCloseDatabaseToCommands(): Promise<void> {
  console.log('🔧 Adding closeDatabase() calls to all command files...\n');

  const commandFiles = findTsFiles('src/commands');

  const results: FileModification[] = [];

  for (const filePath of commandFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');

      // CLI エントリポイントがない場合はスキップ
      if (!content.includes('if (import.meta.url ===')) {
        results.push({ filePath, status: 'skipped', reason: 'No CLI entry point' });
        continue;
      }

      // 既に closeDatabase が含まれている場合はスキップ
      if (content.includes('closeDatabase')) {
        results.push({ filePath, status: 'skipped', reason: 'Already has closeDatabase' });
        continue;
      }

      // getDatabase インポートを探す
      const getDatabaseImportMatch = content.match(
        /import\s*{\s*([^}]*getDatabase[^}]*)\s*}\s*from\s*['"]([^'"]*connection\.js)['"]/
      );

      if (!getDatabaseImportMatch) {
        results.push({ filePath, status: 'skipped', reason: 'No getDatabase import found' });
        continue;
      }

      // closeDatabase をインポートに追加
      let modifiedContent = content;
      const importNames = getDatabaseImportMatch[1];
      const importPath = getDatabaseImportMatch[2];

      if (!importNames.includes('closeDatabase')) {
        const newImportNames = importNames.trim() + ', closeDatabase';
        modifiedContent = modifiedContent.replace(
          getDatabaseImportMatch[0],
          `import { ${newImportNames} } from '${importPath}'`
        );
      }

      // CLI エントリポイントの catch ブロックを探して finally を追加
      // Pattern: .catch((error) => handleCLIError(error));
      const catchPattern = /\.catch\(\(error\) => handleCLIError\(error\)\);/g;

      if (modifiedContent.match(catchPattern)) {
        modifiedContent = modifiedContent.replace(
          catchPattern,
          '.catch((error) => handleCLIError(error))\n    .finally(() => closeDatabase());'
        );
      } else {
        results.push({
          filePath,
          status: 'error',
          reason: 'Could not find CLI entry point pattern',
        });
        continue;
      }

      // ファイルを書き込む
      writeFileSync(filePath, modifiedContent, 'utf-8');
      results.push({ filePath, status: 'added' });
      console.log(`✓ ${filePath}`);
    } catch (error) {
      results.push({
        filePath,
        status: 'error',
        reason: error instanceof Error ? error.message : String(error),
      });
      console.error(`✗ ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // サマリー表示
  console.log('\n📊 Summary:');
  console.log(`   Added: ${results.filter((r) => r.status === 'added').length}`);
  console.log(`   Skipped: ${results.filter((r) => r.status === 'skipped').length}`);
  console.log(`   Errors: ${results.filter((r) => r.status === 'error').length}`);
  console.log(`   Total: ${results.length}`);

  // エラーがあれば詳細表示
  const errors = results.filter((r) => r.status === 'error');
  if (errors.length > 0) {
    console.log('\n⚠️  Files with errors:');
    for (const error of errors) {
      console.log(`   ${error.filePath}: ${error.reason}`);
    }
  }

  // スキップされたファイルの詳細表示
  const skipped = results.filter((r) => r.status === 'skipped');
  if (skipped.length > 0) {
    console.log('\n📝 Skipped files:');
    for (const skip of skipped) {
      console.log(`   ${skip.filePath}: ${skip.reason}`);
    }
  }
}

addCloseDatabaseToCommands().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
