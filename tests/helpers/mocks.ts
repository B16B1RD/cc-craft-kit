/**
 * テストモックファクトリー
 *
 * Jest テスト用のモックオブジェクト生成ヘルパー
 */

import { Octokit } from '@octokit/rest';
import type { IGitHubClient } from '../../src/integrations/github/client.js';
import type { IEventBus, WorkflowEvent, WorkflowEventType } from '../../src/core/workflow/event-bus.js';
import type { IFileSystem, IFileWatcher, IFileWatcherInstance } from '../../src/core/interfaces/file-system.js';

/**
 * モック GitHubClient ファクトリー
 */
export function createMockGitHubClient(): jest.Mocked<IGitHubClient> {
  const mockRest = {
    issues: {
      create: jest.fn(),
      update: jest.fn(),
      get: jest.fn(),
      listForRepo: jest.fn(),
      createComment: jest.fn(),
    },
    pulls: {
      create: jest.fn(),
    },
    users: {
      getAuthenticated: jest.fn(),
    },
  } as unknown as Octokit;

  return {
    rest: mockRest,
    query: jest.fn(),
    verifyAuth: jest.fn(),
  };
}

/**
 * モック EventBus ファクトリー
 */
export function createMockEventBus(): jest.Mocked<IEventBus> {
  return {
    emit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
    createEvent: jest.fn().mockImplementation((type, specId, data, taskId) => ({
      type,
      timestamp: new Date().toISOString(),
      specId,
      taskId,
      data,
    })),
  };
}

/**
 * モック FileWatcher インスタンスファクトリー
 */
export function createMockFileWatcherInstance(): jest.Mocked<IFileWatcherInstance> {
  const mockInstance = {
    on: jest.fn().mockReturnThis(),
    close: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<IFileWatcherInstance>;

  return mockInstance;
}

/**
 * モック FileWatcher ファクトリー
 */
export function createMockFileWatcher(): jest.Mocked<IFileWatcher> {
  const mockInstance = createMockFileWatcherInstance();

  return {
    watch: jest.fn().mockReturnValue(mockInstance),
  };
}

/**
 * モック FileSystem ファクトリー
 */
export function createMockFileSystem(options?: { exists?: boolean }): jest.Mocked<IFileSystem> {
  const mockWatcher = createMockFileWatcher();

  return {
    exists: jest.fn().mockReturnValue(options?.exists ?? true),
    getWatcher: jest.fn().mockReturnValue(mockWatcher),
  };
}

/**
 * モック Kysely Database ファクトリー
 */
export function createMockDatabase(): any {
  const mockResult = {
    executeTakeFirst: jest.fn(),
    execute: jest.fn(),
  };

  const mockQuery = {
    where: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    selectAll: jest.fn().mockReturnValue(mockResult),
    select: jest.fn().mockReturnThis(),
    executeTakeFirst: jest.fn(),
    execute: jest.fn(),
  };

  return {
    selectFrom: jest.fn().mockReturnValue(mockQuery),
    insertInto: jest.fn().mockReturnValue(mockQuery),
    updateTable: jest.fn().mockReturnValue(mockQuery),
    deleteFrom: jest.fn().mockReturnValue(mockQuery),
  };
}

/**
 * ワークフローイベントビルダー
 */
export class WorkflowEventBuilder<T = unknown> {
  private event: Partial<WorkflowEvent<T>> = {
    timestamp: new Date().toISOString(),
  };

  withType(type: WorkflowEventType): this {
    this.event.type = type;
    return this;
  }

  withSpecId(specId: string): this {
    this.event.specId = specId;
    return this;
  }

  withTaskId(taskId: string): this {
    this.event.taskId = taskId;
    return this;
  }

  withData(data: T): this {
    this.event.data = data;
    return this;
  }

  withTimestamp(timestamp: string): this {
    this.event.timestamp = timestamp;
    return this;
  }

  build(): WorkflowEvent<T> {
    if (!this.event.type || !this.event.specId || !this.event.data) {
      throw new Error('WorkflowEvent must have type, specId, and data');
    }
    return this.event as WorkflowEvent<T>;
  }
}

/**
 * モック Octokit レスポンスヘルパー
 */
export function createMockOctokitResponse<T>(data: T) {
  return {
    data,
    status: 200,
    url: 'https://api.github.com/test',
    headers: {},
  };
}
