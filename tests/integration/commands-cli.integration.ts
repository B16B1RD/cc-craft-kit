/**
 * Commands CLI 統合テスト
 *
 * src/commands/ 配下のCLIコマンドを実際に実行してテストします。
 */

import { execSync } from 'child_process';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const testProjectDir = join(process.cwd(), '.tmp-integration-test');

/**
 * テストプロジェクトのセットアップ
 */
function setupTestProject(): void {
  // 既存のテストプロジェクトを削除
  if (existsSync(testProjectDir)) {
    rmSync(testProjectDir, { recursive: true, force: true });
  }

  // テストプロジェクトディレクトリ作成
  mkdirSync(testProjectDir, { recursive: true });

  console.log(`  ℹ Test project created at ${testProjectDir}`);
}

/**
 * テストプロジェクトのクリーンアップ
 */
function cleanupTestProject(): void {
  if (existsSync(testProjectDir)) {
    rmSync(testProjectDir, { recursive: true, force: true });
  }
  console.log(`  ℹ Test project cleaned up`);
}

/**
 * CLIコマンドを実行
 *
 * コマンドはプロジェクトルートで実行されますが、
 * 作業ディレクトリはテストプロジェクトディレクトリに設定されます。
 */
function runCommand(command: string, options: { cwd?: string } = {}): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(command, {
      cwd: options.cwd || testProjectDir,
      encoding: 'utf-8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || error.message || '',
      exitCode: error.status || 1,
    };
  }
}

/**
 * 統合テスト実行
 */
export async function runTests(): Promise<void> {
  console.log('  Running Commands CLI integration tests...');

  try {
    setupTestProject();

    // Test 1: /cft:init コマンドのテスト
    console.log('  → Testing /cft:init command');

    // cd してから init コマンドを実行
    const initCommand = `cd ${testProjectDir} && npx tsx ${join(
      process.cwd(),
      'src/commands/init.ts'
    )} test-project "Test project description"`;

    const initResult = runCommand(initCommand, { cwd: process.cwd() });

    if (initResult.exitCode !== 0) {
      console.error('  Init stdout:', initResult.stdout);
      console.error('  Init stderr:', initResult.stderr);
      throw new Error(`init command failed (exit code: ${initResult.exitCode})`);
    }

    // .cc-craft-kit ディレクトリが作成されていることを確認
    const ccCraftKitDir = join(testProjectDir, '.cc-craft-kit');
    if (!existsSync(ccCraftKitDir)) {
      throw new Error('.cc-craft-kit directory was not created');
    }

    console.log('  ✓ /cft:init command test passed');

    // Test 2: /cft:status コマンドのテスト
    console.log('  → Testing /cft:status command');
    const statusCommand = `cd ${testProjectDir} && npx tsx ${join(
      process.cwd(),
      'src/commands/status.ts'
    )}`;
    const statusResult = runCommand(statusCommand, { cwd: process.cwd() });

    if (statusResult.exitCode !== 0) {
      console.error('  Status stdout:', statusResult.stdout);
      console.error('  Status stderr:', statusResult.stderr);
      throw new Error(`status command failed (exit code: ${statusResult.exitCode})`);
    }

    if (!statusResult.stdout.includes('test-project')) {
      console.error('  Status output:', statusResult.stdout);
      throw new Error('status command did not show project name');
    }

    console.log('  ✓ /cft:status command test passed');

    console.log('  ✓ All Commands CLI integration tests passed');
  } finally {
    cleanupTestProject();
  }
}

// 直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
    .then(() => {
      console.log('✓ Integration tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Integration tests failed:', error);
      process.exit(1);
    });
}
