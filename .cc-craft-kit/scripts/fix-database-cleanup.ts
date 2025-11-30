#!/usr/bin/env tsx
/**
 * 全コマンドファイルにデータベースクリーンアップ処理を追加
 *
 * 全てのコマンドファイルの process.exit() を exitGracefully() または
 * handleCLIError() に置き換えて、データベースが安全にクローズされるようにします。
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const COMMANDS_DIR = join(process.cwd(), 'src', 'commands');

/**
 * ファイルを再帰的に取得
 */
function getTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getTypeScriptFiles(fullPath));
    } else if (item.endsWith('.ts') && !item.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * コマンドファイルを修正
 */
function fixCommandFile(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8');

  // すでに exitGracefully を import している場合はスキップ
  if (content.includes('exitGracefully')) {
    console.log(`⏭️  [SKIP] ${filePath} (already fixed)`);
    return false;
  }

  // CLI エントリポイントがない場合はスキップ
  if (!content.includes('import.meta.url')) {
    console.log(`⏭️  [SKIP] ${filePath} (not a CLI entry point)`);
    return false;
  }

  let modified = false;
  let newContent = content;

  // 1. インポートに exitGracefully と handleCLIError を追加
  if (content.includes("from '../utils/error-handler.js'")) {
    newContent = newContent.replace(
      /import\s+{([^}]+)}\s+from\s+['"]\.\.\/utils\/error-handler\.js['"]/,
      (match, imports) => {
        if (imports.includes('exitGracefully')) {
          return match;
        }
        const trimmedImports = imports.trim();
        return `import { ${trimmedImports}, exitGracefully, handleCLIError } from '../utils/error-handler.js'`;
      }
    );
    modified = true;
  } else if (content.includes("from '../../utils/error-handler.js'")) {
    newContent = newContent.replace(
      /import\s+{([^}]+)}\s+from\s+['"]\.\.\/\.\.\/utils\/error-handler\.js['"]/,
      (match, imports) => {
        if (imports.includes('exitGracefully')) {
          return match;
        }
        const trimmedImports = imports.trim();
        return `import { ${trimmedImports}, exitGracefully, handleCLIError } from '../../utils/error-handler.js'`;
      }
    );
    modified = true;
  } else {
    // error-handler.js のインポートがない場合は追加
    const depth = filePath.split('/commands/')[1].split('/').length - 1;
    const relativePath = depth === 0 ? './utils/error-handler.js' : '../'.repeat(depth) + 'utils/error-handler.js';

    const lastImportMatch = newContent.match(/import[^;]+from\s+['"][^'"]+['"]\s*;/g);
    if (lastImportMatch) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      newContent = newContent.replace(
        lastImport,
        `${lastImport}\nimport { exitGracefully, handleCLIError } from '${relativePath}';`
      );
      modified = true;
    }
  }

  // 2. CLI エントリポイントの修正
  // パターン1: .catch((error) => { console.error(...); process.exit(1); })
  newContent = newContent.replace(
    /\.catch\(\(error\)\s*=>\s*{\s*console\.error\([^)]+\);\s*process\.exit\(1\);\s*}\);?/g,
    '.catch((error) => handleCLIError(error));'
  );

  // パターン2: .then(() => process.exit(0))
  newContent = newContent.replace(
    /\.then\(\(\)\s*=>\s*process\.exit\(0\)\)/g,
    '.then(() => exitGracefully(0))'
  );

  // パターン3: .then(() => process.exit(0)).catch(...)
  newContent = newContent.replace(
    /\.then\(\(\)\s*=>\s*process\.exit\(0\)\)\s*\.catch\(\(error\)\s*=>\s*{\s*console\.error\([^)]+\);\s*process\.exit\(1\);\s*}\);?/g,
    '.then(() => exitGracefully(0))\n    .catch((error) => handleCLIError(error));'
  );

  if (content !== newContent) {
    writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✓  [FIXED] ${filePath}`);
    return true;
  }

  if (!modified) {
    console.log(`⏭️  [SKIP] ${filePath} (no changes needed)`);
  }

  return false;
}

/**
 * メイン処理
 */
async function main() {
  console.log('# Fix Database Cleanup in All Commands\n');

  const files = getTypeScriptFiles(COMMANDS_DIR);
  console.log(`Found ${files.length} TypeScript files in commands/\n`);

  let fixedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    const fixed = fixCommandFile(file);
    if (fixed) {
      fixedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Fixed: ${fixedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Total: ${files.length}`);

  if (fixedCount > 0) {
    console.log('\n✅ All command files have been updated!');
    console.log('\nNext steps:');
    console.log('  1. Run "npm run sync:dogfood" to sync changes');
    console.log('  2. Test the commands to ensure they work correctly');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
