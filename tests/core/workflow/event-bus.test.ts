/**
 * EventBus テスト
 */
import { EventBus } from '../../../src/core/workflow/event-bus.js';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.clear();
  });

  test('イベント発行と受信', async () => {
    const mockHandler = jest.fn();

    eventBus.on('spec.created', mockHandler);

    const event = eventBus.createEvent('spec.created', 'spec-1', { name: 'Test Spec' });
    await eventBus.emit(event);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(event);
  });

  test('複数ハンドラー登録', async () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    eventBus.on('task.completed', handler1);
    eventBus.on('task.completed', handler2);

    const event = eventBus.createEvent('task.completed', 'spec-1', {}, 'task-1');
    await eventBus.emit(event);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  test('ハンドラー削除', async () => {
    const handler = jest.fn();

    eventBus.on('spec.updated', handler);
    eventBus.off('spec.updated', handler);

    const event = eventBus.createEvent('spec.updated', 'spec-1', {});
    await eventBus.emit(event);

    expect(handler).not.toHaveBeenCalled();
  });

  test('イベント作成ヘルパー', () => {
    const event = eventBus.createEvent('spec.created', 'spec-123', { test: 'data' });

    expect(event.type).toBe('spec.created');
    expect(event.specId).toBe('spec-123');
    expect(event.data).toEqual({ test: 'data' });
    expect(event.timestamp).toBeDefined();
  });

  test('エラーハンドリング（ハンドラーがエラーを投げても継続）', async () => {
    // console.errorをモック
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const errorHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
    const successHandler = jest.fn();

    eventBus.on('spec.created', errorHandler);
    eventBus.on('spec.created', successHandler);

    const event = eventBus.createEvent('spec.created', 'spec-1', {});
    await eventBus.emit(event);

    expect(errorHandler).toHaveBeenCalled();
    expect(successHandler).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
