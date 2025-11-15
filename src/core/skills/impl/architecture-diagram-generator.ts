import { Skill, SkillContext, SkillResult, SkillArtifact } from '../types.js';
import fs from 'fs/promises';
import path from 'path';

export interface ArchitectureDiagramInput {
  specId: string;
  architecture: {
    pattern: string;
    components: Array<{
      name: string;
      type: string;
      dependencies: string[];
    }>;
    dataFlow?: string[];
  };
  format: 'mermaid' | 'plantuml' | 'ascii';
}

export interface ArchitectureDiagramOutput {
  diagramPath: string;
  format: string;
  summary: string;
}

/**
 * ArchitectureDiagramGenerator Skill
 * アーキテクチャ図を自動生成
 */
export class ArchitectureDiagramGenerator
  implements Skill<ArchitectureDiagramInput, ArchitectureDiagramOutput>
{
  name = 'architecture-diagram-generator';
  description = 'アーキテクチャ設計から図を自動生成します';
  version = '1.0.0';
  category = 'design' as const;

  async execute(
    input: ArchitectureDiagramInput,
    context: SkillContext
  ): Promise<SkillResult<ArchitectureDiagramOutput>> {
    try {
      let diagramContent: string;
      let fileExtension: string;

      // フォーマット別の図生成
      switch (input.format) {
        case 'mermaid':
          diagramContent = this.generateMermaidDiagram(input.architecture);
          fileExtension = 'mmd';
          break;
        case 'plantuml':
          diagramContent = this.generatePlantUMLDiagram(input.architecture);
          fileExtension = 'puml';
          break;
        case 'ascii':
          diagramContent = this.generateAsciiDiagram(input.architecture);
          fileExtension = 'txt';
          break;
        default:
          diagramContent = this.generateMermaidDiagram(input.architecture);
          fileExtension = 'mmd';
      }

      // ファイル保存
      const outputDir = path.join(process.cwd(), '.takumi', 'diagrams');
      await fs.mkdir(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `architecture-${context.specId}.${fileExtension}`);
      await fs.writeFile(outputPath, diagramContent, 'utf-8');

      const artifact: SkillArtifact = {
        type: 'diagram',
        name: `architecture-${context.specId}.${fileExtension}`,
        path: outputPath,
        content: diagramContent,
        metadata: {
          format: input.format,
          componentCount: input.architecture.components.length,
        },
      };

      return {
        success: true,
        data: {
          diagramPath: outputPath,
          format: input.format,
          summary: `${input.format}形式のアーキテクチャ図を生成しました (${input.architecture.components.length}コンポーネント)`,
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

  async validate(input: ArchitectureDiagramInput): Promise<boolean> {
    return !!input.specId && !!input.architecture && input.architecture.components.length > 0;
  }

  getSummary(): string {
    return 'アーキテクチャ図生成: Mermaid/PlantUML/ASCII形式で視覚化';
  }

  /**
   * Mermaid図生成
   */
  private generateMermaidDiagram(architecture: ArchitectureDiagramInput['architecture']): string {
    let diagram = `graph TD\n`;
    diagram += `  subgraph "${architecture.pattern}"\n`;

    // コンポーネントノード定義
    architecture.components.forEach((component) => {
      const nodeId = this.sanitizeNodeId(component.name);
      const nodeShape = this.getMermaidNodeShape(component.type);
      diagram += `    ${nodeId}${nodeShape}\n`;
    });

    diagram += `  end\n\n`;

    // 依存関係のエッジ
    architecture.components.forEach((component) => {
      const sourceId = this.sanitizeNodeId(component.name);
      component.dependencies.forEach((dep) => {
        const targetId = this.sanitizeNodeId(dep);
        diagram += `  ${sourceId} --> ${targetId}\n`;
      });
    });

    // データフロー追加
    if (architecture.dataFlow && architecture.dataFlow.length > 0) {
      diagram += `\n  %% Data Flow\n`;
      architecture.dataFlow.forEach((flow) => {
        diagram += `  %% ${flow}\n`;
      });
    }

    return diagram;
  }

  /**
   * PlantUML図生成
   */
  private generatePlantUMLDiagram(architecture: ArchitectureDiagramInput['architecture']): string {
    let diagram = `@startuml\n`;
    diagram += `title ${architecture.pattern}\n\n`;

    // コンポーネント定義
    architecture.components.forEach((component) => {
      const componentType = this.getPlantUMLComponentType(component.type);
      diagram += `${componentType} "${component.name}" as ${this.sanitizeNodeId(component.name)}\n`;
    });

    diagram += `\n`;

    // 依存関係
    architecture.components.forEach((component) => {
      const sourceId = this.sanitizeNodeId(component.name);
      component.dependencies.forEach((dep) => {
        const targetId = this.sanitizeNodeId(dep);
        diagram += `${sourceId} --> ${targetId}\n`;
      });
    });

    diagram += `\n@enduml\n`;

    return diagram;
  }

  /**
   * ASCII図生成
   */
  private generateAsciiDiagram(architecture: ArchitectureDiagramInput['architecture']): string {
    let diagram = `=== ${architecture.pattern} ===\n\n`;

    // コンポーネント一覧
    diagram += `Components:\n`;
    architecture.components.forEach((component, index) => {
      diagram += `  ${index + 1}. [${component.type}] ${component.name}\n`;
    });

    diagram += `\nDependencies:\n`;
    architecture.components.forEach((component) => {
      if (component.dependencies.length > 0) {
        diagram += `  ${component.name}\n`;
        component.dependencies.forEach((dep) => {
          diagram += `    └─> ${dep}\n`;
        });
      }
    });

    // データフロー
    if (architecture.dataFlow && architecture.dataFlow.length > 0) {
      diagram += `\nData Flow:\n`;
      architecture.dataFlow.forEach((flow) => {
        diagram += `  ${flow}\n`;
      });
    }

    return diagram;
  }

  /**
   * ノードID用の文字列サニタイズ
   */
  private sanitizeNodeId(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Mermaidノード形状取得
   */
  private getMermaidNodeShape(type: string): string {
    switch (type.toLowerCase()) {
      case 'controller':
        return '[Controller]';
      case 'service':
        return '(Service)';
      case 'repository':
        return '[(Repository)]';
      case 'model':
        return '{Model}';
      case 'view':
        return '>View]';
      case 'utility':
        return '[[Utility]]';
      default:
        return '[Component]';
    }
  }

  /**
   * PlantUMLコンポーネントタイプ取得
   */
  private getPlantUMLComponentType(type: string): string {
    switch (type.toLowerCase()) {
      case 'controller':
        return 'component';
      case 'service':
        return 'component';
      case 'repository':
        return 'database';
      case 'model':
        return 'class';
      case 'view':
        return 'interface';
      case 'utility':
        return 'component';
      default:
        return 'component';
    }
  }
}
