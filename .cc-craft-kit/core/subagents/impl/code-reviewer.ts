import { Subagent, SubagentContext, SubagentResult } from '../types.js';

export interface CodeReviewerInput {
  code: string;
  language: string;
  context?: string;
}

export interface CodeReviewerOutput {
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
    suggestion?: string;
  }>;
  score: number; // 0-100
  summary: string;
}

/**
 * CodeReviewer Subagent
 * コードレビュー実施
 */
export class CodeReviewer implements Subagent<CodeReviewerInput, CodeReviewerOutput> {
  name = 'code-reviewer';
  description = 'コードレビューを実施し、改善提案を行います';
  version = '1.0.0';

  async execute(
    input: CodeReviewerInput,
    _context: SubagentContext
  ): Promise<SubagentResult<CodeReviewerOutput>> {
    try {
      const review = await this.reviewCode(input);

      return {
        success: true,
        data: review,
        logs: [`Reviewed ${input.code.split('\n').length} lines of ${input.language} code`],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async validate(input: CodeReviewerInput): Promise<boolean> {
    return !!input.code && !!input.language;
  }

  private async reviewCode(input: CodeReviewerInput): Promise<CodeReviewerOutput> {
    const issues: CodeReviewerOutput['issues'] = [];
    const lines = input.code.split('\n');

    // 簡易静的解析
    lines.forEach((line, index) => {
      // console.log検出
      if (line.includes('console.log')) {
        issues.push({
          severity: 'warning',
          message: 'console.log文が残っています',
          line: index + 1,
          suggestion: 'デバッグログを削除またはロガーを使用してください',
        });
      }

      // TODO/FIXME検出
      if (line.includes('TODO') || line.includes('FIXME')) {
        issues.push({
          severity: 'info',
          message: 'TODO/FIXMEコメントがあります',
          line: index + 1,
          suggestion: 'Issue化して追跡することを推奨',
        });
      }

      // 長い行検出
      if (line.length > 120) {
        issues.push({
          severity: 'info',
          message: '行が長すぎます（120文字超）',
          line: index + 1,
          suggestion: '可読性のため行を分割してください',
        });
      }
    });

    // スコア計算
    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;
    const score = Math.max(0, 100 - errorCount * 20 - warningCount * 5);

    return {
      issues,
      score,
      summary: `${issues.length}件の指摘事項を検出。スコア: ${score}/100`,
    };
  }
}
