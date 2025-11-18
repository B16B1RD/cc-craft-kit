import { Skill, SkillCategory, SkillRegistry } from './types.js';

/**
 * Skillレジストリ実装
 */
export class SkillRegistryImpl implements SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  /**
   * Skill登録
   */
  register(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      throw new Error(`Skill "${skill.name}" is already registered`);
    }
    this.skills.set(skill.name, skill);
  }

  /**
   * Skill取得
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * カテゴリ別Skill取得
   */
  getByCategory(category: SkillCategory): Skill[] {
    return Array.from(this.skills.values()).filter((skill) => skill.category === category);
  }

  /**
   * 全Skill取得
   */
  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Skill存在確認
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Skill削除
   */
  unregister(name: string): void {
    this.skills.delete(name);
  }
}

/**
 * グローバルSkillレジストリインスタンス
 */
let registryInstance: SkillRegistry | null = null;

/**
 * グローバルSkillレジストリ取得
 */
export function getSkillRegistry(): SkillRegistry {
  if (!registryInstance) {
    registryInstance = new SkillRegistryImpl();
  }
  return registryInstance;
}
