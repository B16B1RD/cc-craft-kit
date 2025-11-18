import { Kysely } from 'kysely';
import { Database } from '../../database/schema.js';
import { Subagent, SubagentContext, SubagentResult } from '../types.js';

/**
 * ArchitectDesigner入力
 */
export interface ArchitectDesignerInput {
  specId: string;
  requirements: {
    functional: string[];
    nonFunctional: string[];
  };
  constraints?: string[];
}

/**
 * ArchitectDesigner出力
 */
export interface ArchitectDesignerOutput {
  architecture: {
    pattern: string; // MVC, Microservices, Layered, etc.
    components: Array<{
      name: string;
      type: 'service' | 'controller' | 'model' | 'view' | 'repository' | 'utility';
      responsibilities: string[];
      dependencies: string[];
    }>;
    dataFlow: string[];
    technologyStack: {
      frontend?: string[];
      backend?: string[];
      database?: string[];
      infrastructure?: string[];
    };
  };
  designDecisions: Array<{
    decision: string;
    rationale: string;
    alternatives: string[];
  }>;
  risks: Array<{
    risk: string;
    mitigation: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

/**
 * ArchitectDesigner Subagent
 * 要件からアーキテクチャ設計を行う
 */
export class ArchitectDesigner
  implements Subagent<ArchitectDesignerInput, ArchitectDesignerOutput>
{
  name = 'architect-designer';
  description = '要件から最適なアーキテクチャを設計します';
  version = '1.0.0';

  constructor(private db: Kysely<Database>) {}

  async execute(
    input: ArchitectDesignerInput,
    _context: SubagentContext
  ): Promise<SubagentResult<ArchitectDesignerOutput>> {
    try {
      const design = await this.designArchitecture(input);

      // 設計をDBに保存
      await this.saveDesignToDatabase(input.specId, design);

      return {
        success: true,
        data: design,
        logs: [
          `Designed ${design.architecture.pattern} architecture`,
          `Created ${design.architecture.components.length} components`,
          `Identified ${design.risks.length} architectural risks`,
        ],
        nextActions: ['進行: タスク分解フェーズへ移行', 'アーキテクチャ図の生成を検討'],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async validate(input: ArchitectDesignerInput): Promise<boolean> {
    return (
      !!input.specId &&
      (input.requirements.functional.length > 0 || input.requirements.nonFunctional.length > 0)
    );
  }

  /**
   * アーキテクチャ設計ロジック
   */
  private async designArchitecture(
    input: ArchitectDesignerInput
  ): Promise<ArchitectDesignerOutput> {
    // アーキテクチャパターン選択
    const pattern = this.selectArchitecturePattern(input.requirements);

    // コンポーネント設計
    const components = this.designComponents(input.requirements, pattern);

    // データフロー設計
    const dataFlow = this.designDataFlow(components);

    // 技術スタック提案
    const technologyStack = this.suggestTechnologyStack(input.requirements);

    // 設計決定の記録
    const designDecisions = this.recordDesignDecisions(
      pattern,
      input.requirements,
      input.constraints
    );

    // リスク分析
    const risks = this.analyzeArchitecturalRisks(pattern, components, input.constraints);

    return {
      architecture: {
        pattern,
        components,
        dataFlow,
        technologyStack,
      },
      designDecisions,
      risks,
    };
  }

  /**
   * アーキテクチャパターン選択
   */
  private selectArchitecturePattern(requirements: {
    functional: string[];
    nonFunctional: string[];
  }): string {
    const allReqs = [...requirements.functional, ...requirements.nonFunctional].join(' ');

    // キーワードベースのパターン選択
    if (allReqs.includes('マイクロサービス') || allReqs.includes('分散')) {
      return 'Microservices';
    }
    if (allReqs.includes('API') && allReqs.includes('REST')) {
      return 'Layered (REST API)';
    }
    if (allReqs.includes('イベント') || allReqs.includes('非同期')) {
      return 'Event-Driven';
    }
    if (allReqs.includes('Web') || allReqs.includes('UI')) {
      return 'MVC';
    }

    // デフォルト: Layered Architecture
    return 'Layered Architecture';
  }

  /**
   * コンポーネント設計
   */
  private designComponents(
    requirements: { functional: string[]; nonFunctional: string[] },
    pattern: string
  ): ArchitectDesignerOutput['architecture']['components'] {
    const components: ArchitectDesignerOutput['architecture']['components'] = [];

    if (pattern === 'MVC' || pattern.includes('Layered')) {
      // Controller層
      requirements.functional.forEach((req) => {
        if (req.includes('ユーザー') || req.includes('認証')) {
          components.push({
            name: 'UserController',
            type: 'controller',
            responsibilities: ['ユーザーリクエスト処理', '認証・認可'],
            dependencies: ['UserService', 'AuthService'],
          });
        }
      });

      // Service層
      components.push({
        name: 'CoreService',
        type: 'service',
        responsibilities: ['ビジネスロジック実行', 'データ整合性保証'],
        dependencies: ['Repository'],
      });

      // Repository層
      components.push({
        name: 'DataRepository',
        type: 'repository',
        responsibilities: ['データ永続化', 'データ取得'],
        dependencies: ['Database'],
      });
    }

    if (pattern === 'Event-Driven') {
      components.push({
        name: 'EventBus',
        type: 'service',
        responsibilities: ['イベント配信', 'サブスクリプション管理'],
        dependencies: [],
      });
    }

    // ユーティリティコンポーネント
    if (requirements.nonFunctional.some((r) => r.includes('ログ'))) {
      components.push({
        name: 'Logger',
        type: 'utility',
        responsibilities: ['ログ記録', 'エラー追跡'],
        dependencies: [],
      });
    }

    return components;
  }

  /**
   * データフロー設計
   */
  private designDataFlow(
    components: ArchitectDesignerOutput['architecture']['components']
  ): string[] {
    const flow: string[] = [];

    const controllers = components.filter((c) => c.type === 'controller');
    const services = components.filter((c) => c.type === 'service');
    const repositories = components.filter((c) => c.type === 'repository');

    if (controllers.length > 0 && services.length > 0) {
      flow.push(`${controllers[0].name} -> ${services[0].name}: リクエスト処理`);
    }

    if (services.length > 0 && repositories.length > 0) {
      flow.push(`${services[0].name} -> ${repositories[0].name}: データ操作`);
    }

    if (repositories.length > 0) {
      flow.push(`${repositories[0].name} -> Database: 永続化`);
    }

    return flow;
  }

  /**
   * 技術スタック提案
   */
  private suggestTechnologyStack(requirements: {
    functional: string[];
    nonFunctional: string[];
  }): ArchitectDesignerOutput['architecture']['technologyStack'] {
    const allReqs = [...requirements.functional, ...requirements.nonFunctional].join(' ');

    const stack: ArchitectDesignerOutput['architecture']['technologyStack'] = {};

    // Frontend
    if (allReqs.includes('React') || allReqs.includes('UI')) {
      stack.frontend = ['React', 'TypeScript', 'Tailwind CSS'];
    }

    // Backend
    if (allReqs.includes('Node') || allReqs.includes('TypeScript')) {
      stack.backend = ['Node.js', 'TypeScript', 'Express'];
    } else if (allReqs.includes('Python')) {
      stack.backend = ['Python', 'FastAPI'];
    }

    // Database
    if (allReqs.includes('SQL') || allReqs.includes('PostgreSQL')) {
      stack.database = ['PostgreSQL', 'Kysely (Query Builder)'];
    } else if (allReqs.includes('NoSQL')) {
      stack.database = ['MongoDB'];
    } else {
      stack.database = ['SQLite']; // デフォルト
    }

    // Infrastructure
    if (allReqs.includes('Docker') || allReqs.includes('コンテナ')) {
      stack.infrastructure = ['Docker', 'Docker Compose'];
    }

    return stack;
  }

  /**
   * 設計決定の記録
   */
  private recordDesignDecisions(
    pattern: string,
    requirements: { functional: string[]; nonFunctional: string[] },
    constraints?: string[]
  ): ArchitectDesignerOutput['designDecisions'] {
    const decisions: ArchitectDesignerOutput['designDecisions'] = [];

    // パターン選択の理由
    decisions.push({
      decision: `${pattern}アーキテクチャを採用`,
      rationale: '要件の複雑度とスケーラビリティのバランスを考慮',
      alternatives: ['Microservices', 'Monolithic', 'Serverless'],
    });

    // 制約による決定
    if (constraints && constraints.length > 0) {
      constraints.forEach((constraint) => {
        if (constraint.includes('予算') || constraint.includes('コスト')) {
          decisions.push({
            decision: 'クラウドネイティブではなくシンプルな構成を選択',
            rationale: 'コスト制約を考慮',
            alternatives: ['AWS Lambda', 'Kubernetes'],
          });
        }
      });
    }

    // スケーラビリティ
    if (requirements.nonFunctional.some((r) => r.includes('スケール'))) {
      decisions.push({
        decision: '水平スケーラビリティを考慮した設計',
        rationale: 'トラフィック増加に対応',
        alternatives: ['垂直スケーリングのみ'],
      });
    }

    return decisions;
  }

  /**
   * アーキテクチャリスク分析
   */
  private analyzeArchitecturalRisks(
    pattern: string,
    components: ArchitectDesignerOutput['architecture']['components'],
    constraints?: string[]
  ): ArchitectDesignerOutput['risks'] {
    const risks: ArchitectDesignerOutput['risks'] = [];

    // 複雑性リスク
    if (components.length > 10) {
      risks.push({
        risk: 'アーキテクチャの複雑性が高い',
        mitigation: 'コンポーネントの責務を明確化し、ドキュメント整備',
        severity: 'medium',
      });
    }

    // スケーラビリティリスク
    if (pattern === 'Monolithic') {
      risks.push({
        risk: 'モノリシック構成によるスケーラビリティ制限',
        mitigation: 'モジュール境界を明確にし、将来のマイクロサービス化を考慮',
        severity: 'medium',
      });
    }

    // 技術的負債リスク
    if (constraints?.some((c) => c.includes('レガシー'))) {
      risks.push({
        risk: 'レガシーシステムとの統合による技術的負債',
        mitigation: 'Anti-Corruption Layerの導入',
        severity: 'high',
      });
    }

    // デフォルトリスク
    if (risks.length === 0) {
      risks.push({
        risk: '想定外のトラフィック増加',
        mitigation: 'モニタリングとオートスケーリングの設定',
        severity: 'low',
      });
    }

    return risks;
  }

  /**
   * 設計をDBに保存
   */
  private async saveDesignToDatabase(
    specId: string,
    _design: ArchitectDesignerOutput
  ): Promise<void> {
    // Specの更新日時を更新（metadataフィールドがないため）
    await this.db
      .updateTable('specs')
      .set({
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', specId)
      .execute();
  }
}
