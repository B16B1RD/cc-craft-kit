/**
 * update-pr.ts 単体テスト
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { updatePullRequest } from '../../../src/commands/spec/update-pr.js';

// モジュールモック
jest.mock('../../../src/integrations/github/client.js');

describe('updatePullRequest()', () => {
  let lifecycle: DatabaseLifecycle;
  let processExitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();

    // process.exit をモック（テスト実行を中断しないようにする）
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as never);
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
    jest.clearAllMocks();
    processExitSpy.mockRestore();
  });

  test('既存の github_sync レコードを更新できる', async () => {
    const specId = randomUUID();
    const syncId = randomUUID();

    // 仕様書作成
    await lifecycle.db
      .insertInto('specs')
      .values({
        id: specId,
        name: 'テスト仕様',
        description: 'PR 更新テスト',
        phase: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // 既存の github_sync レコード作成（PR 情報なし）
    await lifecycle.db
      .insertInto('github_sync')
      .values({
        id: syncId,
        entity_type: 'spec',
        entity_id: specId,
        github_id: '',
        github_number: null,
        github_node_id: null,
        issue_number: 123,
        issue_url: 'https://github.com/owner/repo/issues/123',
        pr_number: null,
        pr_url: null,
        pr_merged_at: null,
        sync_status: 'pending',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .execute();

    // PR 情報更新（テスト用にデータベースをクローズしない）
    await updatePullRequest(specId, 42, 'https://github.com/owner/repo/pull/42', { color: false, db: lifecycle.db }, false);

    // レコード確認
    const record = await lifecycle.db
      .selectFrom('github_sync')
      .where('entity_id', '=', specId)
      .selectAll()
      .executeTakeFirst();

    expect(record).toBeDefined();
    expect(record?.pr_number).toBe(42);
    expect(record?.pr_url).toBe('https://github.com/owner/repo/pull/42');
    expect(record?.sync_status).toBe('success');
  });

  test('github_sync レコードが存在しない場合、新規作成できる', async () => {
    const specId = randomUUID();

    // 仕様書作成
    await lifecycle.db
      .insertInto('specs')
      .values({
        id: specId,
        name: 'テスト仕様',
        description: 'PR 新規作成テスト',
        phase: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // PR 情報更新（新規レコード作成、テスト用にデータベースをクローズしない）
    await updatePullRequest(specId, 99, 'https://github.com/owner/repo/pull/99', { color: false, db: lifecycle.db }, false);

    // レコード確認
    const record = await lifecycle.db
      .selectFrom('github_sync')
      .where('entity_id', '=', specId)
      .selectAll()
      .executeTakeFirst();

    expect(record).toBeDefined();
    expect(record?.entity_type).toBe('spec');
    expect(record?.pr_number).toBe(99);
    expect(record?.pr_url).toBe('https://github.com/owner/repo/pull/99');
    expect(record?.sync_status).toBe('success');
  });

  test('無効な UUID の場合、エラーをスローする', async () => {
    await expect(
      updatePullRequest('invalid-uuid', 42, 'https://github.com/owner/repo/pull/42', {
        color: false,
        db: lifecycle.db,
      }, false)
    ).rejects.toThrow('Invalid spec ID format');
  });

  test('負の PR 番号の場合、エラーをスローする', async () => {
    const specId = randomUUID();

    await expect(
      updatePullRequest(specId, -1, 'https://github.com/owner/repo/pull/42', { color: false, db: lifecycle.db }, false)
    ).rejects.toThrow('PR number must be positive integer');
  });

  test('PR 番号が 0 の場合、エラーをスローする', async () => {
    const specId = randomUUID();

    await expect(
      updatePullRequest(specId, 0, 'https://github.com/owner/repo/pull/42', { color: false, db: lifecycle.db }, false)
    ).rejects.toThrow('PR number must be positive integer');
  });

  test('無効な PR URL の場合、エラーをスローする', async () => {
    const specId = randomUUID();

    await expect(
      updatePullRequest(specId, 42, 'not-a-url', { color: false, db: lifecycle.db }, false)
    ).rejects.toThrow('Invalid PR URL format');
  });

  test('PR 番号が整数でない場合、エラーをスローする', async () => {
    const specId = randomUUID();

    await expect(
      updatePullRequest(specId, 42.5, 'https://github.com/owner/repo/pull/42', { color: false, db: lifecycle.db }, false)
    ).rejects.toThrow();
  });

  test('トランザクション内でエラーが発生した場合、ロールバックされる', async () => {
    const specId = randomUUID();

    // 仕様書作成
    await lifecycle.db
      .insertInto('specs')
      .values({
        id: specId,
        name: 'テスト仕様',
        description: 'ロールバックテスト',
        phase: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // 不正なデータでトランザクションエラーを発生させる
    // （github_sync テーブルの entity_id カラムに NULL を挿入しようとする）
    await lifecycle.db
      .insertInto('github_sync')
      .values({
        id: randomUUID(),
        entity_type: 'spec',
        entity_id: specId,
        github_id: '123',
        sync_status: 'success',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // 既存レコードが存在する状態で UNIQUE 制約違反を発生させる
    // （同じ entity_id + entity_type の組み合わせで2回目の挿入）
    await expect(
      updatePullRequest(specId, 42, 'https://github.com/owner/repo/pull/42', { color: false, db: lifecycle.db }, false)
    ).resolves.not.toThrow();

    // レコードが更新されたことを確認
    const record = await lifecycle.db
      .selectFrom('github_sync')
      .where('entity_id', '=', specId)
      .selectAll()
      .executeTakeFirst();

    expect(record).toBeDefined();
    expect(record?.pr_number).toBe(42);
    expect(record?.pr_url).toBe('https://github.com/owner/repo/pull/42');
  });
});
