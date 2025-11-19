/**
 * EventBus モックファクトリーを使用した単体テスト
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createMockEventBus, WorkflowEventBuilder } from '../../helpers/index.js';

describe('EventBus Mock Factory', () => {
  let mockEventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    mockEventBus = createMockEventBus();
  });

  describe('emit', () => {
    test('should emit events successfully', async () => {
      const event = new WorkflowEventBuilder()
        .withType('spec.created')
        .withSpecId('test-spec-id')
        .withData({ name: 'Test Spec' })
        .build();

      await mockEventBus.emit(event);

      expect(mockEventBus.emit).toHaveBeenCalledWith(event);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
    });

    test('should handle multiple events', async () => {
      const event1 = new WorkflowEventBuilder()
        .withType('spec.created')
        .withSpecId('spec-1')
        .withData({ name: 'Spec 1' })
        .build();

      const event2 = new WorkflowEventBuilder()
        .withType('spec.updated')
        .withSpecId('spec-2')
        .withData({ name: 'Spec 2' })
        .build();

      await mockEventBus.emit(event1);
      await mockEventBus.emit(event2);

      expect(mockEventBus.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe('on', () => {
    test('should register event handlers', () => {
      const handler = jest.fn();

      mockEventBus.on('spec.created', handler);

      expect(mockEventBus.on).toHaveBeenCalledWith('spec.created', handler);
    });
  });

  describe('createEvent', () => {
    test('should create events with correct structure', () => {
      const event = mockEventBus.createEvent('task.created', 'spec-123', { title: 'Test Task' });

      expect(event).toEqual({
        type: 'task.created',
        timestamp: expect.any(String),
        specId: 'spec-123',
        taskId: undefined,
        data: { title: 'Test Task' },
      });
    });

    test('should create events with taskId', () => {
      const event = mockEventBus.createEvent(
        'task.completed',
        'spec-456',
        { status: 'done' },
        'task-789'
      );

      expect(event).toEqual({
        type: 'task.completed',
        timestamp: expect.any(String),
        specId: 'spec-456',
        taskId: 'task-789',
        data: { status: 'done' },
      });
    });
  });
});
