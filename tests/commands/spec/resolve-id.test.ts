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

  describe('GitHub Issue 番号による解決', () => {
    test('#42 形式で仕様書を解決できる', async () => {
      const specId = randomUUID();

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'GitHub Issue テスト',
          description: 'Issue 番号から解決するテスト',
          phase: 'design',
          branch_name: 'feature/issue-42',
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
          github_id: '42',
          github_number: 42,
          github_node_id: null,
          issue_number: 42,
          issue_url: 'https://github.com/owner/repo/issues/42',
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      const result = await resolveSpecId('#42');

      expect(result.success).toBe(true);
      expect(result.spec).toBeDefined();
      expect(result.spec?.id).toBe(specId);
      expect(result.spec?.name).toBe('GitHub Issue テスト');
      expect(result.spec?.github_issue_number).toBe(42);
    });

    test('42 形式（# なし）で仕様書を解決できる', async () => {
      const specId = randomUUID();

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Issue 番号直接指定テスト',
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
          github_id: '123',
          github_number: 123,
          github_node_id: null,
          issue_number: 123,
          issue_url: 'https://github.com/owner/repo/issues/123',
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      const result = await resolveSpecId('123');

      expect(result.success).toBe(true);
      expect(result.spec?.id).toBe(specId);
      expect(result.spec?.name).toBe('Issue 番号直接指定テスト');
      expect(result.spec?.github_issue_number).toBe(123);
    });

    test('存在しない GitHub Issue 番号でエラーを返す', async () => {
      const result = await resolveSpecId('#99999');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No spec found for GitHub Issue #99999');
    });

    test('6桁の Issue 番号も解決できる', async () => {
      const specId = randomUUID();

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '大きな Issue 番号テスト',
          description: null,
          phase: 'requirements',
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
          github_id: '123456',
          github_number: 123456,
          github_node_id: null,
          issue_number: 123456,
          issue_url: 'https://github.com/owner/repo/issues/123456',
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      const result = await resolveSpecId('#123456');

      expect(result.success).toBe(true);
      expect(result.spec?.id).toBe(specId);
      expect(result.spec?.github_issue_number).toBe(123456);
    });
  });

  describe('入力形式の自動判別', () => {
    test('仕様書 ID 形式（8文字以上の hex）は仕様書として検索される', async () => {
      const specId = randomUUID();

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'ID 形式テスト',
          description: null,
          phase: 'design',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      const result = await resolveSpecId(specId.substring(0, 8));

      expect(result.success).toBe(true);
      expect(result.spec?.id).toBe(specId);
    });

    test('数値のみ（1-6桁）は Issue 番号として検索される', async () => {
      // Issue 番号として検索されるが、対応する仕様書がないのでエラー
      const result = await resolveSpecId('42');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No spec found for GitHub Issue #42');
    });

    test('無効な形式はエラーを返す', async () => {
      const result = await resolveSpecId('abc');  // 8文字未満で hex でもない

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input format');
    });
  });

  describe('異常系', () => {
    test('存在しない仕様書 ID でエラーを返す', async () => {
      const result = await resolveSpecId('nonexist');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input format');
    });

    test('8文字未満の hex ID でエラーを返す', async () => {
      const result = await resolveSpecId('abcdef1');  // 7文字

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input format');
    });

    test('空の ID でエラーを返す', async () => {
      const result = await resolveSpecId('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input format');
    });
  });
});
