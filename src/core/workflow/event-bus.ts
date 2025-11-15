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

/**
 * グローバルイベントバス取得
 */
export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}
