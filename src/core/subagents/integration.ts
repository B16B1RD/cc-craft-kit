/**
 * サブエージェントとスキルの統合機能
 *
 * サブエージェントからスキルを利用できるようにする統合レイヤーを提供します。
 */

import { Subagent, SubagentContext, SubagentResult } from './types.js';
import { Skill, SkillContext } from '../skills/types.js';
import { getSkillRegistry } from '../skills/registry.js';

/**
 * スキル対応サブエージェントコンテキスト
 *
 * サブエージェントからスキルを利用できるように拡張されたコンテキスト
 */
export interface SkillEnabledSubagentContext extends SubagentContext {
  /**
   * 利用可能なスキル一覧
   */
  availableSkills: Skill[];

  /**
   * スキル実行関数
   */
  executeSkill<TInput = unknown, TOutput = unknown>(
    skillName: string,
    input: TInput
  ): Promise<TOutput | undefined>;

  /**
   * カテゴリ別スキル取得
   */
  getSkillsByCategory(category: string): Skill[];
}

/**
 * サブエージェントコンテキストをスキル対応コンテキストに拡張
 */
export function enhanceContextWithSkills(context: SubagentContext): SkillEnabledSubagentContext {
  const registry = getSkillRegistry();
  const availableSkills = registry.list();

  return {
    ...context,
    availableSkills,
    async executeSkill<TInput = unknown, TOutput = unknown>(
      skillName: string,
      input: TInput
    ): Promise<TOutput | undefined> {
      const skill = registry.get(skillName);
      if (!skill) {
        console.warn(`Skill "${skillName}" not found`);
        return undefined;
      }

      // スキルコンテキストを作成
      const skillContext: SkillContext = {
        specId: context.specId,
        taskId: context.taskId,
        metadata: context.metadata,
      };

      try {
        // スキル実行
        const result = await skill.execute(input, skillContext);
        if (!result.success) {
          console.error(`Skill "${skillName}" execution failed:`, result.error);
          return undefined;
        }
        return result.data as TOutput;
      } catch (error) {
        console.error(`Skill "${skillName}" execution error:`, error);
        return undefined;
      }
    },
    getSkillsByCategory(category: string): Skill[] {
      return registry.getByCategory(category as never);
    },
  };
}

/**
 * スキル対応サブエージェントラッパー
 *
 * 既存のサブエージェントをラップして、スキル統合機能を追加します。
 */
export class SkillEnabledSubagentWrapper<TInput = unknown, TOutput = unknown>
  implements Subagent<TInput, TOutput>
{
  constructor(private baseSubagent: Subagent<TInput, TOutput>) {}

  get name(): string {
    return this.baseSubagent.name;
  }

  get description(): string {
    return this.baseSubagent.description;
  }

  get version(): string {
    return this.baseSubagent.version;
  }

  async execute(input: TInput, context: SubagentContext): Promise<SubagentResult<TOutput>> {
    // コンテキストをスキル対応に拡張
    const enhancedContext = enhanceContextWithSkills(context);

    // 拡張されたコンテキストで基底サブエージェントを実行
    return await this.baseSubagent.execute(input, enhancedContext as SubagentContext);
  }

  async validate(input: TInput): Promise<boolean> {
    return await this.baseSubagent.validate(input);
  }

  async initialize(): Promise<void> {
    if (this.baseSubagent.initialize) {
      await this.baseSubagent.initialize();
    }
  }

  async cleanup(): Promise<void> {
    if (this.baseSubagent.cleanup) {
      await this.baseSubagent.cleanup();
    }
  }
}

/**
 * サブエージェントをスキル対応にラップする
 */
export function wrapSubagentWithSkills<TInput = unknown, TOutput = unknown>(
  subagent: Subagent<TInput, TOutput>
): Subagent<TInput, TOutput> {
  return new SkillEnabledSubagentWrapper(subagent);
}

/**
 * スキル統合情報を取得する
 */
export interface SkillIntegrationInfo {
  /**
   * 利用可能なスキル数
   */
  totalSkills: number;

  /**
   * カテゴリ別スキル数
   */
  skillsByCategory: Record<string, number>;

  /**
   * スキル一覧
   */
  skills: Array<{
    name: string;
    description: string;
    category: string;
    version: string;
  }>;
}

/**
 * スキル統合情報を取得する
 */
export function getSkillIntegrationInfo(): SkillIntegrationInfo {
  const registry = getSkillRegistry();
  const skills = registry.list();

  const skillsByCategory: Record<string, number> = {};
  for (const skill of skills) {
    skillsByCategory[skill.category] = (skillsByCategory[skill.category] || 0) + 1;
  }

  return {
    totalSkills: skills.length,
    skillsByCategory,
    skills: skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      category: skill.category,
      version: skill.version,
    })),
  };
}
