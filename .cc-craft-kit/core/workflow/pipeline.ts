import { Kysely } from 'kysely';
import { Database } from '../database/schema.js';
import { EventBus, getEventBus } from './event-bus.js';
import { getSubagentRegistry } from '../subagents/registry.js';
import { SubagentExecutor } from '../subagents/executor.js';

/**
 * Story-to-Done パイプライン
 * ユーザーストーリーから完成まで自動化
 */
export class StoryToDonePipeline {
  private eventBus: EventBus;
  private executor: SubagentExecutor;

  constructor(private db: Kysely<Database>) {
    this.eventBus = getEventBus();
    this.executor = new SubagentExecutor(db);
    this.registerEventHandlers();
  }

  /**
   * イベントハンドラー登録
   */
  private registerEventHandlers(): void {
    // Spec作成 → 要件分析開始
    this.eventBus.on('spec.created', async (event) => {
      const spec = await this.db
        .selectFrom('specs')
        .where('id', '=', event.specId)
        .selectAll()
        .executeTakeFirst();

      if (!spec) return;

      // RequirementsAnalyzer実行
      const registry = getSubagentRegistry();
      const analyzer = registry.get('requirements-analyzer');

      if (analyzer && spec.description) {
        await this.executor.execute(
          analyzer,
          {
            userStory: spec.description,
          },
          {
            specId: spec.id,
            phase: spec.phase,
          }
        );

        // フェーズ進行
        await this.advancePhase(spec.id, 'design');
      }
    });

    // フェーズ変更 → design → タスク分解
    this.eventBus.on<{ oldPhase: string; newPhase: string }>(
      'spec.phase_changed',
      async (event) => {
        if (event.data.newPhase === 'tasks') {
          const spec = await this.db
            .selectFrom('specs')
            .where('id', '=', event.specId)
            .selectAll()
            .executeTakeFirst();

          if (!spec) return;

          // TaskBreakdowner実行
          const registry = getSubagentRegistry();
          const breakdowner = registry.get('task-breakdowner');

          if (breakdowner) {
            await this.executor.execute(
              breakdowner,
              {
                specId: spec.id,
                requirements: [spec.description || '基本実装'],
              },
              {
                specId: spec.id,
                phase: spec.phase,
              }
            );

            // フェーズ進行
            await this.advancePhase(spec.id, 'implementation');
          }
        }
      }
    );

    // タスク完了 → 次タスク開始
    this.eventBus.on('task.completed', async (event) => {
      // 次の未完了タスクを取得
      const nextTask = await this.db
        .selectFrom('tasks')
        .where('spec_id', '=', event.specId)
        .where('status', '=', 'todo')
        .orderBy('priority', 'asc')
        .selectAll()
        .executeTakeFirst();

      if (nextTask) {
        // タスク開始
        await this.db
          .updateTable('tasks')
          .set({
            status: 'in_progress',
            updated_at: new Date().toISOString(),
          })
          .where('id', '=', nextTask.id)
          .execute();

        await this.eventBus.emit(
          this.eventBus.createEvent('task.status_changed', event.specId, {
            taskId: nextTask.id,
            oldStatus: 'todo',
            newStatus: 'in_progress',
          })
        );
      } else {
        // 全タスク完了 → Spec完了
        await this.advancePhase(event.specId, 'completed');
      }
    });
  }

  /**
   * フェーズ進行
   */
  private async advancePhase(specId: string, newPhase: string): Promise<void> {
    const spec = await this.db
      .selectFrom('specs')
      .where('id', '=', specId)
      .selectAll()
      .executeTakeFirst();

    if (!spec) return;

    await this.db
      .updateTable('specs')
      .set({
        phase: newPhase as 'requirements' | 'design' | 'tasks' | 'implementation' | 'completed',
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', specId)
      .execute();

    await this.eventBus.emit(
      this.eventBus.createEvent('spec.phase_changed', specId, {
        oldPhase: spec.phase,
        newPhase,
      })
    );
  }

  /**
   * パイプライン開始
   */
  async start(specId: string): Promise<void> {
    await this.eventBus.emit(this.eventBus.createEvent('spec.created', specId, { specId }));
  }
}
