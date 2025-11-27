/**
 * status/info.ts 単体テスト
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { getStatusFromDb } from '../../../src/commands/status/get-status.js';

describe('getStatusFromDb', () => {
  let lifecycle: DatabaseLifecycle;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  describe('仕様書集計', () => {
    test('空のデータベースでは全フェーズが 0 件', async () => {
      const result = await getStatusFromDb(lifecycle.db);

      expect(result.specs.total).toBe(0);
      expect(result.specs.byPhase.requirements).toBe(0);
      expect(result.specs.byPhase.design).toBe(0);
      expect(result.specs.byPhase.tasks).toBe(0);
      expect(result.specs.byPhase.implementation).toBe(0);
      expect(result.specs.byPhase.completed).toBe(0);
      expect(result.specs.recent).toHaveLength(0);
      expect(result.specs.withoutIssue).toHaveLength(0);
    });

    test('フェーズ別に仕様書を正しく集計する', async () => {
      // 各フェーズに仕様書を作成
      const phases = ['requirements', 'design', 'tasks', 'implementation', 'completed'] as const;
      for (const phase of phases) {
        await lifecycle.db
          .insertInto('specs')
          .values({
            id: randomUUID(),
            name: `${phase} テスト仕様書`,
            description: null,
            phase,
            branch_name: 'feature/test',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute();
      }

      // design フェーズに追加でもう 1 件
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: randomUUID(),
          name: 'design テスト仕様書 2',
          description: null,
          phase: 'design',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      const result = await getStatusFromDb(lifecycle.db);

      expect(result.specs.total).toBe(6);
      expect(result.specs.byPhase.requirements).toBe(1);
      expect(result.specs.byPhase.design).toBe(2);
      expect(result.specs.byPhase.tasks).toBe(1);
      expect(result.specs.byPhase.implementation).toBe(1);
      expect(result.specs.byPhase.completed).toBe(1);
    });

    test('最近の仕様書は最新 5 件を返す', async () => {
      // 10 件の仕様書を作成（created_at を古い順に）
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.now() - (10 - i) * 1000);
        await lifecycle.db
          .insertInto('specs')
          .values({
            id: randomUUID(),
            name: `仕様書 ${i + 1}`,
            description: null,
            phase: 'requirements',
            branch_name: 'feature/test',
            created_at: date.toISOString(),
            updated_at: date.toISOString(),
          })
          .execute();
      }

      const result = await getStatusFromDb(lifecycle.db);

      expect(result.specs.recent).toHaveLength(5);
      // 最新順（desc）なので、仕様書 10 が最初
      expect(result.specs.recent[0].name).toBe('仕様書 10');
      expect(result.specs.recent[4].name).toBe('仕様書 6');
    });

    test('Issue 未作成の仕様書を正しく検出する', async () => {
      const specWithIssue = randomUUID();
      const specWithoutIssue = randomUUID();
      const completedSpec = randomUUID();

      // Issue あり
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specWithIssue,
          name: 'Issue あり',
          description: null,
          phase: 'implementation',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      await lifecycle.db
        .insertInto('github_sync')
        .values({
          id: randomUUID(),
          entity_type: 'spec',
          entity_id: specWithIssue,
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

      // Issue なし（検出対象）
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specWithoutIssue,
          name: 'Issue なし',
          description: null,
          phase: 'design',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // completed は Issue なしでも検出対象外
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: completedSpec,
          name: '完了済み',
          description: null,
          phase: 'completed',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      const result = await getStatusFromDb(lifecycle.db);

      expect(result.specs.withoutIssue).toHaveLength(1);
      expect(result.specs.withoutIssue[0].name).toBe('Issue なし');
    });
  });

  describe('ログ集計', () => {
    test('空のデータベースではログが空', async () => {
      const result = await getStatusFromDb(lifecycle.db);

      expect(result.logs.errors).toHaveLength(0);
      expect(result.logs.recent).toHaveLength(0);
    });

    test('エラーログは error と warn のみを返す', async () => {
      // 各レベルのログを作成
      const levels = ['debug', 'info', 'warn', 'error'] as const;
      for (const level of levels) {
        await lifecycle.db
          .insertInto('logs')
          .values({
            id: randomUUID(),
            task_id: null,
            spec_id: null,
            action: 'test',
            level,
            message: `${level} メッセージ`,
            metadata: null,
            timestamp: new Date().toISOString(),
          })
          .execute();
      }

      const result = await getStatusFromDb(lifecycle.db);

      expect(result.logs.errors).toHaveLength(2);
      expect(result.logs.errors.some((e) => e.level === 'error')).toBe(true);
      expect(result.logs.errors.some((e) => e.level === 'warn')).toBe(true);
      expect(result.logs.errors.some((e) => e.level === 'debug')).toBe(false);
      expect(result.logs.errors.some((e) => e.level === 'info')).toBe(false);
    });

    test('最近のログは最新 5 件を返す', async () => {
      // 10 件のログを作成（timestamp を古い順に）
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.now() - (10 - i) * 1000);
        await lifecycle.db
          .insertInto('logs')
          .values({
            id: randomUUID(),
            task_id: null,
            spec_id: null,
            action: 'test',
            level: 'info',
            message: `ログ ${i + 1}`,
            metadata: null,
            timestamp: date.toISOString(),
          })
          .execute();
      }

      const result = await getStatusFromDb(lifecycle.db);

      expect(result.logs.recent).toHaveLength(5);
      // 最新順（desc）なので、ログ 10 が最初
      expect(result.logs.recent[0].message).toBe('ログ 10');
      expect(result.logs.recent[4].message).toBe('ログ 6');
    });

    test('エラーログは最新 10 件を返す', async () => {
      // 15 件のエラーログを作成（timestamp を古い順に）
      for (let i = 0; i < 15; i++) {
        const date = new Date(Date.now() - (15 - i) * 1000);
        await lifecycle.db
          .insertInto('logs')
          .values({
            id: randomUUID(),
            task_id: null,
            spec_id: null,
            action: 'test',
            level: 'error',
            message: `エラー ${i + 1}`,
            metadata: null,
            timestamp: date.toISOString(),
          })
          .execute();
      }

      const result = await getStatusFromDb(lifecycle.db);

      expect(result.logs.errors).toHaveLength(10);
      // 最新順（desc）なので、エラー 15 が最初
      expect(result.logs.errors[0].message).toBe('エラー 15');
      expect(result.logs.errors[9].message).toBe('エラー 6');
    });
  });

  describe('GitHub 連携情報', () => {
    test('仕様書の GitHub Issue 番号と PR 番号を正しく取得する', async () => {
      const specId = randomUUID();

      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'GitHub 連携テスト',
          description: null,
          phase: 'implementation',
          branch_name: 'feature/github-test',
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
          github_id: '456',
          github_number: 456,
          github_node_id: 'I_abc123',
          issue_number: 456,
          issue_url: 'https://github.com/owner/repo/issues/456',
          pr_number: 100,
          pr_url: 'https://github.com/owner/repo/pull/100',
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      const result = await getStatusFromDb(lifecycle.db);

      expect(result.specs.recent).toHaveLength(1);
      expect(result.specs.recent[0].github_issue_number).toBe(456);
      expect(result.specs.recent[0].pr_number).toBe(100);
    });
  });
});
