/**
 * Subagent型定義
 */

import type { Metadata } from '../types/common.js';

/**
 * Subagentの実行コンテキスト
 */
export interface SubagentContext {
  specId: string;
  taskId?: string;
  phase: string;
  metadata?: Metadata;
}

/**
 * Subagentの実行結果
 */
export interface SubagentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  logs?: string[];
  nextActions?: string[];
}

/**
 * Subagent基底インターフェース
 */
export interface Subagent<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  version: string;

  /**
   * Subagent実行
   */
  execute(input: TInput, context: SubagentContext): Promise<SubagentResult<TOutput>>;

  /**
   * 入力バリデーション
   */
  validate(input: TInput): Promise<boolean>;

  /**
   * Subagent初期化
   */
  initialize?(): Promise<void>;

  /**
   * クリーンアップ
   */
  cleanup?(): Promise<void>;
}

/**
 * Subagent実行ステータス
 */
export type SubagentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Subagent実行履歴
 */
export interface SubagentExecution {
  id: string;
  subagentName: string;
  status: SubagentStatus;
  input: unknown;
  output?: unknown;
  error?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  context: SubagentContext;
}

/**
 * Subagentレジストリインターフェース
 */
export interface SubagentRegistry {
  /**
   * Subagent登録
   */
  register(subagent: Subagent): void;

  /**
   * Subagent取得
   */
  get(name: string): Subagent | undefined;

  /**
   * 全Subagent取得
   */
  list(): Subagent[];

  /**
   * Subagent存在確認
   */
  has(name: string): boolean;

  /**
   * Subagent削除
   */
  unregister(name: string): void;
}
