/**
 * register-spec.ts 単体テスト
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';

// EventBus モック
const mockEmit = jest.fn().mockResolvedValue(undefined);
const mockCreateEvent = jest.fn((type: string, specId: string, data: unknown) => ({
  type,
  timestamp: new Date().toISOString(),
  specId,
  data,
}));

jest.mock('../../../src/core/workflow/event-bus.js', () => ({
  getEventBusAsync: jest.fn().mockResolvedValue({
    emit: mockEmit,
    createEvent: mockCreateEvent,
  }),
  getEventBus: jest.fn().mockReturnValue({
    emit: mockEmit,
    createEvent: mockCreateEvent,
  }),
}));

// データベース接続モック（テスト用インスタンスを使用）
let mockDb: DatabaseLifecycle['db'] | null = null;
jest.mock('../../../src/core/database/connection.js', () => ({
  getDatabase: jest.fn(() => mockDb),
  closeDatabase: jest.fn().mockResolvedValue(undefined),
}));

// registerSpec をモック設定後にインポート
import { registerSpec } from '../../../src/core/spec/register-spec.js';

describe('register.ts', () => {
  let lifecycle: DatabaseLifecycle;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
    mockDb = lifecycle.db; // テスト用 DB インスタンスをモックに設定
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  describe('registerSpec', () => {
    test('正常系: 仕様書を登録してイベント発火', async () => {
      const specId = randomUUID();
      const args = {
        id: specId,
        name: 'テスト仕様書',
        description: 'テストの説明',
        branchName: 'feature/spec-test',
        specPath: `.cc-craft-kit/specs/${specId}.md`,
      };

      const result = await registerSpec(args);

      expect(result.success).toBe(true);
      expect(result.specId).toBe(specId);
      expect(result.message).toBe('Spec registered successfully');

      // DB に登録されていることを確認
      const spec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirstOrThrow();

      expect(spec.name).toBe('テスト仕様書');
      expect(spec.description).toBe('テストの説明');
      expect(spec.phase).toBe('requirements');
      expect(spec.branch_name).toBe('feature/spec-test');

      // イベント発火を確認
      const { getEventBusAsync } = await import('../../../src/core/workflow/event-bus.js');
      const eventBus = await getEventBusAsync();
      expect(eventBus.emit).toHaveBeenCalledTimes(1);
      expect(eventBus.createEvent).toHaveBeenCalledWith('spec.created', specId, {
        name: 'テスト仕様書',
        description: 'テストの説明',
        phase: 'requirements',
      });
    });

    test('正常系: description が null の場合', async () => {
      const specId = randomUUID();
      const args = {
        id: specId,
        name: 'テスト仕様書',
        description: null,
        branchName: 'feature/spec-test',
        specPath: `.cc-craft-kit/specs/${specId}.md`,
      };

      const result = await registerSpec(args);

      expect(result.success).toBe(true);

      const spec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirstOrThrow();

      expect(spec.description).toBeNull();
    });

    test('異常系: 重複 ID の場合はエラー', async () => {
      const specId = randomUUID();

      // 先に登録
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '既存の仕様書',
          description: null,
          phase: 'requirements',
          branch_name: 'feature/existing',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 同じ ID で登録を試みる
      const args = {
        id: specId,
        name: '重複仕様書',
        description: null,
        branchName: 'feature/duplicate',
        specPath: `.cc-craft-kit/specs/${specId}.md`,
      };

      const result = await registerSpec(args);

      expect(result.success).toBe(false);
      expect(result.error).toContain('UNIQUE constraint failed');
    });

    test('正常系: 長い仕様書名（200文字）', async () => {
      const specId = randomUUID();
      const longName = 'あ'.repeat(200);

      const args = {
        id: specId,
        name: longName,
        description: null,
        branchName: 'feature/spec-long',
        specPath: `.cc-craft-kit/specs/${specId}.md`,
      };

      const result = await registerSpec(args);

      expect(result.success).toBe(true);

      const spec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirstOrThrow();

      expect(spec.name).toBe(longName);
    });
  });
});
