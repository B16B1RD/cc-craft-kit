/**
 * 品質要件定義ファイルのスキーマと型定義
 *
 * @module core/quality/schema
 */

/**
 * サブエージェントまたはスキルのタイプ
 */
export type QualityRequirementType = 'subagent' | 'skill';

/**
 * フェーズ名
 */
export type TriggerPhase =
  | 'requirements'
  | 'design'
  | 'tasks'
  | 'implementation'
  | 'testing'
  | 'completed';

/**
 * 品質要件定義
 */
export interface QualityRequirement {
  /**
   * 品質要件の一意な名前
   * 例: "security-audit", "api-documentation-generator"
   */
  name: string;

  /**
   * タイプ: サブエージェントまたはスキル
   */
  type: QualityRequirementType;

  /**
   * トリガーフェーズ: この品質チェックを実行するフェーズ
   */
  trigger_phase: TriggerPhase;

  /**
   * 品質要件の説明
   */
  description: string;

  /**
   * 使用するテンプレート名
   * 例: "security-auditor", "api-doc-generator"
   */
  template: string;

  /**
   * サブエージェントまたはスキルが使用するツール
   * 例: ["Read", "Grep", "Bash"]
   */
  tools: string[];

  /**
   * テンプレート変数として渡すパラメータ
   */
  parameters?: Record<string, unknown>;
}

/**
 * 品質要件定義ファイルのルート構造
 */
export interface QualityRequirementsConfig {
  /**
   * スキーマバージョン
   */
  version: string;

  /**
   * 品質要件のリスト
   */
  quality_requirements: QualityRequirement[];
}

/**
 * 品質要件定義ファイルのバリデーション
 *
 * @param config - 検証対象の設定オブジェクト
 * @throws {Error} バリデーションエラー
 */
export function validateQualityRequirementsConfig(
  config: unknown
): asserts config is QualityRequirementsConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error('Quality requirements config must be an object');
  }

  const obj = config as Record<string, unknown>;

  // version フィールドの検証
  if (typeof obj.version !== 'string') {
    throw new Error('Quality requirements config must have a version field');
  }

  // quality_requirements フィールドの検証
  if (!Array.isArray(obj.quality_requirements)) {
    throw new Error('Quality requirements config must have a quality_requirements array');
  }

  // 各品質要件の検証
  obj.quality_requirements.forEach((req, index) => {
    validateQualityRequirement(req, index);
  });
}

/**
 * 単一品質要件のバリデーション
 *
 * @param req - 検証対象の品質要件
 * @param index - 配列内のインデックス（エラーメッセージ用）
 * @throws {Error} バリデーションエラー
 */
function validateQualityRequirement(
  req: unknown,
  index: number
): asserts req is QualityRequirement {
  if (typeof req !== 'object' || req === null) {
    throw new Error(`Quality requirement at index ${index} must be an object`);
  }

  const obj = req as Record<string, unknown>;

  // 必須フィールドの検証
  const requiredFields = ['name', 'type', 'trigger_phase', 'description', 'template', 'tools'];

  for (const field of requiredFields) {
    if (!(field in obj)) {
      throw new Error(`Quality requirement at index ${index} is missing required field: ${field}`);
    }
  }

  // name の検証
  if (typeof obj.name !== 'string' || obj.name.length === 0) {
    throw new Error(`Quality requirement at index ${index}: name must be a non-empty string`);
  }

  // type の検証
  if (obj.type !== 'subagent' && obj.type !== 'skill') {
    throw new Error(`Quality requirement at index ${index}: type must be 'subagent' or 'skill'`);
  }

  // trigger_phase の検証
  const validPhases: TriggerPhase[] = [
    'requirements',
    'design',
    'tasks',
    'implementation',
    'testing',
    'completed',
  ];

  if (!validPhases.includes(obj.trigger_phase as TriggerPhase)) {
    throw new Error(
      `Quality requirement at index ${index}: trigger_phase must be one of ${validPhases.join(', ')}`
    );
  }

  // description の検証
  if (typeof obj.description !== 'string' || obj.description.length === 0) {
    throw new Error(
      `Quality requirement at index ${index}: description must be a non-empty string`
    );
  }

  // template の検証
  if (typeof obj.template !== 'string' || obj.template.length === 0) {
    throw new Error(`Quality requirement at index ${index}: template must be a non-empty string`);
  }

  // tools の検証
  if (!Array.isArray(obj.tools) || obj.tools.length === 0) {
    throw new Error(`Quality requirement at index ${index}: tools must be a non-empty array`);
  }

  for (const tool of obj.tools) {
    if (typeof tool !== 'string') {
      throw new Error(`Quality requirement at index ${index}: all tools must be strings`);
    }
  }

  // parameters の検証（オプショナル）
  if ('parameters' in obj) {
    if (typeof obj.parameters !== 'object' || obj.parameters === null) {
      throw new Error(
        `Quality requirement at index ${index}: parameters must be an object if provided`
      );
    }
  }
}

/**
 * デフォルトの品質要件定義テンプレート
 */
export const DEFAULT_QUALITY_REQUIREMENTS_TEMPLATE: QualityRequirementsConfig = {
  version: '1.0',
  quality_requirements: [
    {
      name: 'security-audit',
      type: 'subagent',
      trigger_phase: 'implementation',
      description: 'OWASP Top 10 に基づくセキュリティ脆弱性チェック',
      template: 'security-auditor',
      tools: ['Read', 'Grep', 'Bash'],
      parameters: {
        owasp_version: '2021',
        severity_threshold: 'high',
      },
    },
    {
      name: 'api-documentation-generator',
      type: 'skill',
      trigger_phase: 'completed',
      description: 'OpenAPI 仕様書から API ドキュメントを自動生成',
      template: 'api-doc-generator',
      tools: ['Read', 'Write'],
      parameters: {
        spec_format: 'OpenAPI 3.0',
        output_format: 'Markdown',
      },
    },
  ],
};
