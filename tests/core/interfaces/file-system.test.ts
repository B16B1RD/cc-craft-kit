/**
 * file-system.ts (ChokidarWatcherAdapter) のテスト
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ChokidarWatcherAdapter } from '../../../src/core/interfaces/file-system.js';
import type { FSWatcher } from 'chokidar';

describe('ChokidarWatcherAdapter', () => {
  let mockWatcher: jest.Mocked<FSWatcher>;

  beforeEach(() => {
    mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<FSWatcher>;
  });

  test('should create adapter instance', () => {
    const adapter = new ChokidarWatcherAdapter(mockWatcher);

    expect(adapter).toBeDefined();
  });

  test('should forward "change" event to chokidar watcher', () => {
    const adapter = new ChokidarWatcherAdapter(mockWatcher);
    const handler = jest.fn();

    adapter.on('change', handler);

    expect(mockWatcher.on).toHaveBeenCalledWith('change', handler);
  });

  test('should forward "add" event to chokidar watcher', () => {
    const adapter = new ChokidarWatcherAdapter(mockWatcher);
    const handler = jest.fn();

    adapter.on('add', handler);

    expect(mockWatcher.on).toHaveBeenCalledWith('add', handler);
  });

  test('should forward "unlink" event to chokidar watcher', () => {
    const adapter = new ChokidarWatcherAdapter(mockWatcher);
    const handler = jest.fn();

    adapter.on('unlink', handler);

    expect(mockWatcher.on).toHaveBeenCalledWith('unlink', handler);
  });

  test('should forward "error" event to chokidar watcher', () => {
    const adapter = new ChokidarWatcherAdapter(mockWatcher);
    const handler = jest.fn();

    adapter.on('error', handler);

    expect(mockWatcher.on).toHaveBeenCalledWith('error', handler);
  });

  test('should forward "ready" event to chokidar watcher', () => {
    const adapter = new ChokidarWatcherAdapter(mockWatcher);
    const handler = jest.fn();

    adapter.on('ready', handler);

    expect(mockWatcher.on).toHaveBeenCalledWith('ready', handler);
  });

  test('should return this for method chaining', () => {
    const adapter = new ChokidarWatcherAdapter(mockWatcher);
    const handler = jest.fn();

    const result = adapter.on('change', handler);

    expect(result).toBe(adapter);
  });

  test('should close chokidar watcher', async () => {
    const adapter = new ChokidarWatcherAdapter(mockWatcher);

    await adapter.close();

    expect(mockWatcher.close).toHaveBeenCalled();
  });

  test('should chain multiple event listeners', () => {
    const adapter = new ChokidarWatcherAdapter(mockWatcher);
    const changeHandler = jest.fn();
    const addHandler = jest.fn();

    adapter.on('change', changeHandler).on('add', addHandler);

    expect(mockWatcher.on).toHaveBeenCalledTimes(2);
    expect(mockWatcher.on).toHaveBeenCalledWith('change', changeHandler);
    expect(mockWatcher.on).toHaveBeenCalledWith('add', addHandler);
  });
});
