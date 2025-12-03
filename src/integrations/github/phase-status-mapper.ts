/**
 * フェーズ→ステータスマッピング
 *
 * 仕様書フェーズを GitHub Projects のステータスにマッピングする機能を提供。
 * DynamicStatusMapper を使用すると、config.json で設定された
 * カスタムマッピングを使用できます。
 */

import {
  type GitHubStatusConfig,
  loadStatusConfig,
  getStatusForPhase,
  getStatusWithFallback,
  DEFAULT_STATUS_CONFIG,
} from '../../core/config/github-status-config.js';
import type { SpecPhase } from '../../database/types.js';

// ============================================================================
// 後方互換用の型・関数
// ============================================================================

export type Phase = 'requirements' | 'design' | 'tasks' | 'implementation' | 'completed';

/**
 * @deprecated 3 段階ステータス型。4 段階ステータスを使用してください。
 */
export type ProjectStatus = 'Todo' | 'In Progress' | 'Done';

/**
 * 4 段階ステータス型（In Review を含む）
 */
export type ExtendedProjectStatus = 'Todo' | 'In Progress' | 'In Review' | 'Done';

/**
 * 仕様書のフェーズを GitHub Project のステータスにマッピング
 *
 * @deprecated DynamicStatusMapper.mapPhaseToStatus() を使用してください。
 * この関数は後方互換性のために維持されています。
 */
export function mapPhaseToStatus(phase: Phase): ProjectStatus {
  const mapping: Record<Phase, ProjectStatus> = {
    requirements: 'Todo',
    design: 'In Progress',
    tasks: 'In Progress',
    implementation: 'In Progress',
    completed: 'Done',
  };

  return mapping[phase];
}

/**
 * 文字列が有効な ProjectStatus（3 段階）かを判定する型ガード
 *
 * @deprecated isExtendedProjectStatus() を使用してください。
 */
export function isProjectStatus(value: string): value is ProjectStatus {
  return value === 'Todo' || value === 'In Progress' || value === 'Done';
}

/**
 * 文字列が有効な ExtendedProjectStatus（4 段階）かを判定する型ガード
 */
export function isExtendedProjectStatus(value: string): value is ExtendedProjectStatus {
  return value === 'Todo' || value === 'In Progress' || value === 'In Review' || value === 'Done';
}

// ============================================================================
// DynamicStatusMapper クラス
// ============================================================================

/**
 * 動的ステータスマッパー
 *
 * config.json の設定に基づいて、仕様書フェーズを GitHub Projects の
 * ステータスに動的にマッピングします。
 *
 * @example
 * ```typescript
 * // デフォルト設定で使用
 * const mapper = DynamicStatusMapper.create();
 * const status = mapper.mapPhaseToStatus('implementation'); // "In Review"
 *
 * // カスタム設定で使用
 * const customMapper = new DynamicStatusMapper(customConfig);
 * ```
 */
export class DynamicStatusMapper {
  private readonly config: GitHubStatusConfig;

  /**
   * コンストラクタ
   *
   * @param config ステータス設定（省略時はデフォルト設定を使用）
   */
  constructor(config?: GitHubStatusConfig) {
    this.config = config ?? DEFAULT_STATUS_CONFIG;
  }

  /**
   * config.json から設定を読み込んでインスタンスを作成
   *
   * @param basePath プロジェクトのベースパス
   * @returns DynamicStatusMapper インスタンス
   */
  static create(basePath?: string): DynamicStatusMapper {
    const config = loadStatusConfig(basePath);
    return new DynamicStatusMapper(config);
  }

  /**
   * フェーズをステータスにマッピング
   *
   * 設定されたマッピングに基づいてステータスを返す
   *
   * @param phase 仕様書フェーズ
   * @returns 対応するステータス名
   */
  mapPhaseToStatus(phase: SpecPhase): string {
    return getStatusForPhase(phase, this.config);
  }

  /**
   * フェーズをステータスにマッピング（フォールバック付き）
   *
   * マッピングされたステータスが availableStatuses に存在しない場合、
   * フォールバックステータスを返す
   *
   * @param phase 仕様書フェーズ
   * @returns 利用可能なステータス名
   */
  mapPhaseToStatusWithFallback(phase: SpecPhase): string {
    return getStatusWithFallback(phase, this.config);
  }

  /**
   * 指定されたステータスが利用可能かどうかを確認
   *
   * @param status 確認するステータス
   * @returns 利用可能な場合は true
   */
  isStatusAvailable(status: string): boolean {
    return this.config.availableStatuses.includes(status);
  }

  /**
   * ステータスフィールド名を取得
   *
   * @returns ステータスフィールド名
   */
  getStatusFieldName(): string {
    return this.config.statusFieldName;
  }

  /**
   * 利用可能なステータス一覧を取得
   *
   * @returns ステータス名の配列
   */
  getAvailableStatuses(): string[] {
    return [...this.config.availableStatuses];
  }

  /**
   * フォールバックステータスを取得
   *
   * @returns フォールバックステータス名
   */
  getFallbackStatus(): string {
    return this.config.fallbackStatus;
  }

  /**
   * 現在の設定を取得
   *
   * @returns ステータス設定のコピー
   */
  getConfig(): GitHubStatusConfig {
    return { ...this.config };
  }
}
