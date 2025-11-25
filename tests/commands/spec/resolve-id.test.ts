/**
 * resolve-id.ts 単体テスト
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { resolveSpecId } from '../../../src/commands/spec/resolve-id.js';

describe('resolveSpecId', () => {
  let lifecycle: DatabaseLifecycle;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  describe('正常系', () => {
    test('完全な仕様書 ID で仕様書を解決できる', async () => {
      const specId = randomUUID();

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様書',
          description: 'テスト用の説明',
          phase: 'requirements',
          branch_name: 'feature/test-spec',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      const result = await resolveSpecId(specId);

      expect(result.success).toBe(true);
      expect(result.spec).toBeDefined();
      expect(result.spec?.id).toBe(specId);
      expect(result.spec?.name).toBe('テスト仕様書');
      expect(result.spec?.phase).toBe('requirements');
      expect(result.spec?.branch_name).toBe('feature/test-spec');
    });

    test('部分 ID（8文字）で仕様書を解決できる', async () => {
      const specId = randomUUID();
      const partialId = specId.substring(0, 8);

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '部分ID テスト',
          description: null,
          phase: 'design',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      const result = await resolveSpecId(partialId);

      expect(result.success).toBe(true);
      expect(result.spec?.id).toBe(specId);
      expect(result.spec?.name).toBe('部分ID テスト');
    });

    test('GitHub Issue 番号も含めて解決できる', async () => {
      const specId = randomUUID();

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'GitHub 連携テスト',
          description: null,
          phase: 'implementation',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          id: randomUUID(),
          entity_type: 'spec',
          entity_id: specId,
          github_id: '456',
          github_number: 456,
          github_node_id: null,
          issue_number: 42,
          issue_url: 'https://github.com/owner/repo/issues/42',
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      const result = await resolveSpecId(specId.substring(0, 8));

      expect(result.success).toBe(true);
      expect(result.spec?.github_issue_number).toBe(42);
    });
  });

  describe('異常系', () => {
    test('存在しない仕様書 ID でエラーを返す', async () => {
      const result = await resolveSpecId('nonexist');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Spec not found');
    });

    test('8文字未満の ID でエラーを返す', async () => {
      const result = await resolveSpecId('short');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid spec ID');
    });

    test('空の ID でエラーを返す', async () => {
      const result = await resolveSpecId('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid spec ID');
    });
  });
});
