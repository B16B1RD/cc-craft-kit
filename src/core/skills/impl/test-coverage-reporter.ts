import { Skill, SkillContext, SkillResult, SkillArtifact } from '../types.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TestCoverageReporterInput {
  specId: string;
  testCommand?: string; // デフォルト: npm test -- --coverage
  coverageFormat?: 'json' | 'lcov' | 'html' | 'text';
  thresholds?: {
    statements?: number;
    branches?: number;
    functions?: number;
    lines?: number;
  };
}

export interface TestCoverageReporterOutput {
  coverage: {
    statements: { total: number; covered: number; percentage: number };
    branches: { total: number; covered: number; percentage: number };
    functions: { total: number; covered: number; percentage: number };
    lines: { total: number; covered: number; percentage: number };
  };
  files: Array<{
    path: string;
    coverage: number;
    uncoveredLines: number[];
  }>;
  passed: boolean;
  summary: string;
}

/**
 * TestCoverageReporter Skill
 * テストカバレッジを測定してレポート生成
 */
export class TestCoverageReporter
  implements Skill<TestCoverageReporterInput, TestCoverageReporterOutput>
{
  name = 'test-coverage-reporter';
  description = 'テストカバレッジを測定して詳細レポートを生成します';
  version = '1.0.0';
  category = 'testing' as const;

  async execute(
    input: TestCoverageReporterInput,
    context: SkillContext
  ): Promise<SkillResult<TestCoverageReporterOutput>> {
    try {
      // テスト実行してカバレッジ取得
      const coverageData = await this.runTestsWithCoverage(input);

      // カバレッジレポート生成
      const reportContent = this.generateReport(coverageData, input.thresholds);
      const reportPath = path.join(
        process.cwd(),
        '.takumi',
        'reports',
        `test-coverage-${context.specId}.md`
      );

      const reportDir = path.dirname(reportPath);
      await fs.mkdir(reportDir, { recursive: true });
      await fs.writeFile(reportPath, reportContent, 'utf-8');

      const artifact: SkillArtifact = {
        type: 'document',
        name: `test-coverage-${context.specId}.md`,
        path: reportPath,
        content: reportContent,
        metadata: {
          statementsCoverage: coverageData.coverage.statements.percentage,
          passed: coverageData.passed,
        },
      };

      return {
        success: true,
        data: coverageData,
        artifacts: [artifact],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async validate(input: TestCoverageReporterInput): Promise<boolean> {
    return !!input.specId;
  }

  getSummary(): string {
    return 'テストカバレッジレポート: カバレッジを測定して閾値チェック';
  }

  /**
   * テスト実行とカバレッジ取得
   */
  private async runTestsWithCoverage(
    input: TestCoverageReporterInput
  ): Promise<TestCoverageReporterOutput> {
    const testCommand = input.testCommand || 'npm test -- --coverage --json';

    try {
      // テスト実行
      await execAsync(testCommand, {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      // カバレッジデータ解析
      const coverageData = await this.parseCoverageData();

      // 閾値チェック
      const passed = this.checkThresholds(coverageData.coverage, input.thresholds);

      return {
        ...coverageData,
        passed,
        summary: `カバレッジ: ${coverageData.coverage.statements.percentage.toFixed(2)}% (${passed ? '✅ 合格' : '❌ 不合格'})`,
      };
    } catch {
      // テスト実行失敗時は既存のカバレッジデータを読み込むか、デフォルト値を返す
      return this.getDefaultCoverageData();
    }
  }

  /**
   * カバレッジデータ解析
   */
  private async parseCoverageData(): Promise<
    Omit<TestCoverageReporterOutput, 'passed' | 'summary'>
  > {
    // Jestのcoverage-final.jsonを読み込み
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-final.json');

    try {
      const coverageJson = await fs.readFile(coveragePath, 'utf-8');
      const coverage = JSON.parse(coverageJson);

      return this.analyzeCoverageJson(coverage);
    } catch {
      // カバレッジファイルが見つからない場合はデフォルト値
      return this.getDefaultCoverageData();
    }
  }

  /**
   * カバレッジJSON解析
   */
  private analyzeCoverageJson(
    coverageJson: Record<string, unknown>
  ): Omit<TestCoverageReporterOutput, 'passed' | 'summary'> {
    let totalStatements = 0;
    let coveredStatements = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalLines = 0;
    let coveredLines = 0;

    const files: TestCoverageReporterOutput['files'] = [];

    for (const [filePath, fileData] of Object.entries(coverageJson)) {
      const data = fileData as {
        s?: Record<string, number>;
        b?: Record<string, number[]>;
        f?: Record<string, number>;
      };

      // ファイルごとの集計
      const fileStatements = Object.keys(data.s || {}).length;
      const fileCoveredStatements = Object.values(data.s || {}).filter(
        (v) => (v as number) > 0
      ).length;

      const fileCoverage = fileStatements > 0 ? (fileCoveredStatements / fileStatements) * 100 : 0;

      const uncoveredLines: number[] = [];
      for (const [lineNum, count] of Object.entries(data.s || {})) {
        if ((count as number) === 0) {
          uncoveredLines.push(parseInt(lineNum));
        }
      }

      files.push({
        path: filePath,
        coverage: Math.round(fileCoverage * 10) / 10,
        uncoveredLines,
      });

      // 全体集計
      totalStatements += fileStatements;
      coveredStatements += fileCoveredStatements;

      totalBranches += Object.keys(data.b || {}).length;
      coveredBranches += Object.values(data.b || {}).filter((branches) =>
        branches.every((b) => b > 0)
      ).length;

      totalFunctions += Object.keys(data.f || {}).length;
      coveredFunctions += Object.values(data.f || {}).filter((v) => (v as number) > 0).length;

      totalLines += Object.keys(data.s || {}).length;
      coveredLines += fileCoveredStatements;
    }

    return {
      coverage: {
        statements: {
          total: totalStatements,
          covered: coveredStatements,
          percentage:
            totalStatements > 0
              ? Math.round((coveredStatements / totalStatements) * 10000) / 100
              : 0,
        },
        branches: {
          total: totalBranches,
          covered: coveredBranches,
          percentage:
            totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 10000) / 100 : 0,
        },
        functions: {
          total: totalFunctions,
          covered: coveredFunctions,
          percentage:
            totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 10000) / 100 : 0,
        },
        lines: {
          total: totalLines,
          covered: coveredLines,
          percentage: totalLines > 0 ? Math.round((coveredLines / totalLines) * 10000) / 100 : 0,
        },
      },
      files,
    };
  }

  /**
   * デフォルトカバレッジデータ
   */
  private getDefaultCoverageData(): TestCoverageReporterOutput {
    return {
      coverage: {
        statements: { total: 0, covered: 0, percentage: 0 },
        branches: { total: 0, covered: 0, percentage: 0 },
        functions: { total: 0, covered: 0, percentage: 0 },
        lines: { total: 0, covered: 0, percentage: 0 },
      },
      files: [],
      passed: false,
      summary: 'カバレッジデータが取得できませんでした',
    };
  }

  /**
   * 閾値チェック
   */
  private checkThresholds(
    coverage: TestCoverageReporterOutput['coverage'],
    thresholds?: TestCoverageReporterInput['thresholds']
  ): boolean {
    if (!thresholds) return true;

    const checks = [
      !thresholds.statements || coverage.statements.percentage >= thresholds.statements,
      !thresholds.branches || coverage.branches.percentage >= thresholds.branches,
      !thresholds.functions || coverage.functions.percentage >= thresholds.functions,
      !thresholds.lines || coverage.lines.percentage >= thresholds.lines,
    ];

    return checks.every((check) => check);
  }

  /**
   * レポート生成
   */
  private generateReport(
    data: TestCoverageReporterOutput,
    thresholds?: TestCoverageReporterInput['thresholds']
  ): string {
    const { coverage, files, passed } = data;

    return `# テストカバレッジレポート

## 総合結果

${passed ? '✅ **合格**' : '❌ **不合格**'}

## カバレッジサマリー

| メトリクス | カバー率 | カバー数 / 総数 | 閾値 | 状態 |
|----------|---------|---------------|-----|------|
| Statements | ${coverage.statements.percentage.toFixed(2)}% | ${coverage.statements.covered} / ${coverage.statements.total} | ${thresholds?.statements || 'N/A'}% | ${this.getThresholdStatus(coverage.statements.percentage, thresholds?.statements)} |
| Branches | ${coverage.branches.percentage.toFixed(2)}% | ${coverage.branches.covered} / ${coverage.branches.total} | ${thresholds?.branches || 'N/A'}% | ${this.getThresholdStatus(coverage.branches.percentage, thresholds?.branches)} |
| Functions | ${coverage.functions.percentage.toFixed(2)}% | ${coverage.functions.covered} / ${coverage.functions.total} | ${thresholds?.functions || 'N/A'}% | ${this.getThresholdStatus(coverage.functions.percentage, thresholds?.functions)} |
| Lines | ${coverage.lines.percentage.toFixed(2)}% | ${coverage.lines.covered} / ${coverage.lines.total} | ${thresholds?.lines || 'N/A'}% | ${this.getThresholdStatus(coverage.lines.percentage, thresholds?.lines)} |

## ファイル別カバレッジ

${
  files.length > 0
    ? files
        .sort((a, b) => a.coverage - b.coverage)
        .map(
          (file) => `
### ${path.basename(file.path)} - ${file.coverage.toFixed(2)}%

${this.getCoverageBar(file.coverage)}

${file.uncoveredLines.length > 0 ? `未カバー行: ${file.uncoveredLines.slice(0, 10).join(', ')}${file.uncoveredLines.length > 10 ? '...' : ''}` : '全行カバー済み'}
`
        )
        .join('\n')
    : 'カバレッジデータなし'
}

## 改善提案

${this.generateImprovementSuggestions(coverage, thresholds)}
`;
  }

  /**
   * 閾値ステータス取得
   */
  private getThresholdStatus(percentage: number, threshold?: number): string {
    if (!threshold) return '-';
    return percentage >= threshold ? '✅' : '❌';
  }

  /**
   * カバレッジバー生成
   */
  private getCoverageBar(percentage: number): string {
    const barLength = 20;
    const filled = Math.round((percentage / 100) * barLength);
    const empty = barLength - filled;

    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage.toFixed(2)}%`;
  }

  /**
   * 改善提案生成
   */
  private generateImprovementSuggestions(
    coverage: TestCoverageReporterOutput['coverage'],
    thresholds?: TestCoverageReporterInput['thresholds']
  ): string {
    const suggestions: string[] = [];

    if (thresholds) {
      if (thresholds.statements && coverage.statements.percentage < thresholds.statements) {
        suggestions.push(
          `- Statementsカバレッジを${thresholds.statements}%以上に向上させてください（現在: ${coverage.statements.percentage.toFixed(2)}%）`
        );
      }

      if (thresholds.branches && coverage.branches.percentage < thresholds.branches) {
        suggestions.push(
          `- Branchesカバレッジを${thresholds.branches}%以上に向上させてください（現在: ${coverage.branches.percentage.toFixed(2)}%）`
        );
      }

      if (thresholds.functions && coverage.functions.percentage < thresholds.functions) {
        suggestions.push(
          `- Functionsカバレッジを${thresholds.functions}%以上に向上させてください（現在: ${coverage.functions.percentage.toFixed(2)}%）`
        );
      }
    }

    if (coverage.branches.percentage < 70) {
      suggestions.push('- エッジケースや分岐条件のテストを追加してください');
    }

    if (coverage.functions.percentage < 80) {
      suggestions.push('- 未テストの関数にテストケースを追加してください');
    }

    if (suggestions.length === 0) {
      return '良好なカバレッジです。この品質を維持してください。';
    }

    return suggestions.join('\n');
  }
}
