#!/usr/bin/env tsx
/**
 * 統合テストランナー
 *
 * tsx を使用して import.meta 対応の統合テストを実行します。
 */

import { readdir } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

interface TestResult {
  file: string;
  passed: number;
  failed: number;
  errors: Array<{ test: string; error: Error }>;
}

/**
 * テストファイルを実行
 */
async function runTestFile(filePath: string): Promise<TestResult> {
  const result: TestResult = {
    file: relative(process.cwd(), filePath),
    passed: 0,
    failed: 0,
    errors: [],
  };

  try {
    console.log(`\n▶ Running ${result.file}`);

    // テストファイルを動的インポート
    const testModule = await import(filePath);

    // テストモジュールが default export している場合
    if (typeof testModule.default === 'function') {
      await testModule.default();
      result.passed++;
      console.log(`  ✓ Test passed`);
    } else if (testModule.runTests && typeof testModule.runTests === 'function') {
      // runTests 関数がある場合
      await testModule.runTests();
      result.passed++;
      console.log(`  ✓ Tests passed`);
    } else {
      console.warn(`  ⚠ No test function found in ${result.file}`);
    }
  } catch (error) {
    result.failed++;
    result.errors.push({
      test: result.file,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    console.error(`  ✗ Test failed:`, error);
  }

  return result;
}

/**
 * ディレクトリ内のテストファイルを再帰的に検索
 */
async function findTestFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await findTestFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.integration.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * すべての統合テストを実行
 */
async function runAllTests(): Promise<void> {
  const testDir = join(__dirname);
  const testFiles = await findTestFiles(testDir);

  if (testFiles.length === 0) {
    console.log('No integration tests found.');
    return;
  }

  console.log(`Found ${testFiles.length} integration test file(s)\n`);

  const results: TestResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const file of testFiles) {
    const result = await runTestFile(file);
    results.push(result);
    totalPassed += result.passed;
    totalFailed += result.failed;
  }

  // サマリー表示
  console.log('\n' + '='.repeat(60));
  console.log('Integration Test Summary');
  console.log('='.repeat(60));
  console.log(`Total: ${testFiles.length} files`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);

  if (totalFailed > 0) {
    console.log('\nFailed tests:');
    for (const result of results) {
      if (result.failed > 0) {
        for (const error of result.errors) {
          console.error(`  ✗ ${error.test}`);
          console.error(`    ${error.error.message}`);
        }
      }
    }
    process.exit(1);
  } else {
    console.log('\n✓ All integration tests passed!');
  }
}

// メイン実行
runAllTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
