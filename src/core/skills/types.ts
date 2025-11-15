/**
 * Skill型定義
 */

import type { Metadata } from '../types/common.js';

/**
 * Skillの実行コンテキスト
 */
export interface SkillContext {
  specId: string;
  taskId?: string;
  userId?: string;
  metadata?: Metadata;
}

/**
 * Skillの実行結果
 */
export interface SkillResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  artifacts?: SkillArtifact[];
}

/**
 * Skillが生成する成果物
 */
export interface SkillArtifact {
  type: 'document' | 'code' | 'diagram' | 'data';
  name: string;
  path?: string;
  content?: string;
  metadata?: Metadata;
}

/**
 * Skill基底インターフェース
 */
export interface Skill<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  version: string;
  category: SkillCategory;

  /**
   * Skill実行
   */
  execute(input: TInput, context: SkillContext): Promise<SkillResult<TOutput>>;

  /**
   * 入力バリデーション
   */
  validate(input: TInput): Promise<boolean>;

  /**
   * Skill初期化
   */
  initialize?(): Promise<void>;

  /**
   * クリーンアップ
   */
  cleanup?(): Promise<void>;

  /**
   * Progressive Disclosure用の概要取得
   */
  getSummary?(): string;
}

/**
 * Skillカテゴリ
 */
export type SkillCategory =
  | 'requirements'
  | 'design'
  | 'implementation'
  | 'testing'
  | 'documentation'
  | 'analysis'
  | 'integration';

/**
 * Skillレジストリインターフェース
 */
export interface SkillRegistry {
  /**
   * Skill登録
   */
  register(skill: Skill): void;

  /**
   * Skill取得
   */
  get(name: string): Skill | undefined;

  /**
   * カテゴリ別Skill取得
   */
  getByCategory(category: SkillCategory): Skill[];

  /**
   * 全Skill取得
   */
  list(): Skill[];

  /**
   * Skill存在確認
   */
  has(name: string): boolean;

  /**
   * Skill削除
   */
  unregister(name: string): void;
}

/**
 * Skill実行履歴
 */
export interface SkillExecution {
  id: string;
  skillName: string;
  input: unknown;
  output?: unknown;
  error?: string;
  artifacts?: SkillArtifact[];
  startedAt: string;
  completedAt?: string;
  duration?: number;
  context: SkillContext;
}
