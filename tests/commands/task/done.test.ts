/**
 * task/done.ts コマンドのテスト
 *
 * EventBus の直接テストのみを実施
 * (done.ts は import.meta.url を使用しているため Jest では直接インポート不可)
 */
import 'reflect-metadata';
import { describe, expect, beforeEach, afterEach, it } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { EventBus, WorkflowEvent } from '../../../src/core/workflow/event-bus.js';
import type { Kysely } from 'kysely';
import type { Database as DatabaseSchema } from '../../../src/core/database/schema.js';

describe('EventBus 統合テスト', () => {
  let lifecycle: DatabaseLifecycle;
  let eventBus: EventBus;
  let capturedEvents: WorkflowEvent<{ taskId: string }>[];

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
    eventBus = new EventBus();
    capturedEvents = [];

    // task.completed イベントをキャプチャ
    eventBus.on<{ taskId: string }>('task.completed', async (event) => {
      capturedEvents.push(event);
    });
  });

  afterEach(async () => {
    eventBus.clear();
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  it('task.completed イベントが正しく発火される', async () => {
    const taskId = randomUUID();
    const specId = randomUUID();

    const event = eventBus.createEvent<{ taskId: string }>(
      'task.completed',
      specId,
      { taskId },
      taskId
    );

    await eventBus.emit(event);

    expect(capturedEvents).toHaveLength(1);
    expect(capturedEvents[0].type).toBe('task.completed');
    expect(capturedEvents[0].specId).toBe(specId);
    expect(capturedEvents[0].taskId).toBe(taskId);
    expect(capturedEvents[0].data.taskId).toBe(taskId);
  });

  it('複数のハンドラーが登録されている場合、すべて実行される', async () => {
    const handler1Results: string[] = [];
    const handler2Results: string[] = [];

    eventBus.on<{ taskId: string }>('task.completed', async (event) => {
      handler1Results.push(event.data.taskId);
    });

    eventBus.on<{ taskId: string }>('task.completed', async (event) => {
      handler2Results.push(event.data.taskId);
    });

    const taskId = randomUUID();
    const event = eventBus.createEvent<{ taskId: string }>(
      'task.completed',
      'spec-1',
      { taskId },
      taskId
    );

    await eventBus.emit(event);

    // 最初に登録したハンドラーの結果を含めて3つ
    expect(capturedEvents).toHaveLength(1);
    expect(handler1Results).toHaveLength(1);
    expect(handler2Results).toHaveLength(1);
    expect(handler1Results[0]).toBe(taskId);
    expect(handler2Results[0]).toBe(taskId);
  });
});

describe('github_sync テーブルの parent_spec_id 取得テスト', () => {
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

  it('Sub Issue レコードから parent_spec_id を取得できる', async () => {
    const specId = randomUUID();
    const taskId = randomUUID();
    const issueNumber = 123;

    // テスト用の仕様書を作成
    await db
      .insertInto('specs')
      .values({
        id: specId,
        name: 'Test Spec',
        description: 'Test Description',
        phase: 'implementation',
        branch_name: 'test-branch',
      })
      .execute();

    // github_sync に Sub Issue レコードを作成
    await db
      .insertInto('github_sync')
      .values({
        id: randomUUID(),
        entity_type: 'sub_issue',
        entity_id: taskId,
        github_id: 'I_123',
        github_number: issueNumber,
        sync_status: 'success',
        parent_spec_id: specId,
        parent_issue_number: 100,
      })
      .execute();

    // レコードを取得
    const record = await db
      .selectFrom('github_sync')
      .selectAll()
      .where('entity_type', '=', 'sub_issue')
      .where('github_number', '=', issueNumber)
      .executeTakeFirst();

    expect(record).toBeDefined();
    expect(record?.parent_spec_id).toBe(specId);
    expect(record?.entity_id).toBe(taskId);
  });

  it('parent_spec_id が null の場合でもレコードを取得できる', async () => {
    const taskId = randomUUID();
    const issueNumber = 456;

    // parent_spec_id が null の Sub Issue レコードを作成
    await db
      .insertInto('github_sync')
      .values({
        id: randomUUID(),
        entity_type: 'sub_issue',
        entity_id: taskId,
        github_id: 'I_456',
        github_number: issueNumber,
        sync_status: 'success',
        parent_spec_id: null,
        parent_issue_number: 200,
      })
      .execute();

    // レコードを取得
    const record = await db
      .selectFrom('github_sync')
      .selectAll()
      .where('entity_type', '=', 'sub_issue')
      .where('github_number', '=', issueNumber)
      .executeTakeFirst();

    expect(record).toBeDefined();
    expect(record?.parent_spec_id).toBeNull();
    expect(record?.entity_id).toBe(taskId);
  });

  it('存在しない Issue 番号では null が返される', async () => {
    const record = await db
      .selectFrom('github_sync')
      .selectAll()
      .where('entity_type', '=', 'sub_issue')
      .where('github_number', '=', 99999)
      .executeTakeFirst();

    expect(record).toBeUndefined();
  });
});
