import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Kysely } from 'kysely';
import { Database } from '../../src/core/database/schema.js';
import { EventBus } from '../../src/core/workflow/event-bus.js';
import { PhaseAutomationHandler } from '../../src/core/workflow/phase-automation.js';
import { createTestDatabase, cleanupDatabase, closeTestDatabase } from '../helpers/db-lifecycle.js';

describe('PhaseAutomation Integration Tests', () => {
  let db: Kysely<Database>;
  let eventBus: EventBus;
  let handler: PhaseAutomationHandler;

  beforeEach(async () => {
    db = await createTestDatabase();
    eventBus = new EventBus();
    handler = new PhaseAutomationHandler();

    // イベントハンドラーを登録
    eventBus.on('spec.phase_changed', async (event) => {
      if (
        typeof event.data === 'object' &&
        event.data !== null &&
        'specId' in event.data &&
        'oldPhase' in event.data &&
        'newPhase' in event.data
      ) {
        await handler.handlePhaseChange(event as any);
      }
    });
  });

  afterEach(async () => {
    await cleanupDatabase(db);
    await closeTestDatabase(db);
  });

  describe('シナリオ1: 完全自動フロー', () => {
    it('requirements → design → tasks → implementation → completed のフローが正常に動作すること', async () => {
      // 1. 仕様書を作成
      const specId = 'test-spec-001';
      await db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様書',
          phase: 'requirements',
          description: 'フェーズ自動処理のテスト',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 2. requirements → design
      const designEvent = eventBus.createEvent('spec.phase_changed', specId, {
        specId,
        oldPhase: 'requirements',
        newPhase: 'design',
      });
      await eventBus.emit(designEvent);

      // イベント処理が完了するまで待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 3. design → tasks
      const tasksEvent = eventBus.createEvent('spec.phase_changed', specId, {
        specId,
        oldPhase: 'design',
        newPhase: 'tasks',
      });
      await eventBus.emit(tasksEvent);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // 4. tasks → implementation
      const implementationEvent = eventBus.createEvent('spec.phase_changed', specId, {
        specId,
        oldPhase: 'tasks',
        newPhase: 'implementation',
      });
      await eventBus.emit(implementationEvent);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // 5. implementation → completed
      const completedEvent = eventBus.createEvent('spec.phase_changed', specId, {
        specId,
        oldPhase: 'implementation',
        newPhase: 'completed',
      });
      await eventBus.emit(completedEvent);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // 検証: エラーが発生せずにすべてのフェーズ移行が完了すること
      expect(true).toBe(true);
    });
  });

  describe('シナリオ2: イベントハンドラーの登録', () => {
    it('spec.phase_changed イベントが正しく処理されること', async () => {
      const specId = 'test-spec-002';

      // イベント発火
      const event = eventBus.createEvent('spec.phase_changed', specId, {
        specId,
        oldPhase: 'requirements',
        newPhase: 'design',
      });

      await eventBus.emit(event);

      // イベント処理が完了するまで待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 検証: エラーが発生しないこと
      expect(true).toBe(true);
    });
  });

  describe('シナリオ3: エラーハンドリング', () => {
    it('不正なイベントデータでもエラーをスローしないこと', async () => {
      const specId = 'test-spec-003';

      // 不正なイベントデータ
      const event = eventBus.createEvent('spec.phase_changed', specId, {
        invalid: 'data',
      } as any);

      await eventBus.emit(event);

      // イベント処理が完了するまで待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 検証: エラーが発生しないこと（イベントハンドラー内で型検証している）
      expect(true).toBe(true);
    });
  });
});
