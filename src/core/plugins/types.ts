/**
 * プラグインシステム型定義
 */

import { Subagent } from '../subagents/types.js';
import { Skill } from '../skills/types.js';
import type { JSONSchema, JSONValue } from '../types/common.js';

/**
 * プラグインメタデータ
 */
export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  tags?: string[];
  dependencies?: Record<string, string>;
}

/**
 * プラグイン設定
 */
export interface PluginConfig {
  enabled: boolean;
  settings?: Record<string, JSONValue>;
}

/**
 * プラグインライフサイクルフック
 */
export interface PluginHooks {
  onLoad?(): Promise<void>;
  onUnload?(): Promise<void>;
  onConfigChange?(config: PluginConfig): Promise<void>;
}

/**
 * プラグインインターフェース
 */
export interface Plugin extends PluginHooks {
  metadata: PluginMetadata;

  /**
   * プラグインが提供するSubagent
   */
  getSubagents?(): Subagent[];

  /**
   * プラグインが提供するSkill
   */
  getSkills?(): Skill[];

  /**
   * プラグインが提供するカスタムMCPツール
   */
  getMCPTools?(): MCPTool[];

  /**
   * プラグインが提供するイベントハンドラー
   */
  getEventHandlers?(): EventHandler[];
}

/**
 * MCPツール定義
 *
 * MCPツールは、inputSchemaで定義されたパラメータを受け取り、処理を実行するハンドラーです。
 * handlerの型は`unknown`ですが、各プラグインの実装側では具体的な型を使用して型安全性を保証します。
 * inputSchemaにより、実行時にパラメータの検証が行われます。
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: (params: unknown) => Promise<unknown>;
}

/**
 * イベントハンドラー定義
 */
export interface EventHandler<TEventData = unknown> {
  eventType: string;
  handler: (event: TEventData) => Promise<void>;
  priority?: number; // 実行優先度（数値が小さいほど優先）
}

/**
 * プラグインレジストリインターフェース
 */
export interface PluginRegistry {
  /**
   * プラグインを登録
   */
  register(plugin: Plugin, config?: PluginConfig): Promise<void>;

  /**
   * プラグインを登録解除
   */
  unregister(pluginName: string): Promise<void>;

  /**
   * プラグインを取得
   */
  get(pluginName: string): Plugin | undefined;

  /**
   * 全プラグインを取得
   */
  getAll(): Plugin[];

  /**
   * 有効なプラグインを取得
   */
  getEnabled(): Plugin[];

  /**
   * プラグインの有効/無効を切り替え
   */
  setEnabled(pluginName: string, enabled: boolean): Promise<void>;

  /**
   * プラグイン設定を更新
   */
  updateConfig(pluginName: string, config: PluginConfig): Promise<void>;
}

/**
 * プラグインローダーインターフェース
 */
export interface PluginLoader {
  /**
   * ディレクトリからプラグインを読み込み
   */
  loadFromDirectory(directory: string): Promise<Plugin[]>;

  /**
   * npmパッケージからプラグインを読み込み
   */
  loadFromPackage(packageName: string): Promise<Plugin>;

  /**
   * プラグインをアンロード
   */
  unload(pluginName: string): Promise<void>;
}

/**
 * プラグイン検証結果
 */
export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * プラグインバリデーター
 */
export interface PluginValidator {
  /**
   * プラグインを検証
   */
  validate(plugin: Plugin): PluginValidationResult;
}
