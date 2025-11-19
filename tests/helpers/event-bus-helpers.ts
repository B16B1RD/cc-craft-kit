/**
 * EventBus テストヘルパー
 *
 * テストで使用する EventBus のモック化とイベント待機ユーティリティを提供します。
 */

import { EventBus, WorkflowEvent, WorkflowEventType } from '../../src/core/workflow/event-bus.js';

/**
 * イベント待機ヘルパー
 *
 * 特定のイベントが発火されるまで待機します。
 *
 * @param eventBus - EventBus インスタンス
 * @param eventType - 待機するイベントタイプ
 * @param timeout - タイムアウト時間（ミリ秒、デフォルト: 5000ms）
 * @returns イベントデータ
 */
export function waitForEvent<T = unknown>(
  eventBus: EventBus,
  eventType: WorkflowEventType,
  timeout: number = 5000
): Promise<WorkflowEvent<T>> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventType}`));
    }, timeout);

    const handler = (event: WorkflowEvent<T>) => {
      clearTimeout(timeoutId);
      resolve(event);
    };

    eventBus.on(eventType, handler);
  });
}

/**
 * 複数イベント待機ヘルパー
 *
 * 複数のイベントがすべて発火されるまで待機します。
 *
 * @param eventBus - EventBus インスタンス
 * @param eventTypes - 待機するイベントタイプの配列
 * @param timeout - タイムアウト時間（ミリ秒、デフォルト: 5000ms）
 * @returns イベントデータの配列
 */
export function waitForEvents(
  eventBus: EventBus,
  eventTypes: WorkflowEventType[],
  timeout: number = 5000
): Promise<WorkflowEvent[]> {
  const promises = eventTypes.map((type) => waitForEvent(eventBus, type, timeout));
  return Promise.all(promises);
}

/**
 * イベント発火確認ヘルパー
 *
 * 指定されたイベントが発火されたかどうかを確認します（即座に結果を返す）。
 *
 * @param eventBus - EventBus インスタンス
 * @param eventType - 確認するイベントタイプ
 * @param checkDuration - 確認期間（ミリ秒、デフォルト: 100ms）
 * @returns イベントが発火された場合は true
 */
export async function wasEventEmitted(
  eventBus: EventBus,
  eventType: WorkflowEventType,
  checkDuration: number = 100
): Promise<boolean> {
  return new Promise((resolve) => {
    let emitted = false;

    const handler = () => {
      emitted = true;
    };

    eventBus.on(eventType, handler);

    setTimeout(() => {
      resolve(emitted);
    }, checkDuration);
  });
}

/**
 * イベントスパイヘルパー
 *
 * イベントの発火を記録し、後で検証できるようにします。
 */
export class EventSpy {
  private events: Map<WorkflowEventType, WorkflowEvent[]> = new Map();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * 指定されたイベントタイプの監視を開始
   */
  spy(eventType: WorkflowEventType): void {
    if (!this.events.has(eventType)) {
      this.events.set(eventType, []);
    }

    this.eventBus.on(eventType, (event: WorkflowEvent) => {
      this.events.get(eventType)!.push(event);
    });
  }

  /**
   * 複数のイベントタイプの監視を開始
   */
  spyAll(eventTypes: WorkflowEventType[]): void {
    eventTypes.forEach((type) => this.spy(type));
  }

  /**
   * 指定されたイベントタイプが発火された回数を取得
   */
  getCallCount(eventType: WorkflowEventType): number {
    return this.events.get(eventType)?.length || 0;
  }

  /**
   * 指定されたイベントタイプが発火されたかどうかを確認
   */
  wasCalled(eventType: WorkflowEventType): boolean {
    return this.getCallCount(eventType) > 0;
  }

  /**
   * 指定されたイベントタイプが指定回数発火されたかどうかを確認
   */
  wasCalledTimes(eventType: WorkflowEventType, times: number): boolean {
    return this.getCallCount(eventType) === times;
  }

  /**
   * 指定されたイベントタイプのすべてのイベントデータを取得
   */
  getEvents(eventType: WorkflowEventType): WorkflowEvent[] {
    return this.events.get(eventType) || [];
  }

  /**
   * 指定されたイベントタイプの最後のイベントデータを取得
   */
  getLastEvent(eventType: WorkflowEventType): WorkflowEvent | undefined {
    const events = this.getEvents(eventType);
    return events[events.length - 1];
  }

  /**
   * すべての記録をクリア
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * 指定されたイベントタイプの記録をクリア
   */
  clearEvent(eventType: WorkflowEventType): void {
    this.events.delete(eventType);
  }
}

/**
 * モック EventBus 作成ヘルパー
 *
 * テストで使用する独立した EventBus インスタンスを作成します。
 */
export function createMockEventBus(): EventBus {
  return new EventBus();
}

/**
 * EventBus のイベント発火をモック化
 *
 * テストで EventBus.emit() の呼び出しをモック化します。
 */
export function mockEventBusEmit(eventBus: EventBus): jest.SpyInstance {
  return jest.spyOn(eventBus, 'emit');
}

/**
 * EventBus テストユーティリティ
 *
 * テストで使用する便利なヘルパー関数をまとめたクラス
 */
export class EventBusTestUtils {
  private eventBus: EventBus;
  private spy: EventSpy;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.spy = new EventSpy(eventBus);
  }

  /**
   * イベント待機
   */
  async waitFor<T = unknown>(eventType: WorkflowEventType, timeout?: number): Promise<WorkflowEvent<T>> {
    return waitForEvent<T>(this.eventBus, eventType, timeout);
  }

  /**
   * 複数イベント待機
   */
  async waitForAll(eventTypes: WorkflowEventType[], timeout?: number): Promise<WorkflowEvent[]> {
    return waitForEvents(this.eventBus, eventTypes, timeout);
  }

  /**
   * イベント発火確認
   */
  async wasEmitted(eventType: WorkflowEventType, checkDuration?: number): Promise<boolean> {
    return wasEventEmitted(this.eventBus, eventType, checkDuration);
  }

  /**
   * イベントスパイ取得
   */
  getSpy(): EventSpy {
    return this.spy;
  }

  /**
   * イベントを監視
   */
  spy(eventType: WorkflowEventType): void {
    this.spy.spy(eventType);
  }

  /**
   * 複数のイベントを監視
   */
  spyAll(eventTypes: WorkflowEventType[]): void {
    this.spy.spyAll(eventTypes);
  }

  /**
   * すべての記録をクリア
   */
  clear(): void {
    this.spy.clear();
  }
}

/**
 * EventBus テストユーティリティを作成
 *
 * テストファイルで以下のように使用:
 * ```typescript
 * const eventBus = createMockEventBus();
 * const utils = createEventBusTestUtils(eventBus);
 *
 * // イベント監視
 * utils.spyAll(['spec.created', 'spec.updated']);
 *
 * // テスト実行
 * await createSpec('test-spec');
 *
 * // 検証
 * expect(utils.getSpy().wasCalled('spec.created')).toBe(true);
 * ```
 */
export function createEventBusTestUtils(eventBus: EventBus): EventBusTestUtils {
  return new EventBusTestUtils(eventBus);
}
