import { Subagent, SubagentContext, SubagentResult } from '../types.js';

/**
 * RequirementsAnalyzer入力
 */
export interface RequirementsAnalyzerInput {
  userStory: string;
  additionalContext?: string;
  constraints?: string[];
}

/**
 * RequirementsAnalyzer出力
 */
export interface RequirementsAnalyzerOutput {
  summary: string;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  acceptanceCriteria: string[];
  dependencies: string[];
  risks: Array<{
    description: string;
    impact: 'high' | 'medium' | 'low';
    mitigation?: string;
  }>;
}

/**
 * RequirementsAnalyzer Subagent
 * ユーザーストーリーから要件を分析・抽出
 */
export class RequirementsAnalyzer
  implements Subagent<RequirementsAnalyzerInput, RequirementsAnalyzerOutput>
{
  name = 'requirements-analyzer';
  description = 'ユーザーストーリーから要件を分析・抽出します';
  version = '1.0.0';

  async execute(
    input: RequirementsAnalyzerInput,
    context: SubagentContext
  ): Promise<SubagentResult<RequirementsAnalyzerOutput>> {
    try {
      // ユーザーストーリーを解析
      const analysis = await this.analyzeUserStory(input.userStory, input.additionalContext);

      return {
        success: true,
        data: analysis,
        logs: [`Analyzed user story for spec ${context.specId}`],
        nextActions: ['進行: アーキテクチャ設計フェーズへ移行'],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async validate(input: RequirementsAnalyzerInput): Promise<boolean> {
    return !!input.userStory && input.userStory.length > 0;
  }

  /**
   * ユーザーストーリー分析
   */
  private async analyzeUserStory(
    userStory: string,
    additionalContext?: string
  ): Promise<RequirementsAnalyzerOutput> {
    // 簡易実装: 実際のプロジェクトではLLMを使用して分析
    const lines = userStory.split('\n').filter((line) => line.trim());

    return {
      summary: lines[0] || userStory.substring(0, 100),
      functionalRequirements: this.extractFunctionalRequirements(userStory),
      nonFunctionalRequirements: this.extractNonFunctionalRequirements(userStory),
      acceptanceCriteria: this.extractAcceptanceCriteria(userStory),
      dependencies: this.extractDependencies(userStory, additionalContext),
      risks: this.identifyRisks(userStory),
    };
  }

  private extractFunctionalRequirements(userStory: string): string[] {
    // キーワードベースの抽出（簡易実装）
    const requirements: string[] = [];
    const keywords = ['must', 'should', 'shall', 'できる', '必要', '機能'];

    userStory.split('\n').forEach((line) => {
      if (keywords.some((keyword) => line.toLowerCase().includes(keyword))) {
        requirements.push(line.trim());
      }
    });

    return requirements.length > 0 ? requirements : ['基本機能の実装'];
  }

  private extractNonFunctionalRequirements(userStory: string): string[] {
    const nfr: string[] = [];
    const nfrKeywords = [
      'performance',
      'security',
      'scalability',
      'パフォーマンス',
      'セキュリティ',
      'スケーラビリティ',
    ];

    userStory.split('\n').forEach((line) => {
      if (nfrKeywords.some((keyword) => line.toLowerCase().includes(keyword))) {
        nfr.push(line.trim());
      }
    });

    return nfr;
  }

  private extractAcceptanceCriteria(userStory: string): string[] {
    const criteria: string[] = [];
    const lines = userStory.split('\n');

    lines.forEach((line) => {
      if (
        line.trim().startsWith('-') ||
        line.trim().startsWith('*') ||
        line.trim().match(/^\d+\./)
      ) {
        criteria.push(
          line
            .trim()
            .replace(/^[-*]\s*/, '')
            .replace(/^\d+\.\s*/, '')
        );
      }
    });

    return criteria.length > 0 ? criteria : ['機能が正常に動作すること'];
  }

  private extractDependencies(userStory: string, additionalContext?: string): string[] {
    const dependencies: string[] = [];
    const text = `${userStory}\n${additionalContext || ''}`;

    // 技術スタック検出
    const techKeywords = ['database', 'api', 'authentication', 'データベース', 'API', '認証'];
    techKeywords.forEach((keyword) => {
      if (text.toLowerCase().includes(keyword)) {
        dependencies.push(keyword);
      }
    });

    return dependencies;
  }

  private identifyRisks(userStory: string): Array<{
    description: string;
    impact: 'high' | 'medium' | 'low';
    mitigation?: string;
  }> {
    const risks: Array<{
      description: string;
      impact: 'high' | 'medium' | 'low';
      mitigation?: string;
    }> = [];

    // 複雑度リスク
    if (userStory.length > 1000) {
      risks.push({
        description: '要件が複雑で実装に時間がかかる可能性',
        impact: 'medium',
        mitigation: 'タスクを細分化して段階的に実装',
      });
    }

    // セキュリティリスク
    if (userStory.toLowerCase().includes('authentication') || userStory.includes('認証')) {
      risks.push({
        description: 'セキュリティ要件が含まれる',
        impact: 'high',
        mitigation: '業界標準のセキュリティプラクティスを適用',
      });
    }

    return risks;
  }
}
