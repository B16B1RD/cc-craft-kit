import EventEmitter from 'events';
import type { Metadata } from '../types/common.js';

/**
 * ワークフローイベント型
 */
export type WorkflowEventType =
  | 'spec.created'
  | 'spec.updated'
  | 'spec.phase_changed'
  | 'task.created'
  | 'task.status_changed'
  | 'task.completed'
  | 'github.issue_created'
  | 'github.issue_updated'
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
 * イベントバス実装
 */
export class EventBus {
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

  registrationInProgress = true;

  try {
    const { getDatabase } = await import('../database/connection.js');
    const { registerGitHubIntegrationHandlers } = await import('./github-integration.js');
    const { registerGitIntegrationHandlers } = await import('./git-integration.js');

    const db = getDatabase();
    registerGitHubIntegrationHandlers(bus, db);
    registerGitIntegrationHandlers(bus, db);
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
 */
export async function getEventBusAsync(): Promise<EventBus> {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }

  // ハンドラー登録を待機
  if (!handlersRegistered && !registrationInProgress) {
    await registerHandlersAsync(eventBusInstance);
  } else if (registrationInProgress) {
    // 登録中の場合は完了まで待機
    while (registrationInProgress) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
    }
  }

  return eventBusInstance;
}
