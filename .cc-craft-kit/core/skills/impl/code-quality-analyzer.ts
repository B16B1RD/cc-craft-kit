import { Skill, SkillContext, SkillResult, SkillArtifact } from '../types.js';
import fs from 'fs/promises';
import path from 'path';

export interface CodeQualityAnalyzerInput {
  specId: string;
  sourceFiles: string[];
  metrics?: {
    complexity?: boolean;
    maintainability?: boolean;
    duplication?: boolean;
  };
}

export interface CodeQualityAnalyzerOutput {
  overallScore: number; // 0-100
  metrics: {
    complexity: {
      average: number;
      max: number;
      files: Array<{ path: string; score: number }>;
    };
    maintainability: {
      average: number;
      files: Array<{ path: string; score: number }>;
    };
    duplication: {
      percentage: number;
      instances: number;
    };
  };
  issues: Array<{
    file: string;
    line: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    category: 'complexity' | 'maintainability' | 'security' | 'style';
  }>;
  summary: string;
}

/**
 * CodeQualityAnalyzer Skill
 * コード品質を多角的に分析
 */
export class CodeQualityAnalyzer
  implements Skill<CodeQualityAnalyzerInput, CodeQualityAnalyzerOutput>
{
  name = 'code-quality-analyzer';
  description = 'コード品質を複雑度・保守性・重複などから分析します';
  version = '1.0.0';
  category = 'analysis' as const;

  async execute(
    input: CodeQualityAnalyzerInput,
    context: SkillContext
  ): Promise<SkillResult<CodeQualityAnalyzerOutput>> {
    try {
      const analysis = await this.analyzeCodeQuality(input);

      // レポート生成
      const reportContent = this.generateReport(analysis);
      const reportPath = path.join(
        process.cwd(),
        '.cc-craft-kit',
        'reports',
        `code-quality-${context.specId}.md`
      );

      const reportDir = path.dirname(reportPath);
      await fs.mkdir(reportDir, { recursive: true });
      await fs.writeFile(reportPath, reportContent, 'utf-8');

      const artifact: SkillArtifact = {
        type: 'document',
        name: `code-quality-${context.specId}.md`,
        path: reportPath,
        content: reportContent,
        metadata: {
          score: analysis.overallScore,
          issueCount: analysis.issues.length,
        },
      };

      return {
        success: true,
        data: analysis,
        artifacts: [artifact],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async validate(input: CodeQualityAnalyzerInput): Promise<boolean> {
    return !!input.specId && input.sourceFiles.length > 0;
  }

  getSummary(): string {
    return 'コード品質分析: 複雑度・保守性・重複を評価してレポート生成';
  }

  /**
   * コード品質分析
   */
  private async analyzeCodeQuality(
    input: CodeQualityAnalyzerInput
  ): Promise<CodeQualityAnalyzerOutput> {
    const complexityScores: Array<{ path: string; score: number }> = [];
    const maintainabilityScores: Array<{ path: string; score: number }> = [];
    const issues: CodeQualityAnalyzerOutput['issues'] = [];

    // 各ファイルを分析
    for (const filePath of input.sourceFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');

        // 複雑度分析
        const complexity = this.analyzeComplexity(content);
        complexityScores.push({ path: filePath, score: complexity });

        if (complexity > 10) {
          issues.push({
            file: filePath,
            line: 0,
            severity: complexity > 20 ? 'critical' : 'high',
            message: `Cyclomatic complexity too high: ${complexity}`,
            category: 'complexity',
          });
        }

        // 保守性分析
        const maintainability = this.analyzeMaintainability(content);
        maintainabilityScores.push({ path: filePath, score: maintainability });

        if (maintainability < 50) {
          issues.push({
            file: filePath,
            line: 0,
            severity: maintainability < 30 ? 'high' : 'medium',
            message: `Low maintainability score: ${maintainability}`,
            category: 'maintainability',
          });
        }

        // セキュリティパターンチェック
        const securityIssues = this.checkSecurityPatterns(content, filePath);
        issues.push(...securityIssues);

        // コードスタイルチェック
        const styleIssues = this.checkCodeStyle(content, filePath);
        issues.push(...styleIssues);
      } catch {
        // ファイル読み込みエラーは無視
      }
    }

    // 重複分析
    const duplication = await this.analyzeDuplication(input.sourceFiles);

    // 平均値計算
    const avgComplexity =
      complexityScores.reduce((sum, s) => sum + s.score, 0) / complexityScores.length || 0;
    const maxComplexity = Math.max(...complexityScores.map((s) => s.score), 0);
    const avgMaintainability =
      maintainabilityScores.reduce((sum, s) => sum + s.score, 0) / maintainabilityScores.length ||
      0;

    // 総合スコア計算
    const overallScore = this.calculateOverallScore({
      complexity: avgComplexity,
      maintainability: avgMaintainability,
      duplication: duplication.percentage,
      issueCount: issues.length,
    });

    const summary = `コード品質スコア: ${overallScore}/100 (${issues.length}件の改善点)`;

    return {
      overallScore,
      metrics: {
        complexity: {
          average: Math.round(avgComplexity * 10) / 10,
          max: maxComplexity,
          files: complexityScores,
        },
        maintainability: {
          average: Math.round(avgMaintainability * 10) / 10,
          files: maintainabilityScores,
        },
        duplication,
      },
      issues,
      summary,
    };
  }

  /**
   * 循環的複雑度分析
   */
  private analyzeComplexity(code: string): number {
    let complexity = 1; // 基本複雑度

    // 条件分岐
    const ifMatches = code.match(/\bif\s*\(/g);
    if (ifMatches) complexity += ifMatches.length;

    const elseMatches = code.match(/\belse\s+(if\s*\()?/g);
    if (elseMatches) complexity += elseMatches.length;

    // ループ
    const forMatches = code.match(/\bfor\s*\(/g);
    if (forMatches) complexity += forMatches.length;

    const whileMatches = code.match(/\bwhile\s*\(/g);
    if (whileMatches) complexity += whileMatches.length;

    // case文
    const caseMatches = code.match(/\bcase\s+/g);
    if (caseMatches) complexity += caseMatches.length;

    // 三項演算子
    const ternaryMatches = code.match(/\?.*:/g);
    if (ternaryMatches) complexity += ternaryMatches.length;

    // 論理演算子
    const andMatches = code.match(/&&/g);
    if (andMatches) complexity += andMatches.length;

    const orMatches = code.match(/\|\|/g);
    if (orMatches) complexity += orMatches.length;

    return complexity;
  }

  /**
   * 保守性スコア分析
   */
  private analyzeMaintainability(code: string): number {
    let score = 100;

    const lines = code.split('\n');
    const totalLines = lines.length;

    // 長すぎるファイル
    if (totalLines > 500) score -= 20;
    else if (totalLines > 300) score -= 10;

    // コメント率
    const commentLines = lines.filter((line) => /^\s*(\/\/|\/\*|\*|#)/.test(line)).length;
    const commentRatio = commentLines / totalLines;
    if (commentRatio < 0.1) score -= 10;

    // 長すぎる行
    const longLines = lines.filter((line) => line.length > 100).length;
    if (longLines > totalLines * 0.2) score -= 10;

    // 関数の長さ
    const functions = code.match(/function\s+\w+\s*\([^)]*\)\s*\{/g);
    if (functions && functions.length > 20) score -= 10;

    // ネストレベル
    const maxNestLevel = this.calculateMaxNestLevel(code);
    if (maxNestLevel > 4) score -= 15;
    else if (maxNestLevel > 3) score -= 5;

    return Math.max(0, score);
  }

  /**
   * 最大ネストレベル計算
   */
  private calculateMaxNestLevel(code: string): number {
    let maxLevel = 0;
    let currentLevel = 0;

    for (const char of code) {
      if (char === '{') {
        currentLevel++;
        maxLevel = Math.max(maxLevel, currentLevel);
      } else if (char === '}') {
        currentLevel--;
      }
    }

    return maxLevel;
  }

  /**
   * セキュリティパターンチェック
   */
  private checkSecurityPatterns(
    code: string,
    filePath: string
  ): CodeQualityAnalyzerOutput['issues'] {
    const issues: CodeQualityAnalyzerOutput['issues'] = [];

    // eval使用
    if (code.includes('eval(')) {
      issues.push({
        file: filePath,
        line: 0,
        severity: 'critical',
        message: 'eval()の使用は危険です',
        category: 'security',
      });
    }

    // ハードコードされたパスワード/キー
    if (/password\s*=\s*['"][^'"]+['"]/.test(code)) {
      issues.push({
        file: filePath,
        line: 0,
        severity: 'critical',
        message: 'ハードコードされた認証情報が検出されました',
        category: 'security',
      });
    }

    // SQL インジェクション の可能性
    if (/\$\{.*\}/.test(code) && code.includes('SELECT')) {
      issues.push({
        file: filePath,
        line: 0,
        severity: 'high',
        message: 'SQLインジェクションのリスクがあります',
        category: 'security',
      });
    }

    return issues;
  }

  /**
   * コードスタイルチェック
   */
  private checkCodeStyle(code: string, filePath: string): CodeQualityAnalyzerOutput['issues'] {
    const issues: CodeQualityAnalyzerOutput['issues'] = [];

    // console.log残り
    const consoleMatches = code.match(/console\.(log|warn|error)/g);
    if (consoleMatches && consoleMatches.length > 3) {
      issues.push({
        file: filePath,
        line: 0,
        severity: 'low',
        message: `${consoleMatches.length}個のconsole文が残っています`,
        category: 'style',
      });
    }

    // TODO/FIXME コメント
    const todoMatches = code.match(/(TODO|FIXME)/g);
    if (todoMatches && todoMatches.length > 5) {
      issues.push({
        file: filePath,
        line: 0,
        severity: 'medium',
        message: `${todoMatches.length}個のTODO/FIXMEコメントが残っています`,
        category: 'style',
      });
    }

    return issues;
  }

  /**
   * コード重複分析
   */
  private async analyzeDuplication(
    sourceFiles: string[]
  ): Promise<CodeQualityAnalyzerOutput['metrics']['duplication']> {
    // 簡易的な重複検出: 同じ行が複数ファイルにある
    const lineMap = new Map<string, number>();
    let totalLines = 0;

    for (const filePath of sourceFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim().length > 10);

        totalLines += lines.length;

        lines.forEach((line) => {
          const normalized = line.trim();
          lineMap.set(normalized, (lineMap.get(normalized) || 0) + 1);
        });
      } catch {
        // ファイル読み込みエラーは無視
      }
    }

    // 重複している行をカウント
    let duplicatedLines = 0;
    lineMap.forEach((count) => {
      if (count > 1) {
        duplicatedLines += count - 1;
      }
    });

    const percentage = totalLines > 0 ? (duplicatedLines / totalLines) * 100 : 0;

    return {
      percentage: Math.round(percentage * 10) / 10,
      instances: Array.from(lineMap.values()).filter((count) => count > 1).length,
    };
  }

  /**
   * 総合スコア計算
   */
  private calculateOverallScore(factors: {
    complexity: number;
    maintainability: number;
    duplication: number;
    issueCount: number;
  }): number {
    let score = 100;

    // 複雑度ペナルティ (平均10以下が理想)
    if (factors.complexity > 10) {
      score -= Math.min(30, (factors.complexity - 10) * 2);
    }

    // 保守性スコア (そのまま加味)
    score = (score + factors.maintainability) / 2;

    // 重複ペナルティ (5%以下が理想)
    if (factors.duplication > 5) {
      score -= Math.min(20, (factors.duplication - 5) * 2);
    }

    // イシュー数ペナルティ
    score -= Math.min(20, factors.issueCount);

    return Math.max(0, Math.round(score));
  }

  /**
   * レポート生成
   */
  private generateReport(analysis: CodeQualityAnalyzerOutput): string {
    return `# コード品質分析レポート

## 総合スコア: ${analysis.overallScore}/100

${this.getScoreEmoji(analysis.overallScore)} ${this.getScoreLabel(analysis.overallScore)}

## メトリクス

### 複雑度
- 平均: ${analysis.metrics.complexity.average}
- 最大: ${analysis.metrics.complexity.max}

### 保守性
- 平均スコア: ${analysis.metrics.maintainability.average}/100

### コード重複
- 重複率: ${analysis.metrics.duplication.percentage}%
- 重複インスタンス: ${analysis.metrics.duplication.instances}件

## 検出された問題 (${analysis.issues.length}件)

${analysis.issues
  .map(
    (issue) =>
      `### ${this.getSeverityEmoji(issue.severity)} ${issue.severity.toUpperCase()}: ${issue.message}
- ファイル: ${issue.file}
- カテゴリ: ${issue.category}
`
  )
  .join('\n')}

## 改善提案

${this.generateRecommendations(analysis)}
`;
  }

  /**
   * スコアの絵文字
   */
  private getScoreEmoji(score: number): string {
    if (score >= 90) return '🟢';
    if (score >= 70) return '🟡';
    if (score >= 50) return '🟠';
    return '🔴';
  }

  /**
   * スコアのラベル
   */
  private getScoreLabel(score: number): string {
    if (score >= 90) return '優秀';
    if (score >= 70) return '良好';
    if (score >= 50) return '改善が必要';
    return '要大幅改善';
  }

  /**
   * 深刻度の絵文字
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      case 'low':
        return '🔵';
      default:
        return '⚪';
    }
  }

  /**
   * 改善提案生成
   */
  private generateRecommendations(analysis: CodeQualityAnalyzerOutput): string {
    const recommendations: string[] = [];

    if (analysis.metrics.complexity.average > 10) {
      recommendations.push('- 複雑な関数をより小さな関数に分割してください');
    }

    if (analysis.metrics.maintainability.average < 70) {
      recommendations.push('- コードのドキュメント化とリファクタリングを検討してください');
    }

    if (analysis.metrics.duplication.percentage > 5) {
      recommendations.push('- 重複コードを共通関数/モジュールに抽出してください');
    }

    const criticalIssues = analysis.issues.filter((i) => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('- 重大なセキュリティ/品質問題を優先的に修正してください');
    }

    if (recommendations.length === 0) {
      return '特に問題は検出されませんでした。良好なコード品質を維持してください。';
    }

    return recommendations.join('\n');
  }
}
