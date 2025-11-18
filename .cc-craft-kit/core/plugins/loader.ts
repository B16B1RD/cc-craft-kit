import { Plugin, PluginLoader } from './types.js';
import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

/**
 * プラグインローダー実装
 */
export class PluginLoaderImpl implements PluginLoader {
  private loadedPlugins: Map<string, Plugin> = new Map();

  async loadFromDirectory(directory: string): Promise<Plugin[]> {
    const plugins: Plugin[] = [];

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginDir = path.join(directory, entry.name);
          const pluginPath = path.join(pluginDir, 'index.js');

          try {
            const plugin = await this.loadPlugin(pluginPath);
            plugins.push(plugin);
            this.loadedPlugins.set(plugin.metadata.name, plugin);
          } catch (error) {
            console.error(`Failed to load plugin from ${pluginDir}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to read plugin directory ${directory}:`, error);
    }

    return plugins;
  }

  async loadFromPackage(packageName: string): Promise<Plugin> {
    try {
      // npmパッケージをインポート
      const module = await import(packageName);

      if (!module.default) {
        throw new Error(`Package "${packageName}" does not have a default export`);
      }

      const plugin: Plugin = module.default;

      // 基本的な検証
      if (!plugin.metadata || !plugin.metadata.name) {
        throw new Error(`Invalid plugin: missing metadata.name`);
      }

      this.loadedPlugins.set(plugin.metadata.name, plugin);

      return plugin;
    } catch (error) {
      throw new Error(
        `Failed to load plugin from package "${packageName}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async unload(pluginName: string): Promise<void> {
    const plugin = this.loadedPlugins.get(pluginName);

    if (!plugin) {
      throw new Error(`Plugin "${pluginName}" is not loaded`);
    }

    // onUnloadフック実行
    if (plugin.onUnload) {
      await plugin.onUnload();
    }

    this.loadedPlugins.delete(pluginName);

    console.log(`✓ Plugin "${pluginName}" unloaded`);
  }

  /**
   * プラグインファイルを読み込み
   */
  private async loadPlugin(pluginPath: string): Promise<Plugin> {
    try {
      // ESMインポートのためにfile://形式のURLに変換
      const fileUrl = pathToFileURL(pluginPath).href;

      const module = await import(fileUrl);

      if (!module.default) {
        throw new Error(`Plugin file "${pluginPath}" does not have a default export`);
      }

      const plugin: Plugin = module.default;

      // 基本的な検証
      this.validatePlugin(plugin);

      return plugin;
    } catch (error) {
      throw new Error(
        `Failed to load plugin from "${pluginPath}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * プラグインの基本検証
   */
  private validatePlugin(plugin: unknown): void {
    const p = plugin as { metadata?: { name?: unknown; version?: unknown; description?: unknown } };
    if (!p.metadata) {
      throw new Error('Plugin missing metadata');
    }

    if (!p.metadata.name) {
      throw new Error('Plugin missing metadata.name');
    }

    if (!p.metadata.version) {
      throw new Error('Plugin missing metadata.version');
    }

    if (!p.metadata.description) {
      throw new Error('Plugin missing metadata.description');
    }
  }

  /**
   * 読み込み済みプラグイン一覧を取得
   */
  getLoadedPlugins(): Plugin[] {
    return Array.from(this.loadedPlugins.values());
  }
}

/**
 * シングルトンインスタンス
 */
let loaderInstance: PluginLoader | null = null;

/**
 * プラグインローダー取得
 */
export function getPluginLoader(): PluginLoader {
  if (!loaderInstance) {
    loaderInstance = new PluginLoaderImpl();
  }
  return loaderInstance;
}
