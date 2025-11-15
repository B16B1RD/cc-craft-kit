import { Skill, SkillContext, SkillResult, SkillArtifact } from '../types.js';
import { getTemplateEngine } from '../../templates/engine.js';
import fs from 'fs/promises';
import path from 'path';

export interface RequirementsDocInput {
  specName: string;
  description: string;
  requirements: {
    functional: string[];
    nonFunctional: string[];
  };
  acceptanceCriteria: string[];
  constraints?: string[];
}

export interface RequirementsDocOutput {
  documentPath: string;
  summary: string;
}

/**
 * RequirementsDocGenerator Skill
 * 要件定義書を生成
 */
export class RequirementsDocGenerator
  implements Skill<RequirementsDocInput, RequirementsDocOutput>
{
  name = 'requirements-doc-generator';
  description = '要件定義書を自動生成します';
  version = '1.0.0';
  category = 'requirements' as const;

  async execute(
    input: RequirementsDocInput,
    context: SkillContext
  ): Promise<SkillResult<RequirementsDocOutput>> {
    try {
      const templateEngine = getTemplateEngine();

      // テンプレート変数準備
      const vars = {
        specName: input.specName,
        description: input.description,
        featureOverview: input.description,
        targetUsers: ['エンドユーザー', '管理者'],
        acceptanceCriteria: input.acceptanceCriteria,
        constraints: input.constraints || [],
        dependencies: [],
        createdAt: new Date().toISOString(),
        createdBy: context.userId || 'system',
      };

      // ドキュメント生成
      const content = await templateEngine.renderRequirements(vars);

      // ファイル保存
      const outputDir = path.join(process.cwd(), '.takumi', 'specs');
      await fs.mkdir(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `${input.specName}-requirements.md`);
      await fs.writeFile(outputPath, content, 'utf-8');

      const artifact: SkillArtifact = {
        type: 'document',
        name: `${input.specName}-requirements.md`,
        path: outputPath,
        content,
        metadata: {
          specId: context.specId,
          phase: 'requirements',
        },
      };

      return {
        success: true,
        data: {
          documentPath: outputPath,
          summary: `要件定義書を生成しました: ${input.acceptanceCriteria.length}件の受入基準`,
        },
        artifacts: [artifact],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async validate(input: RequirementsDocInput): Promise<boolean> {
    return !!input.specName && !!input.description && input.acceptanceCriteria.length > 0;
  }

  /**
   * Progressive Disclosure用サマリー
   */
  getSummary(): string {
    return '要件定義書生成: フォーマット済みMarkdownドキュメントを自動生成';
  }
}
