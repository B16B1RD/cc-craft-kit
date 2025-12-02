import EventEmitter from 'events';
import type { Metadata } from '../types/common.js';

/**
 * ワークフローイベント型
 */
export type WorkflowEventType =
  | 'spec.created'
  | 'spec.updated'
  | 'spec.deleted'
  | 'spec.phase_changed'
  | 'spec.pr_merged'
  | 'task.created'
  | 'task.started'
  | 'task.status_changed'
  | 'task.completed'
  | 'github.issue_created'
  | 'github.issue_updated'
  | 'knowledge.progress_recorded'
  | 'knowledge.error_recorded'
  | 'knowledge.tip_recorded'
  | 'subagent.started'
  | 'subagent.completed'
  | 'subagent.failed'
  | 'skill.executed';

/**
 * ワークフローイベント
 */
export interface WorkflowEvent<T = unknown> {
  type: WorkflowEventType;
  timestamp: string;
  specId: string;
  taskId?: string;
  data: T;
  metadata?: Metadata;
}

/**
 * イベントハンドラー
 */
export type EventHandler<T = unknown> = (event: WorkflowEvent<T>) => Promise<void> | void;

/**
 * イベントバスインターフェース（モック化用）
 */
export interface IEventBus {
  emit<T = unknown>(event: WorkflowEvent<T>): Promise<void>;
  on<T = unknown>(eventType: WorkflowEventType, handler: EventHandler<T>): void;
  off<T = unknown>(eventType: WorkflowEventType, handler: EventHandler<T>): void;
  createEvent<T = unknown>(
    type: WorkflowEventType,
    specId: string,
    data: T,
    taskId?: string
  ): WorkflowEvent<T>;
}

/**
 * ナレッジベースイベントデータ型
 */

/** 進捗記録イベント */
export interface ProgressRecordedData {
  message: string;
  details?: string;
  timestamp: string;
}

/** エラー記録イベント */
export interface ErrorRecordedData {
  errorDescription: string;
  solution: string;
  timestamp: string;
}

/** Tips記録イベント */
export interface TipRecordedData {
  category: string;
  title: string;
  content: string;
  timestamp: string;
}

/** フェーズ変更イベント */
export interface PhaseChangedData {
  specId: string;
  oldPhase: string;
  newPhase: string;
}

export type PhaseChangedEvent = WorkflowEvent<PhaseChangedData>;

/** PR マージイベント */
export interface PrMergedData {
  prNumber: number;
  branchName: string;
  mergedAt: string | null;
}

export type PrMergedEvent = WorkflowEvent<PrMergedData>;

/**
 * イベントバス実装
 */
export class EventBus implements IEventBus {
  private emitter: EventEmitter;
  private handlers: Map<WorkflowEventType, Set<EventHandler>> = new Map();

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // 多数のハンドラー対応
  }

  /**
   * イベント発行
   */
  async emit<T = unknown>(event: WorkflowEvent<T>): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // 全ハンドラーを並列実行
    const promises = Array.from(handlers).map((handler) =>
      Promise.resolve(handler(event)).catch((error) => {
        console.error(`Error in event handler for ${event.type}:`, error);
      })
    );

    await Promise.all(promises);
  }

  /**
   * イベントハンドラー登録
   */
  on<T = unknown>(eventType: WorkflowEventType, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);
  }

  /**
   * イベントハンドラー削除
   */
  off<T = unknown>(eventType: WorkflowEventType, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler as EventHandler);
    }
  }

  /**
   * 全ハンドラークリア
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * イベント作成ヘルパー
   */
  createEvent<T = unknown>(
    type: WorkflowEventType,
    specId: string,
    data: T,
    taskId?: string
  ): WorkflowEvent<T> {
    return {
      type,
      timestamp: new Date().toISOString(),
      specId,
      taskId,
      data,
    };
  }
}

/**
 * グローバルイベントバスインスタンス
 */
let eventBusInstance: EventBus | null = null;
let handlersRegistered = false;
let registrationInProgress = false;

/**
 * 統合ハンドラーを登録（非同期）
 * エラーが発生しても処理を継続する
 */
async function registerHandlersAsync(bus: EventBus): Promise<void> {
  if (handlersRegistered || registrationInProgress) {
    return;
  }

  // テスト環境では統合ハンドラーをスキップ
  if (process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true') {
    handlersRegistered = true;
    return;
  }

  registrationInProgress = true;

  try {
    const { getDatabase } = await import('../database/connection.js');
    const { registerGitHubIntegrationHandlers } = await import('./github-integration.js');
    const { registerGitIntegrationHandlers } = await import('./git-integration.js');
    const { registerBranchManagementHandlers } = await import('./branch-management.js');
    const { registerPhaseAutomationHandlers } = await import('./phase-automation-registration.js');

    const db = getDatabase();
    registerGitHubIntegrationHandlers(bus, db);
    registerGitIntegrationHandlers(bus, db);
    registerBranchManagementHandlers(bus, db);
    registerPhaseAutomationHandlers(bus, db);
    handlersRegistered = true;
  } catch (error) {
    // データベース未初期化、モジュール未存在などのエラーはスキップ
    // プロジェクト未初期化の場合は正常動作
    if (process.env.DEBUG) {
      console.warn('Failed to register handlers:', error);
    }
    handlersRegistered = true; // エラーでも再試行しない
  } finally {
    registrationInProgress = false;
  }
}

/**
 * グローバルイベントバス取得
 * 初回呼び出し時に統合ハンドラーを自動登録（非同期）
 */
export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }

  // 初回のみハンドラー登録を開始（非同期、待機しない）
  if (!handlersRegistered && !registrationInProgress) {
    registerHandlersAsync(eventBusInstance).catch(() => {
      // エラーは registerHandlersAsync 内で処理済み
    });
  }

  return eventBusInstance;
}

/**
 * グローバルイベントバス取得（ハンドラー登録を待機）
 * イベント発火前にハンドラー登録を完了させたい場合に使用
 *
 * @param {number} timeoutMs - タイムアウト時間（ミリ秒）。デフォルトは10秒。
 * @returns {Promise<EventBus>} EventBusインスタンス
 * @throws {Error} ハンドラー登録がタイムアウトした場合
 */
export async function getEventBusAsync(timeoutMs: number = 10000): Promise<EventBus> {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }

  // ハンドラー登録を待機
  if (!handlersRegistered && !registrationInProgress) {
    await registerHandlersAsync(eventBusInstance);
  } else if (registrationInProgress) {
    // 登録中の場合は完了まで待機（タイムアウト付き）
    const startTime = Date.now();
    while (registrationInProgress) {
      if (Date.now() - startTime > timeoutMs) {
        const errorMessage = `Handler registration timeout after ${timeoutMs}ms`;
        console.error(`[EventBus] ${errorMessage}`);
        throw new Error(errorMessage);
      }
      await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
    }
  }

  return eventBusInstance;
}
