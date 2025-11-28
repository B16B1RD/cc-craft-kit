/**
 * task/done.ts コマンドのテスト
 *
 * EventBus の直接テストのみを実施
 * (done.ts は import.meta.url を使用しているため Jest では直接インポート不可)
 */
import 'reflect-metadata';
import { describe, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { EventBus, WorkflowEvent } from '../../../src/core/workflow/event-bus.js';

describe('EventBus 統合テスト', () => {
  let lifecycle: DatabaseLifecycle;
  let eventBus: EventBus;
  let capturedEvents: WorkflowEvent<{ taskId: string }>[];

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
    eventBus = new EventBus();
    capturedEvents = [];

    // task.completed イベントをキャプチャ
    eventBus.on<{ taskId: string }>('task.completed', async (event) => {
      capturedEvents.push(event);
    });
  });

  afterEach(async () => {
    eventBus.clear();
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  it('task.completed イベントが正しく発火される', async () => {
    const taskId = randomUUID();
    const specId = randomUUID();

    const event = eventBus.createEvent<{ taskId: string }>(
      'task.completed',
      specId,
      { taskId },
      taskId
    );

    await eventBus.emit(event);

    expect(capturedEvents).toHaveLength(1);
    expect(capturedEvents[0].type).toBe('task.completed');
    expect(capturedEvents[0].specId).toBe(specId);
    expect(capturedEvents[0].taskId).toBe(taskId);
    expect(capturedEvents[0].data.taskId).toBe(taskId);
  });

  it('複数のハンドラーが登録されている場合、すべて実行される', async () => {
    const handler1Results: string[] = [];
    const handler2Results: string[] = [];

    eventBus.on<{ taskId: string }>('task.completed', async (event) => {
      handler1Results.push(event.data.taskId);
    });

    eventBus.on<{ taskId: string }>('task.completed', async (event) => {
      handler2Results.push(event.data.taskId);
    });

    const taskId = randomUUID();
    const event = eventBus.createEvent<{ taskId: string }>(
      'task.completed',
      'spec-1',
      { taskId },
      taskId
    );

    await eventBus.emit(event);

    // 最初に登録したハンドラーの結果を含めて3つ
    expect(capturedEvents).toHaveLength(1);
    expect(handler1Results).toHaveLength(1);
    expect(handler2Results).toHaveLength(1);
    expect(handler1Results[0]).toBe(taskId);
    expect(handler2Results[0]).toBe(taskId);
  });
});
