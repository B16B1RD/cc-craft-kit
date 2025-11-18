import { Subagent, SubagentRegistry } from './types.js';

/**
 * Subagentレジストリ実装
 */
export class SubagentRegistryImpl implements SubagentRegistry {
  private subagents: Map<string, Subagent> = new Map();

  /**
   * Subagent登録
   */
  register(subagent: Subagent): void {
    if (this.subagents.has(subagent.name)) {
      throw new Error(`Subagent "${subagent.name}" is already registered`);
    }
    this.subagents.set(subagent.name, subagent);
  }

  /**
   * Subagent取得
   */
  get(name: string): Subagent | undefined {
    return this.subagents.get(name);
  }

  /**
   * 全Subagent取得
   */
  list(): Subagent[] {
    return Array.from(this.subagents.values());
  }

  /**
   * Subagent存在確認
   */
  has(name: string): boolean {
    return this.subagents.has(name);
  }

  /**
   * Subagent削除
   */
  unregister(name: string): void {
    this.subagents.delete(name);
  }
}

/**
 * グローバルSubagentレジストリインスタンス
 */
let registryInstance: SubagentRegistry | null = null;

/**
 * グローバルSubagentレジストリ取得
 */
export function getSubagentRegistry(): SubagentRegistry {
  if (!registryInstance) {
    registryInstance = new SubagentRegistryImpl();
  }
  return registryInstance;
}
