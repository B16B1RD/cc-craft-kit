/**
 * GitHub ステータス設定管理
 *
 * GitHub Projects のステータス（Todo, In Progress, In Review, Done）と
 * 仕様書フェーズ（requirements, design, implementation, completed）の
 * マッピングを管理します。
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SpecPhase } from '../database/schema.js';

// ============================================================================
// 型定義
// ============================================================================

/**
 * フェーズ → ステータス マッピング
 *
 * 仕様書の各フェーズを GitHub Projects のどのステータスに対応させるかを定義
 */
export interface StatusMapping {
  /** requirements フェーズのステータス（デフォルト: "Todo"） */
  requirements: string;
  /** design フェーズのステータス（デフォルト: "In Progress"） */
  design: string;
  /** tasks フェーズのステータス（デフォルト: "In Progress"、非推奨） */
  tasks: string;
  /** implementation フェーズのステータス（デフォルト: "In Review"） */
  implementation: string;
  /** completed フェーズのステータス（デフォルト: "Done"） */
  completed: string;
}

/**
 * GitHub ステータス設定
 *
 * GitHub Projects との連携に必要なステータス関連の設定を保持
 */
export interface GitHubStatusConfig {
  /** ステータスフィールド名（デフォルト: "Status"） */
  statusFieldName: string;
  /** フェーズ → ステータス名 マッピング */
  statusMapping: StatusMapping;
  /** 利用可能なステータス一覧（GitHub Projects から自動検出） */
  availableStatuses: string[];
  /** フォールバック先ステータス（指定ステータスが存在しない場合） */
  fallbackStatus: string;
  /** 初期化時に自動検出するか */
  autoDetect: boolean;
  /** キャッシュ日時（ISO 8601 形式） */
  cachedAt: string | null;
}

// ============================================================================
// デフォルト設定
// ============================================================================

/**
 * デフォルトのステータスマッピング
 *
 * 4 段階ステータスモデル: Todo → In Progress → In Review → Done
 */
export const DEFAULT_STATUS_MAPPING: StatusMapping = {
  requirements: 'Todo',
  design: 'In Progress',
  tasks: 'In Progress', // 非推奨フェーズ
  implementation: 'In Review',
  completed: 'Done',
};

/**
 * デフォルトのステータス設定
 */
export const DEFAULT_STATUS_CONFIG: GitHubStatusConfig = {
  statusFieldName: 'Status',
  statusMapping: { ...DEFAULT_STATUS_MAPPING },
  availableStatuses: ['Todo', 'In Progress', 'In Review', 'Done'],
  fallbackStatus: 'In Progress',
  autoDetect: true,
  cachedAt: null,
};

// ============================================================================
// 後方互換性のための 3 段階ステータス設定
// ============================================================================

/**
 * 3 段階ステータス用のマッピング（後方互換）
 *
 * In Review が存在しないプロジェクト向け
 */
export const LEGACY_3_STAGE_STATUS_MAPPING: StatusMapping = {
  requirements: 'Todo',
  design: 'In Progress',
  tasks: 'In Progress',
  implementation: 'In Progress', // In Review がない場合は In Progress
  completed: 'Done',
};

/**
 * 3 段階ステータス用の設定（後方互換）
 */
export const LEGACY_3_STAGE_STATUS_CONFIG: GitHubStatusConfig = {
  statusFieldName: 'Status',
  statusMapping: { ...LEGACY_3_STAGE_STATUS_MAPPING },
  availableStatuses: ['Todo', 'In Progress', 'Done'],
  fallbackStatus: 'In Progress',
  autoDetect: true,
  cachedAt: null,
};

// ============================================================================
// 設定読み込み
// ============================================================================

/**
 * config.json の型定義（statusConfig 部分のみ）
 */
interface ConfigJson {
  github?: {
    statusConfig?: Partial<GitHubStatusConfig>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * config.json からステータス設定を読み込む
 *
 * - config.json が存在しない場合はデフォルト設定を返す
 * - statusConfig セクションが存在しない場合はデフォルト設定を返す
 * - 部分的な設定はデフォルト設定とマージして返す
 *
 * @param basePath プロジェクトのベースパス（デフォルト: process.cwd()）
 * @returns ステータス設定
 */
export function loadStatusConfig(basePath: string = process.cwd()): GitHubStatusConfig {
  const configPath = join(basePath, '.cc-craft-kit', 'config.json');

  // config.json が存在しない場合はデフォルト設定を返す
  if (!existsSync(configPath)) {
    return { ...DEFAULT_STATUS_CONFIG };
  }

  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const config: ConfigJson = JSON.parse(configContent);

    // github.statusConfig が存在しない場合はデフォルト設定を返す
    const statusConfig = config.github?.statusConfig;
    if (!statusConfig) {
      return { ...DEFAULT_STATUS_CONFIG };
    }

    // 部分的な設定をデフォルトとマージ
    return mergeStatusConfig(statusConfig);
  } catch {
    // パースエラー時はデフォルト設定を返す
    return { ...DEFAULT_STATUS_CONFIG };
  }
}

/**
 * 部分的なステータス設定をデフォルト設定とマージ
 *
 * @param partial 部分的なステータス設定
 * @returns 完全なステータス設定
 */
export function mergeStatusConfig(partial: Partial<GitHubStatusConfig>): GitHubStatusConfig {
  // statusMapping のマージ
  const statusMapping: StatusMapping = {
    ...DEFAULT_STATUS_MAPPING,
    ...(partial.statusMapping ?? {}),
  };

  return {
    statusFieldName: partial.statusFieldName ?? DEFAULT_STATUS_CONFIG.statusFieldName,
    statusMapping,
    availableStatuses: partial.availableStatuses ?? DEFAULT_STATUS_CONFIG.availableStatuses,
    fallbackStatus: partial.fallbackStatus ?? DEFAULT_STATUS_CONFIG.fallbackStatus,
    autoDetect: partial.autoDetect ?? DEFAULT_STATUS_CONFIG.autoDetect,
    cachedAt: partial.cachedAt ?? DEFAULT_STATUS_CONFIG.cachedAt,
  };
}

// ============================================================================
// バリデーション
// ============================================================================

/**
 * バリデーション結果
 */
export interface ValidationResult {
  /** バリデーション成功かどうか */
  valid: boolean;
  /** エラーメッセージ一覧 */
  errors: string[];
  /** 警告メッセージ一覧 */
  warnings: string[];
}

/**
 * ステータス設定のバリデーション
 *
 * 以下の項目を検証:
 * - statusFieldName が空でないこと
 * - statusMapping の全フェーズが設定されていること
 * - availableStatuses が空でないこと
 * - fallbackStatus が availableStatuses に含まれていること
 * - statusMapping の各ステータスが availableStatuses に含まれていること（警告）
 *
 * @param config バリデーション対象の設定
 * @returns バリデーション結果
 */
export function validateStatusConfig(config: GitHubStatusConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // statusFieldName のバリデーション
  if (!config.statusFieldName || config.statusFieldName.trim() === '') {
    errors.push('statusFieldName は空にできません');
  }

  // statusMapping のバリデーション
  const requiredPhases: SpecPhase[] = [
    'requirements',
    'design',
    'tasks',
    'implementation',
    'completed',
  ];
  for (const phase of requiredPhases) {
    if (!config.statusMapping[phase] || config.statusMapping[phase].trim() === '') {
      errors.push(`statusMapping.${phase} は空にできません`);
    }
  }

  // availableStatuses のバリデーション
  if (!config.availableStatuses || config.availableStatuses.length === 0) {
    errors.push('availableStatuses は少なくとも 1 つのステータスが必要です');
  }

  // fallbackStatus のバリデーション
  if (!config.fallbackStatus || config.fallbackStatus.trim() === '') {
    errors.push('fallbackStatus は空にできません');
  } else if (
    config.availableStatuses &&
    !config.availableStatuses.includes(config.fallbackStatus)
  ) {
    errors.push(
      `fallbackStatus "${config.fallbackStatus}" は availableStatuses に含まれていません`
    );
  }

  // statusMapping のステータスが availableStatuses に含まれているか（警告）
  if (config.availableStatuses && config.availableStatuses.length > 0) {
    for (const phase of requiredPhases) {
      const status = config.statusMapping[phase];
      if (status && !config.availableStatuses.includes(status)) {
        warnings.push(
          `statusMapping.${phase} = "${status}" は availableStatuses に含まれていません。フォールバックが適用されます。`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 設定を読み込んでバリデーション
 *
 * @param basePath プロジェクトのベースパス
 * @returns バリデーション結果と設定
 */
export function loadAndValidateStatusConfig(basePath: string = process.cwd()): {
  config: GitHubStatusConfig;
  validation: ValidationResult;
} {
  const config = loadStatusConfig(basePath);
  const validation = validateStatusConfig(config);
  return { config, validation };
}

// ============================================================================
// 型ガード・ユーティリティ
// ============================================================================

/**
 * 文字列が有効な SpecPhase かを判定する型ガード
 */
export function isValidPhase(value: string): value is SpecPhase {
  return ['requirements', 'design', 'tasks', 'implementation', 'completed'].includes(value);
}

/**
 * ステータス設定からフェーズに対応するステータスを取得
 *
 * @param phase 仕様書フェーズ
 * @param config ステータス設定（省略時はデフォルト設定を使用）
 * @returns 対応するステータス名
 */
export function getStatusForPhase(phase: SpecPhase, config?: GitHubStatusConfig): string {
  const mapping = config?.statusMapping ?? DEFAULT_STATUS_MAPPING;
  return mapping[phase];
}

/**
 * 指定されたステータスが利用可能かどうかを確認
 *
 * @param status 確認するステータス
 * @param config ステータス設定
 * @returns 利用可能な場合は true
 */
export function isStatusAvailable(status: string, config: GitHubStatusConfig): boolean {
  return config.availableStatuses.includes(status);
}

/**
 * フォールバック付きでステータスを取得
 *
 * 指定されたステータスが利用可能でない場合、フォールバックステータスを返す
 *
 * @param phase 仕様書フェーズ
 * @param config ステータス設定
 * @returns 利用可能なステータス名
 */
export function getStatusWithFallback(phase: SpecPhase, config: GitHubStatusConfig): string {
  const status = getStatusForPhase(phase, config);

  if (isStatusAvailable(status, config)) {
    return status;
  }

  // フォールバック
  return config.fallbackStatus;
}
