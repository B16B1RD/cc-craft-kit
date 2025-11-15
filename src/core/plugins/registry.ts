import { Plugin, PluginConfig, PluginRegistry } from './types.js';

/**
 * プラグインレジストリ実装
 */
export class PluginRegistryImpl implements PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private configs: Map<string, PluginConfig> = new Map();

  async register(plugin: Plugin, config?: PluginConfig): Promise<void> {
    const pluginName = plugin.metadata.name;

    if (this.plugins.has(pluginName)) {
      throw new Error(`Plugin "${pluginName}" is already registered`);
    }

    // プラグイン登録
    this.plugins.set(pluginName, plugin);

    // 設定を保存
    const pluginConfig: PluginConfig = config || { enabled: true };
    this.configs.set(pluginName, pluginConfig);

    // onLoadフック実行
    if (pluginConfig.enabled && plugin.onLoad) {
      await plugin.onLoad();
    }

    console.log(`✓ Plugin "${pluginName}" registered (v${plugin.metadata.version})`);
  }

  async unregister(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);

    if (!plugin) {
      throw new Error(`Plugin "${pluginName}" not found`);
    }

    // onUnloadフック実行
    if (plugin.onUnload) {
      await plugin.onUnload();
    }

    this.plugins.delete(pluginName);
    this.configs.delete(pluginName);

    console.log(`✓ Plugin "${pluginName}" unregistered`);
  }

  get(pluginName: string): Plugin | undefined {
    return this.plugins.get(pluginName);
  }

  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabled(): Plugin[] {
    return Array.from(this.plugins.entries())
      .filter(([name, _]) => this.configs.get(name)?.enabled === true)
      .map(([_, plugin]) => plugin);
  }

  async setEnabled(pluginName: string, enabled: boolean): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    const config = this.configs.get(pluginName);

    if (!plugin || !config) {
      throw new Error(`Plugin "${pluginName}" not found`);
    }

    const wasEnabled = config.enabled;
    config.enabled = enabled;

    // 状態変更時のフック実行
    if (enabled && !wasEnabled && plugin.onLoad) {
      await plugin.onLoad();
    } else if (!enabled && wasEnabled && plugin.onUnload) {
      await plugin.onUnload();
    }

    console.log(`✓ Plugin "${pluginName}" ${enabled ? 'enabled' : 'disabled'}`);
  }

  async updateConfig(pluginName: string, config: PluginConfig): Promise<void> {
    const plugin = this.plugins.get(pluginName);

    if (!plugin) {
      throw new Error(`Plugin "${pluginName}" not found`);
    }

    this.configs.set(pluginName, config);

    // onConfigChangeフック実行
    if (plugin.onConfigChange) {
      await plugin.onConfigChange(config);
    }

    console.log(`✓ Plugin "${pluginName}" config updated`);
  }

  /**
   * プラグイン設定を取得
   */
  getConfig(pluginName: string): PluginConfig | undefined {
    return this.configs.get(pluginName);
  }

  /**
   * 全プラグインのSubagentを取得
   */
  getAllSubagents(): unknown[] {
    const subagents: unknown[] = [];

    for (const plugin of this.getEnabled()) {
      if (plugin.getSubagents) {
        subagents.push(...plugin.getSubagents());
      }
    }

    return subagents;
  }

  /**
   * 全プラグインのSkillを取得
   */
  getAllSkills(): unknown[] {
    const skills: unknown[] = [];

    for (const plugin of this.getEnabled()) {
      if (plugin.getSkills) {
        skills.push(...plugin.getSkills());
      }
    }

    return skills;
  }

  /**
   * 全プラグインのMCPツールを取得
   */
  getAllMCPTools(): unknown[] {
    const tools: unknown[] = [];

    for (const plugin of this.getEnabled()) {
      if (plugin.getMCPTools) {
        tools.push(...plugin.getMCPTools());
      }
    }

    return tools;
  }

  /**
   * 全プラグインのイベントハンドラーを取得
   */
  getAllEventHandlers(): unknown[] {
    const handlers: unknown[] = [];

    for (const plugin of this.getEnabled()) {
      if (plugin.getEventHandlers) {
        handlers.push(...plugin.getEventHandlers());
      }
    }

    // 優先度順にソート
    return handlers.sort((a, b) => {
      const aPriority = (a as { priority?: number }).priority || 999;
      const bPriority = (b as { priority?: number }).priority || 999;
      return aPriority - bPriority;
    });
  }
}

/**
 * シングルトンインスタンス
 */
let registryInstance: PluginRegistry | null = null;

/**
 * プラグインレジストリ取得
 */
export function getPluginRegistry(): PluginRegistry {
  if (!registryInstance) {
    registryInstance = new PluginRegistryImpl();
  }
  return registryInstance;
}
