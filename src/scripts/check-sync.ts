#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';

/**
 * スキャン対象のディレクトリ（src/ → .cc-craft-kit/ への同期対象）
 * 注: slash-commands, skills, agents は .claude/ 配下に同期されるため除外
 */
const SCAN_DIRECTORIES = ['commands', 'core', 'integrations'];

/**
 * .claude/ 配下への同期対象ディレクトリ
 */
const CLAUDE_SYNC_MAPPINGS: Array<{ src: string; dest: string }> = [
  { src: 'slash-commands', dest: '.claude/commands/cft' },
  { src: 'skills', dest: '.claude/skills' },
  { src: 'agents', dest: '.claude/agents' },
];

/**
 * 除外するパターン（glob形式）
 */
const EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  '.git',
  '*.db',
  '*.db-journal',
  '.cc-craft-kit/specs',
  '.cc-craft-kit/cc-craft-kit.db',
];

/**
 * 対象ファイル拡張子
 */
const TARGET_EXTENSIONS = ['.ts', '.json', '.md'];

/**
 * スキャンオプション
 */
export interface ScanOptions {
  verbose?: boolean;
  baseDir?: string;
}

/**
 * ファイル情報
 */
export interface FileInfo {
  relativePath: string; // src/ からの相対パス
  absolutePath: string; // 絶対パス
}

/**
 * ディレクトリを再帰的にスキャンしてファイルリストを取得
 */
export async function scanDirectory(dir: string, options: ScanOptions = {}): Promise<FileInfo[]> {
  const { verbose = false } = options;
  const files: FileInfo[] = [];

  /**
   * 再帰的スキャン関数
   */
  async function scan(currentDir: string, relativePath: string = ''): Promise<void> {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(currentDir, entry.name);
        const relPath = path.join(relativePath, entry.name);

        // 除外パターンチェック
        if (shouldExclude(relPath)) {
          if (verbose) {
            console.log(`⏭  Skipping: ${relPath}`);
          }
          continue;
        }

        if (entry.isDirectory()) {
          // ディレクトリの場合は再帰的にスキャン
          await scan(entryPath, relPath);
        } else if (entry.isFile()) {
          // ファイルの場合は拡張子チェック
          const ext = path.extname(entry.name);
          if (TARGET_EXTENSIONS.includes(ext)) {
            files.push({
              relativePath: relPath,
              absolutePath: entryPath,
            });

            if (verbose) {
              console.log(`📄 Found: ${relPath}`);
            }
          }
        }
      }
    } catch (error) {
      if (verbose) {
        console.error(`Error scanning ${currentDir}:`, error);
      }
    }
  }

  await scan(dir);
  return files;
}

/**
 * 除外パターンにマッチするかチェック
 */
function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => {
    // シンプルなパターンマッチング（glob の代わり）
    if (pattern.startsWith('*')) {
      // *.db のような拡張子パターン
      return filePath.endsWith(pattern.slice(1));
    } else {
      // ディレクトリ名またはファイル名の完全一致
      return filePath.includes(pattern);
    }
  });
}

/**
 * src/ と .cc-craft-kit/ のファイルをスキャン
 */
export async function scanProjectFiles(
  options: ScanOptions = {}
): Promise<{ srcFiles: FileInfo[]; destFiles: FileInfo[] }> {
  const { baseDir = process.cwd(), verbose = false } = options;

  if (verbose) {
    console.log('🔍 Scanning project files...\n');
  }

  const srcFiles: FileInfo[] = [];
  const destFiles: FileInfo[] = [];

  // src/ → .cc-craft-kit/ への同期対象をスキャン
  for (const dir of SCAN_DIRECTORIES) {
    const srcDir = path.join(baseDir, 'src', dir);
    const ccCraftKitDir = path.join(baseDir, '.cc-craft-kit', dir);

    // src/ をスキャン
    try {
      await fs.access(srcDir);
      if (verbose) {
        console.log(`📂 Scanning src/${dir}/...`);
      }
      const files = await scanDirectory(srcDir, { ...options, baseDir });
      srcFiles.push(
        ...files.map((f) => ({
          relativePath: path.join(dir, f.relativePath),
          absolutePath: f.absolutePath,
        }))
      );
    } catch {
      if (verbose) {
        console.log(`⚠️  src/${dir}/ does not exist, skipping...`);
      }
    }

    // .cc-craft-kit/ をスキャン
    try {
      await fs.access(ccCraftKitDir);
      if (verbose) {
        console.log(`📂 Scanning .cc-craft-kit/${dir}/...`);
      }
      const files = await scanDirectory(ccCraftKitDir, { ...options, baseDir });
      destFiles.push(
        ...files.map((f) => ({
          relativePath: path.join(dir, f.relativePath),
          absolutePath: f.absolutePath,
        }))
      );
    } catch {
      if (verbose) {
        console.log(`⚠️  .cc-craft-kit/${dir}/ does not exist, skipping...`);
      }
    }
  }

  // src/ → .claude/ への同期対象をスキャン
  for (const mapping of CLAUDE_SYNC_MAPPINGS) {
    const srcDir = path.join(baseDir, 'src', mapping.src);
    const destDir = path.join(baseDir, mapping.dest);

    // src/ をスキャン
    try {
      await fs.access(srcDir);
      if (verbose) {
        console.log(`📂 Scanning src/${mapping.src}/...`);
      }
      const files = await scanDirectory(srcDir, { ...options, baseDir });
      srcFiles.push(
        ...files.map((f) => ({
          relativePath: path.join(mapping.src, f.relativePath),
          absolutePath: f.absolutePath,
        }))
      );
    } catch {
      if (verbose) {
        console.log(`⚠️  src/${mapping.src}/ does not exist, skipping...`);
      }
    }

    // .claude/ をスキャン
    try {
      await fs.access(destDir);
      if (verbose) {
        console.log(`📂 Scanning ${mapping.dest}/...`);
      }
      const files = await scanDirectory(destDir, { ...options, baseDir });
      destFiles.push(
        ...files.map((f) => ({
          relativePath: path.join(mapping.src, f.relativePath),
          absolutePath: f.absolutePath,
        }))
      );
    } catch {
      if (verbose) {
        console.log(`⚠️  ${mapping.dest}/ does not exist, skipping...`);
      }
    }
  }

  if (verbose) {
    console.log(`\n✓ Found ${srcFiles.length} files in src/`);
    console.log(`✓ Found ${destFiles.length} files in destination directories\n`);
  }

  return { srcFiles, destFiles };
}

/**
 * ファイルのMD5ハッシュを計算
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('md5');
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 複数ファイルのハッシュを並列計算
 */
export async function calculateFileHashes(
  files: FileInfo[],
  options: { verbose?: boolean } = {}
): Promise<Map<string, string>> {
  const { verbose = false } = options;
  const hashMap = new Map<string, string>();

  if (verbose) {
    console.log(`🔐 Calculating hashes for ${files.length} files...\n`);
  }

  // 並列処理でハッシュ計算
  const promises = files.map(async (file) => {
    try {
      const hash = await calculateFileHash(file.absolutePath);
      hashMap.set(file.relativePath, hash);

      if (verbose) {
        console.log(`✓ ${file.relativePath}: ${hash}`);
      }
    } catch (error) {
      if (verbose) {
        console.error(`✗ ${file.relativePath}: ${error}`);
      }
      // エラーの場合は null を設定
      hashMap.set(file.relativePath, '');
    }
  });

  await Promise.all(promises);

  if (verbose) {
    console.log(`\n✓ Calculated ${hashMap.size} hashes\n`);
  }

  return hashMap;
}

/**
 * ファイル差分情報
 */
export interface FileDiff {
  path: string;
  srcHash: string | null;
  ccCraftKitHash: string | null;
  status: 'modified' | 'missing_in_cc_craft_kit' | 'extra_in_cc_craft_kit';
}

/**
 * 同期チェック結果
 */
export interface SyncCheckResult {
  inSync: boolean;
  diffs: FileDiff[];
  totalFiles: number;
}

/**
 * src/ と .cc-craft-kit/ の差分を検出
 */
export function detectDifferences(
  srcHashes: Map<string, string>,
  ccCraftKitHashes: Map<string, string>
): FileDiff[] {
  const diffs: FileDiff[] = [];

  // src/ にあるファイルをチェック
  for (const [path, srcHash] of srcHashes.entries()) {
    const ccCraftKitHash = ccCraftKitHashes.get(path);

    if (!ccCraftKitHash) {
      // .cc-craft-kit/ に存在しない
      diffs.push({
        path,
        srcHash,
        ccCraftKitHash: null,
        status: 'missing_in_cc_craft_kit',
      });
    } else if (srcHash !== ccCraftKitHash) {
      // ハッシュが異なる
      diffs.push({
        path,
        srcHash,
        ccCraftKitHash,
        status: 'modified',
      });
    }
  }

  // .cc-craft-kit/ にのみ存在するファイルをチェック
  for (const [path, ccCraftKitHash] of ccCraftKitHashes.entries()) {
    if (!srcHashes.has(path)) {
      diffs.push({
        path,
        srcHash: null,
        ccCraftKitHash,
        status: 'extra_in_cc_craft_kit',
      });
    }
  }

  return diffs;
}

/**
 * 整合性チェック実行
 */
export async function checkSync(options: ScanOptions = {}): Promise<SyncCheckResult> {
  const { verbose = false } = options;

  // ファイルスキャン
  const { srcFiles, destFiles } = await scanProjectFiles(options);

  // ハッシュ計算
  const srcHashes = await calculateFileHashes(srcFiles, { verbose });
  const destHashes = await calculateFileHashes(destFiles, { verbose });

  // 差分検出
  const diffs = detectDifferences(srcHashes, destHashes);

  const totalFiles = Math.max(srcFiles.length, destFiles.length);
  const inSync = diffs.length === 0;

  return {
    inSync,
    diffs,
    totalFiles,
  };
}

/**
 * 差分レポートを表示
 */
export function printDiffReport(
  result: SyncCheckResult,
  options: { showHash?: boolean } = {}
): void {
  const { showHash = false } = options;

  console.log('\n📊 Sync Check Results\n');
  console.log(`Total files checked: ${result.totalFiles}`);
  console.log(`Files with differences: ${result.diffs.length}\n`);

  if (result.inSync) {
    console.log('✅ All files are in sync!');
    console.log(`   src/ and destination directories are identical.\n`);
    return;
  }

  // ステータスごとに分類
  const modified = result.diffs.filter((d) => d.status === 'modified');
  const missingInCcCraftKit = result.diffs.filter((d) => d.status === 'missing_in_cc_craft_kit');
  const extraInCcCraftKit = result.diffs.filter((d) => d.status === 'extra_in_cc_craft_kit');

  if (modified.length > 0) {
    console.log(`⚠️  Modified files (${modified.length}):`);
    modified.forEach((diff) => {
      console.log(`   - ${diff.path}`);
      if (showHash) {
        console.log(`     src/:           ${diff.srcHash}`);
        console.log(`     .cc-craft-kit/: ${diff.ccCraftKitHash}`);
      }
    });
    console.log('');
  }

  if (missingInCcCraftKit.length > 0) {
    console.log(`❌ Missing in destination (${missingInCcCraftKit.length}):`);
    missingInCcCraftKit.forEach((diff) => {
      console.log(`   - ${diff.path}`);
      if (showHash) {
        console.log(`     src/: ${diff.srcHash}`);
      }
    });
    console.log('');
  }

  if (extraInCcCraftKit.length > 0) {
    console.log(`🔹 Extra in destination (${extraInCcCraftKit.length}):`);
    extraInCcCraftKit.forEach((diff) => {
      console.log(`   - ${diff.path}`);
      if (showHash) {
        console.log(`     dest: ${diff.ccCraftKitHash}`);
      }
    });
    console.log('');
  }

  console.log('💡 Recommendation:');
  console.log('   Run `npm run sync:dogfood` to synchronize files.\n');
}

// CLI実行時（ES Moduleの場合はimport.meta.urlで判定）
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
    const showHash = process.argv.includes('--show-hash');

    // 整合性チェック実行
    const result = await checkSync({ verbose });

    // レポート表示
    printDiffReport(result, { showHash });

    // 終了コード（差分がある場合は1）
    process.exit(result.inSync ? 0 : 1);
  })();
}
