/**
 * delete-query.ts 単体テスト
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { queryDeleteTarget } from '../../../src/commands/spec/delete-query.js';

describe('queryDeleteTarget', () => {
  let lifecycle: DatabaseLifecycle;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  describe('正常系', () => {
    test('完全一致の仕様書 ID で情報取得できる', async () => {
      const specId = randomUUID();

      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '削除対象仕様書',
          description: 'テスト用',
          phase: 'requirements',
          branch_name: 'feature/test-delete',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      const result = await queryDeleteTarget(specId);

      expect(result.success).toBe(true);
      expect(result.spec).toBeDefined();
      expect(result.spec?.id).toBe(specId);
      expect(result.spec?.name).toBe('削除対象仕様書');
      expect(result.spec?.phase).toBe('requirements');
      expect(result.spec?.branch_name).toBe('feature/test-delete');
      expect(result.spec?.github_issue_number).toBeNull();
    });

    test('部分一致（8文字以上）で情報取得できる', async () => {
      const specId = randomUUID();
      const partialId = specId.substring(0, 8);

      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '部分一致テスト',
          description: null,
          phase: 'design',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      const result = await queryDeleteTarget(partialId);

      expect(result.success).toBe(true);
      expect(result.spec?.id).toBe(specId);
      expect(result.spec?.name).toBe('部分一致テスト');
    });

    test('GitHub Issue 番号ありの場合', async () => {
      const specId = randomUUID();

      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'GitHub連携テスト',
          description: null,
          phase: 'implementation',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      await lifecycle.db
        .insertInto('github_sync')
        .values({
          id: randomUUID(),
          entity_type: 'spec',
          entity_id: specId,
          github_id: '123',
          github_number: 123,
          github_node_id: null,
          issue_number: 99,
          issue_url: 'https://github.com/owner/repo/issues/99',
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      const result = await queryDeleteTarget(specId.substring(0, 8));

      expect(result.success).toBe(true);
      expect(result.spec?.github_issue_number).toBe(99);
    });

    test('GitHub Issue 番号なしの場合', async () => {
      const specId = randomUUID();

      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'GitHub未連携テスト',
          description: null,
          phase: 'testing',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      const result = await queryDeleteTarget(specId);

      expect(result.success).toBe(true);
      expect(result.spec?.github_issue_number).toBeNull();
    });
  });

  describe('異常系', () => {
    test('存在しない仕様書 ID でエラー', async () => {
      const result = await queryDeleteTarget('nonexist');

      expect(result.success).toBe(false);
      expect(result.error).toContain('仕様書が見つかりません');
    });

    test('8文字未満の ID でエラー', async () => {
      const result = await queryDeleteTarget('short');

      expect(result.success).toBe(false);
      expect(result.error).toContain('無効な仕様書 ID');
    });

    test('複数候補がある場合にエラー', async () => {
      // 同じプレフィックスを持つ2つの仕様書を作成
      const prefix = 'aaaaaaaa';
      const specId1 = `${prefix}-1111-1111-1111-111111111111`;
      const specId2 = `${prefix}-2222-2222-2222-222222222222`;

      await lifecycle.db
        .insertInto('specs')
        .values([
          {
            id: specId1,
            name: '仕様書1',
            description: null,
            phase: 'requirements',
            branch_name: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: specId2,
            name: '仕様書2',
            description: null,
            phase: 'design',
            branch_name: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .execute();

      const result = await queryDeleteTarget(prefix);

      expect(result.success).toBe(false);
      expect(result.error).toContain('複数の仕様書が該当します');
    });

    test('空の ID でエラー', async () => {
      const result = await queryDeleteTarget('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('無効な仕様書 ID');
    });
  });
});
