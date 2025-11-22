/**
 * Git統合 (spec.created イベント) のテスト
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventBus } from '../../../src/core/workflow/event-bus.js';
import { registerGitIntegrationHandlers } from '../../../src/core/workflow/git-integration.js';
import { execSync, spawnSync } from 'node:child_process';
import type { Kysely } from 'kysely';
import type { Database } from '../../../src/core/database/schema.js';

// モック化
jest.mock('node:child_process');
jest.mock('../../../src/core/errors/error-handler.js', () => ({
  getErrorHandler: jest.fn(() => ({
    handle: jest.fn(),
  })),
}));

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockedSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

describe('Git Integration - spec.created Event', () => {
  let eventBus: EventBus;
  let mockDb: Kysely<Database>;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = new EventBus();

    // モックデータベース
    mockDb = {
      selectFrom: jest.fn(() => ({
        where: jest.fn(() => ({
          selectAll: jest.fn(() => ({
            executeTakeFirst: jest.fn(async () => ({
              id: '12345678-1234-1234-1234-123456789abc',
              name: 'テスト仕様書',
              phase: 'requirements',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })),
          })),
        })),
      })),
    } as unknown as Kysely<Database>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    eventBus.clear();
  });

  describe('handleSpecCreatedCommit', () => {
    it('should commit spec file when Git repository exists', async () => {
      // Arrange: Git リポジトリが存在する
      mockedExecSync.mockReturnValue(Buffer.from('.git'));

      // git check-ignore が無視されていないことを返す（encoding: 'utf-8' 指定時は文字列を返す）
      mockedSpawnSync.mockReturnValueOnce({
        status: 1,
        stdout: '',
        stderr: '',
      } as ReturnType<typeof spawnSync>);

      // git add 成功
      mockedSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: '',
        stderr: '',
      } as ReturnType<typeof spawnSync>);

      // git commit 成功
      mockedSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: '[main 1234567] feat: テスト仕様書 の要件定義を完了',
        stderr: '',
      } as ReturnType<typeof spawnSync>);

      // ハンドラー登録
      registerGitIntegrationHandlers(eventBus, mockDb);

      // Act: spec.created イベント発火
      const event = eventBus.createEvent('spec.created', '12345678-1234-1234-1234-123456789abc', {
        name: 'テスト仕様書',
        description: null,
        phase: 'requirements',
      });

      await eventBus.emit(event);

      // Assert: git check-ignore が実行されたことを確認
      const checkIgnoreCall = mockedSpawnSync.mock.calls.find(
        (call) => call[0] === 'git' && call[1][0] === 'check-ignore'
      );
      expect(checkIgnoreCall).toBeDefined();

      // git add が実行されたことを確認
      const addCall = mockedSpawnSync.mock.calls.find(
        (call) => call[0] === 'git' && call[1][0] === 'add'
      );
      expect(addCall).toBeDefined();

      // git commit が実行されたことを確認
      const commitCall = mockedSpawnSync.mock.calls.find(
        (call) => call[0] === 'git' && call[1][0] === 'commit'
      );
      expect(commitCall).toBeDefined();
      expect(commitCall?.[1][2]).toBe('feat: テスト仕様書 の要件定義を完了');
    });

    it('should skip commit when Git repository does not exist', async () => {
      // Arrange: Git リポジトリが存在しない
      mockedExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      // ハンドラー登録
      registerGitIntegrationHandlers(eventBus, mockDb);

      // Act: spec.created イベント発火
      const event = eventBus.createEvent('spec.created', '12345678-1234-1234-1234-123456789abc', {
        name: 'テスト仕様書',
        description: null,
        phase: 'requirements',
      });

      await eventBus.emit(event);

      // Assert: git add/commit は実行されない
      expect(mockedSpawnSync).not.toHaveBeenCalled();
    });

    it('should skip commit when spec record does not exist', async () => {
      // Arrange: Git リポジトリは存在するが、仕様書レコードが見つからない
      mockedExecSync.mockReturnValue(Buffer.from('.git'));

      const mockDbNotFound = {
        selectFrom: jest.fn(() => ({
          where: jest.fn(() => ({
            selectAll: jest.fn(() => ({
              executeTakeFirst: jest.fn(async () => null),
            })),
          })),
        })),
      } as unknown as Kysely<Database>;

      // ハンドラー登録
      registerGitIntegrationHandlers(eventBus, mockDbNotFound);

      // Act: spec.created イベント発火
      const event = eventBus.createEvent('spec.created', '12345678-1234-1234-1234-123456789abc', {
        name: 'テスト仕様書',
        description: null,
        phase: 'requirements',
      });

      await eventBus.emit(event);

      // Assert: git add/commit は実行されない
      expect(mockedSpawnSync).not.toHaveBeenCalled();
    });

    it('should log error when git commit fails', async () => {
      // Arrange: Git リポジトリが存在する
      mockedExecSync.mockReturnValue(Buffer.from('.git'));

      // git check-ignore が無視されていないことを返す（encoding: 'utf-8' 指定時は文字列を返す）
      mockedSpawnSync.mockReturnValueOnce({
        status: 1,
        stdout: '',
        stderr: '',
      } as ReturnType<typeof spawnSync>);

      // git add 成功
      mockedSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: '',
        stderr: '',
      } as ReturnType<typeof spawnSync>);

      // git commit 失敗
      mockedSpawnSync.mockReturnValueOnce({
        status: 1,
        stdout: '',
        stderr: 'pre-commit hook failed',
      } as ReturnType<typeof spawnSync>);

      // ハンドラー登録
      registerGitIntegrationHandlers(eventBus, mockDb);

      // Act: spec.created イベント発火
      const event = eventBus.createEvent('spec.created', '12345678-1234-1234-1234-123456789abc', {
        name: 'テスト仕様書',
        description: null,
        phase: 'requirements',
      });

      await eventBus.emit(event);

      // Assert: git commit が実行されたが失敗した
      const commitCall = mockedSpawnSync.mock.calls.find(
        (call) => call[0] === 'git' && call[1][0] === 'commit'
      );
      expect(commitCall).toBeDefined();
      expect(commitCall?.[1][2]).toBe('feat: テスト仕様書 の要件定義を完了');
    });

    it('should skip commit when file is ignored by .gitignore', async () => {
      // Arrange: Git リポジトリが存在する
      mockedExecSync.mockReturnValue(Buffer.from('.git'));

      // git check-ignore が無視されているファイルを返す（encoding: 'utf-8' 指定時は文字列を返す）
      mockedSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: '.cc-craft-kit/specs/12345678-1234-1234-1234-123456789abc.md\n',
        stderr: '',
      } as ReturnType<typeof spawnSync>);

      // ハンドラー登録
      registerGitIntegrationHandlers(eventBus, mockDb);

      // Act: spec.created イベント発火
      const event = eventBus.createEvent('spec.created', '12345678-1234-1234-1234-123456789abc', {
        name: 'テスト仕様書',
        description: null,
        phase: 'requirements',
      });

      await eventBus.emit(event);

      // Assert: git check-ignore が実行されたが、git add は実行されない
      expect(mockedSpawnSync).toHaveBeenCalledWith(
        'git',
        ['check-ignore', '.cc-craft-kit/specs/12345678-1234-1234-1234-123456789abc.md'],
        expect.any(Object)
      );

      // git add が呼ばれていないことを確認
      expect(mockedSpawnSync).not.toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['add']),
        expect.any(Object)
      );
    });
  });
});
