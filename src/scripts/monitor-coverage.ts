#!/usr/bin/env node
/**
 * カバレッジ監視スクリプト
 *
 * Jest のカバレッジレポートを解析し、指定された閾値を満たしているかチェックする。
 * 閾値を下回った場合は、エラーメッセージを出力して終了コード 1 で終了する。
 *
 * 使用方法:
 *   npm run test:coverage 2>&1 | npx tsx src/scripts/monitor-coverage.ts
 *
 * または、カバレッジレポートファイルから直接読み取る:
 *   npx tsx src/scripts/monitor-coverage.ts --file coverage/lcov.info
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface CoverageThreshold {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

interface CoverageSummary {
  statements: { pct: number };
  branches: { pct: number };
  functions: { pct: number };
  lines: { pct: number };
}

const DEFAULT_THRESHOLD: CoverageThreshold = {
  statements: 80,
  branches: 70,
  functions: 90,
  lines: 80,
};

/**
 * lcov.info ファイルからカバレッジサマリーを抽出する
 */
function parseLcovFile(filePath: string): CoverageSummary | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let totalLines = 0;
    let coveredLines = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;

    for (const line of lines) {
      if (line.startsWith('LF:')) {
        totalLines += Number.parseInt(line.slice(3), 10);
      } else if (line.startsWith('LH:')) {
        coveredLines += Number.parseInt(line.slice(3), 10);
      } else if (line.startsWith('BRF:')) {
        totalBranches += Number.parseInt(line.slice(4), 10);
      } else if (line.startsWith('BRH:')) {
        coveredBranches += Number.parseInt(line.slice(4), 10);
      } else if (line.startsWith('FNF:')) {
        totalFunctions += Number.parseInt(line.slice(4), 10);
      } else if (line.startsWith('FNH:')) {
        coveredFunctions += Number.parseInt(line.slice(4), 10);
      }
    }

    const statementPct = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
    const branchPct = totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0;
    const functionPct = totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0;

    return {
      statements: { pct: statementPct },
      branches: { pct: branchPct },
      functions: { pct: functionPct },
      lines: { pct: statementPct }, // lcov では lines と statements は同じ
    };
  } catch (error) {
    console.error(`Failed to parse lcov file: ${error}`);
    return null;
  }
}

/**
 * カバレッジサマリーと閾値を比較する
 */
function checkThreshold(
  summary: CoverageSummary,
  threshold: CoverageThreshold
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  if (summary.statements.pct < threshold.statements) {
    failures.push(
      `Statements coverage (${summary.statements.pct.toFixed(2)}%) is below threshold (${threshold.statements}%)`
    );
  }

  if (summary.branches.pct < threshold.branches) {
    failures.push(
      `Branches coverage (${summary.branches.pct.toFixed(2)}%) is below threshold (${threshold.branches}%)`
    );
  }

  if (summary.functions.pct < threshold.functions) {
    failures.push(
      `Functions coverage (${summary.functions.pct.toFixed(2)}%) is below threshold (${threshold.functions}%)`
    );
  }

  if (summary.lines.pct < threshold.lines) {
    failures.push(
      `Lines coverage (${summary.lines.pct.toFixed(2)}%) is below threshold (${threshold.lines}%)`
    );
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

/**
 * メイン処理
 */
function main(): void {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  const lcovPath =
    fileIndex !== -1 && args[fileIndex + 1]
      ? resolve(args[fileIndex + 1])
      : resolve(process.cwd(), 'coverage/lcov.info');

  console.log('📊 Coverage Monitoring System');
  console.log('─'.repeat(50));
  console.log(`Reading coverage report: ${lcovPath}`);

  const summary = parseLcovFile(lcovPath);

  if (!summary) {
    console.error('❌ Failed to parse coverage report');
    process.exit(1);
  }

  console.log('\n📈 Current Coverage:');
  console.log(`  Statements: ${summary.statements.pct.toFixed(2)}%`);
  console.log(`  Branches:   ${summary.branches.pct.toFixed(2)}%`);
  console.log(`  Functions:  ${summary.functions.pct.toFixed(2)}%`);
  console.log(`  Lines:      ${summary.lines.pct.toFixed(2)}%`);

  console.log('\n🎯 Thresholds:');
  console.log(`  Statements: ${DEFAULT_THRESHOLD.statements}%`);
  console.log(`  Branches:   ${DEFAULT_THRESHOLD.branches}%`);
  console.log(`  Functions:  ${DEFAULT_THRESHOLD.functions}%`);
  console.log(`  Lines:      ${DEFAULT_THRESHOLD.lines}%`);

  const result = checkThreshold(summary, DEFAULT_THRESHOLD);

  console.log('\n' + '─'.repeat(50));

  if (result.passed) {
    console.log('✅ All coverage thresholds passed!');
    process.exit(0);
  }

  console.error('❌ Coverage thresholds not met:\n');
  for (const failure of result.failures) {
    console.error(`  • ${failure}`);
  }
  console.error('\n💡 Tip: Add more tests to increase coverage and meet the thresholds.');
  process.exit(1);
}

main();
