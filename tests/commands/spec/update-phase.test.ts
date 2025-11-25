/**
 * update-phase.ts 単体テスト
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { updatePhase } from '../../../src/commands/spec/update-phase.js';

describe('updatePhase', () => {
  let lifecycle: DatabaseLifecycle;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
    jest.clearAllMocks();
  });

  describe('正常系', () => {
    test('フェーズを正常に更新できる', async () => {
      const specId = randomUUID();

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'フェーズ更新テスト',
          description: null,
          phase: 'requirements',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      const result = await updatePhase(specId.substring(0, 8), 'design');

      expect(result.success).toBe(true);
      expect(result.oldPhase).toBe('requirements');
      expect(result.newPhase).toBe('design');
      expect(result.specId).toBe(specId);
      expect(result.specName).toBe('フェーズ更新テスト');

      // データベースが更新されていることを確認
      const updatedSpec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirstOrThrow();

      expect(updatedSpec.phase).toBe('design');
    });

    test('省略形のフェーズ名で更新できる', async () => {
      const specId = randomUUID();

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '省略形テスト',
          description: null,
          phase: 'design',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // impl → implementation
      const result = await updatePhase(specId.substring(0, 8), 'impl');

      expect(result.success).toBe(true);
      expect(result.newPhase).toBe('implementation');
    });

    test('completed フェーズに更新できる', async () => {
      const specId = randomUUID();

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '完了テスト',
          description: null,
          phase: 'implementation',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      const result = await updatePhase(specId.substring(0, 8), 'comp');

      expect(result.success).toBe(true);
      expect(result.newPhase).toBe('completed');
    });
  });

  describe('異常系', () => {
    test('存在しない仕様書 ID でエラーを返す', async () => {
      const result = await updatePhase('nonexist', 'design');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Spec not found');
    });

    test('無効なフェーズ名でエラーを返す', async () => {
      const specId = randomUUID();

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '無効フェーズテスト',
          description: null,
          phase: 'requirements',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      const result = await updatePhase(specId.substring(0, 8), 'invalid-phase');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phase');
    });

    test('8文字未満の ID でエラーを返す', async () => {
      const result = await updatePhase('short', 'design');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid spec ID');
    });
  });
});
