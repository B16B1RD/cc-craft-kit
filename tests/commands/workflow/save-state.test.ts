/**
 * workflow_state テーブル操作テスト
 *
 * save-state.ts / restore-state.ts のコア機能をデータベース操作で検証
 * (コマンドファイルは import.meta.url を使用しているため Jest では直接インポート不可)
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import type { Kysely } from 'kysely';
import type { Database as DatabaseSchema } from '../../../src/core/database/schema.js';

describe('workflow_state テーブル操作', () => {
  let lifecycle: DatabaseLifecycle;
  let db: Kysely<DatabaseSchema>;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
    db = lifecycle.db;
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  describe('INSERT 操作', () => {
    test('新規ワークフロー状態を保存できる', async () => {
      const specId = randomUUID();
      const workflowStateId = randomUUID();
      const now = new Date().toISOString();

      // 仕様書を作成
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: 'ワークフロー状態保存テスト',
          phase: 'implementation',
          created_at: now,
          updated_at: now,
        })
        .execute();

      // ワークフロー状態を保存
      await db
        .insertInto('workflow_state')
        .values({
          id: workflowStateId,
          spec_id: specId,
          current_task_number: 1,
          current_task_title: 'テストタスク',
          next_action: 'task_done',
          github_issue_number: 123,
          saved_at: now,
          updated_at: now,
        })
        .execute();

      // DB に保存されていることを確認
      const saved = await db
        .selectFrom('workflow_state')
        .where('spec_id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(saved).toBeDefined();
      expect(saved?.id).toBe(workflowStateId);
      expect(saved?.current_task_number).toBe(1);
      expect(saved?.current_task_title).toBe('テストタスク');
      expect(saved?.next_action).toBe('task_done');
      expect(saved?.github_issue_number).toBe(123);
    });

    test('同じ spec_id で重複登録できない（UNIQUE 制約）', async () => {
      const specId = randomUUID();
      const now = new Date().toISOString();

      // 仕様書を作成
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: 'UNIQUE テスト',
          phase: 'implementation',
          created_at: now,
          updated_at: now,
        })
        .execute();

      // 初回保存
      await db
        .insertInto('workflow_state')
        .values({
          id: randomUUID(),
          spec_id: specId,
          current_task_number: 1,
          current_task_title: 'タスク1',
          next_action: 'task_start',
          saved_at: now,
          updated_at: now,
        })
        .execute();

      // 2 回目の保存（UNIQUE 制約違反）
      // SQLite の UNIQUE 制約エラーは SqliteError として throw される
      let errorOccurred = false;
      try {
        await db
          .insertInto('workflow_state')
          .values({
            id: randomUUID(),
            spec_id: specId,
            current_task_number: 2,
            current_task_title: 'タスク2',
            next_action: 'task_done',
            saved_at: now,
            updated_at: now,
          })
          .execute();
      } catch (error) {
        errorOccurred = true;
        // UNIQUE 制約違反エラーであることを確認
        expect(String(error)).toMatch(/UNIQUE constraint failed|constraint failed/i);
      }

      // エラーが発生しなかった場合は、レコード数で確認
      if (!errorOccurred) {
        const count = await db
          .selectFrom('workflow_state')
          .where('spec_id', '=', specId)
          .select(db.fn.count('id').as('count'))
          .executeTakeFirst();

        // UNIQUE 制約が効いていれば 1 件のみ
        expect(Number(count?.count || 0)).toBe(1);
      }
    });

    test('githubIssueNumber が null で保存できる', async () => {
      const specId = randomUUID();
      const now = new Date().toISOString();

      // 仕様書を作成
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: 'null テスト',
          phase: 'implementation',
          created_at: now,
          updated_at: now,
        })
        .execute();

      // githubIssueNumber null で保存
      await db
        .insertInto('workflow_state')
        .values({
          id: randomUUID(),
          spec_id: specId,
          current_task_number: 1,
          current_task_title: 'テストタスク',
          next_action: 'none',
          github_issue_number: null,
          saved_at: now,
          updated_at: now,
        })
        .execute();

      // DB の状態を確認
      const saved = await db
        .selectFrom('workflow_state')
        .where('spec_id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(saved?.github_issue_number).toBeNull();
    });
  });

  describe('UPDATE 操作', () => {
    test('既存ワークフロー状態を更新できる', async () => {
      const specId = randomUUID();
      const workflowStateId = randomUUID();
      const now = new Date().toISOString();

      // 仕様書を作成
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: 'UPDATE テスト',
          phase: 'implementation',
          created_at: now,
          updated_at: now,
        })
        .execute();

      // 初回保存
      await db
        .insertInto('workflow_state')
        .values({
          id: workflowStateId,
          spec_id: specId,
          current_task_number: 1,
          current_task_title: 'タスク1',
          next_action: 'task_start',
          saved_at: now,
          updated_at: now,
        })
        .execute();

      // 更新
      const updatedAt = new Date().toISOString();
      await db
        .updateTable('workflow_state')
        .set({
          current_task_number: 2,
          current_task_title: 'タスク2',
          next_action: 'task_done',
          github_issue_number: 456,
          updated_at: updatedAt,
        })
        .where('spec_id', '=', specId)
        .execute();

      // DB の状態を確認
      const saved = await db
        .selectFrom('workflow_state')
        .where('spec_id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(saved?.id).toBe(workflowStateId);
      expect(saved?.current_task_number).toBe(2);
      expect(saved?.current_task_title).toBe('タスク2');
      expect(saved?.next_action).toBe('task_done');
      expect(saved?.github_issue_number).toBe(456);
    });
  });

  describe('DELETE 操作', () => {
    test('ワークフロー状態を削除できる', async () => {
      const specId = randomUUID();
      const now = new Date().toISOString();

      // 仕様書を作成
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: '削除テスト',
          phase: 'implementation',
          created_at: now,
          updated_at: now,
        })
        .execute();

      // ワークフロー状態を保存
      await db
        .insertInto('workflow_state')
        .values({
          id: randomUUID(),
          spec_id: specId,
          current_task_number: 1,
          current_task_title: 'テストタスク',
          next_action: 'none',
          saved_at: now,
          updated_at: now,
        })
        .execute();

      // 削除
      const result = await db.deleteFrom('workflow_state').where('spec_id', '=', specId).execute();

      expect(result.length).toBe(1);
      expect(Number(result[0].numDeletedRows)).toBe(1);

      // DB から削除されていることを確認
      const saved = await db
        .selectFrom('workflow_state')
        .where('spec_id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(saved).toBeUndefined();
    });

    test('存在しない状態を削除しても成功する', async () => {
      const nonExistentSpecId = randomUUID();

      const result = await db
        .deleteFrom('workflow_state')
        .where('spec_id', '=', nonExistentSpecId)
        .execute();

      expect(result.length).toBe(1);
      expect(Number(result[0].numDeletedRows)).toBe(0);
    });

    test('仕様書削除時に CASCADE で自動削除される', async () => {
      const specId = randomUUID();
      const now = new Date().toISOString();

      // 仕様書を作成
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: 'CASCADE テスト',
          phase: 'implementation',
          created_at: now,
          updated_at: now,
        })
        .execute();

      // ワークフロー状態を保存
      await db
        .insertInto('workflow_state')
        .values({
          id: randomUUID(),
          spec_id: specId,
          current_task_number: 1,
          current_task_title: 'テストタスク',
          next_action: 'none',
          saved_at: now,
          updated_at: now,
        })
        .execute();

      // 仕様書を削除（CASCADE）
      await db.deleteFrom('specs').where('id', '=', specId).execute();

      // ワークフロー状態も削除されていることを確認
      const saved = await db
        .selectFrom('workflow_state')
        .where('spec_id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(saved).toBeUndefined();
    });
  });

  describe('SELECT 操作（復元用）', () => {
    test('spec_id からワークフロー状態を取得できる', async () => {
      const specId = randomUUID();
      const now = new Date().toISOString();

      // 仕様書を作成
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: '復元テスト',
          phase: 'implementation',
          created_at: now,
          updated_at: now,
        })
        .execute();

      // ワークフロー状態を保存
      await db
        .insertInto('workflow_state')
        .values({
          id: randomUUID(),
          spec_id: specId,
          current_task_number: 3,
          current_task_title: 'タスク3',
          next_action: 'task_done',
          github_issue_number: 789,
          saved_at: now,
          updated_at: now,
        })
        .execute();

      // specs テーブルと JOIN して取得
      const result = await db
        .selectFrom('workflow_state')
        .innerJoin('specs', 'specs.id', 'workflow_state.spec_id')
        .select([
          'workflow_state.spec_id',
          'specs.name as spec_name',
          'workflow_state.current_task_number',
          'workflow_state.current_task_title',
          'workflow_state.next_action',
          'workflow_state.github_issue_number',
          'workflow_state.saved_at',
        ])
        .where('workflow_state.spec_id', '=', specId)
        .executeTakeFirst();

      expect(result).toBeDefined();
      expect(result?.spec_id).toBe(specId);
      expect(result?.spec_name).toBe('テスト仕様');
      expect(result?.current_task_number).toBe(3);
      expect(result?.current_task_title).toBe('タスク3');
      expect(result?.next_action).toBe('task_done');
      expect(result?.github_issue_number).toBe(789);
    });

    test('最新の状態を saved_at 降順で取得できる', async () => {
      const specId1 = randomUUID();
      const specId2 = randomUUID();
      const olderTime = '2025-01-01T00:00:00.000Z';
      const newerTime = '2025-01-02T00:00:00.000Z';
      const now = new Date().toISOString();

      // 仕様書を作成
      await db
        .insertInto('specs')
        .values([
          {
            id: specId1,
            name: '古い仕様',
            description: 'テスト1',
            phase: 'implementation',
            created_at: now,
            updated_at: now,
          },
          {
            id: specId2,
            name: '新しい仕様',
            description: 'テスト2',
            phase: 'implementation',
            created_at: now,
            updated_at: now,
          },
        ])
        .execute();

      // ワークフロー状態を保存（異なる時刻で）
      await db
        .insertInto('workflow_state')
        .values([
          {
            id: randomUUID(),
            spec_id: specId1,
            current_task_number: 1,
            current_task_title: '古いタスク',
            next_action: 'task_start',
            saved_at: olderTime,
            updated_at: olderTime,
          },
          {
            id: randomUUID(),
            spec_id: specId2,
            current_task_number: 2,
            current_task_title: '新しいタスク',
            next_action: 'task_done',
            saved_at: newerTime,
            updated_at: newerTime,
          },
        ])
        .execute();

      // saved_at 降順で取得（最新が先頭）
      const result = await db
        .selectFrom('workflow_state')
        .innerJoin('specs', 'specs.id', 'workflow_state.spec_id')
        .select([
          'workflow_state.spec_id',
          'specs.name as spec_name',
          'workflow_state.current_task_number',
          'workflow_state.saved_at',
        ])
        .orderBy('workflow_state.saved_at', 'desc')
        .executeTakeFirst();

      expect(result).toBeDefined();
      expect(result?.spec_name).toBe('新しい仕様');
      expect(result?.current_task_number).toBe(2);
    });
  });
});
