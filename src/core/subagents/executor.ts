import { Kysely } from 'kysely';
import { Database } from '../database/schema.js';
import { Subagent, SubagentContext, SubagentExecution } from './types.js';
import { randomUUID } from 'crypto';

/**
 * Subagent実行エンジン
 */
export class SubagentExecutor {
  constructor(private db: Kysely<Database>) {}

  /**
   * Subagent実行
   */
  async execute<TInput = unknown, TOutput = unknown>(
    subagent: Subagent<TInput, TOutput>,
    input: TInput,
    context: SubagentContext
  ): Promise<SubagentExecution> {
    const executionId = randomUUID();
    const startedAt = new Date().toISOString();

    // 実行履歴を作成
    const execution: SubagentExecution = {
      id: executionId,
      subagentName: subagent.name,
      status: 'running',
      input,
      startedAt,
      context,
    };

    // ログ記録: 実行開始
    await this.logExecution(execution, 'started');

    try {
      // 入力バリデーション
      const isValid = await subagent.validate(input);
      if (!isValid) {
        throw new Error('Input validation failed');
      }

      // Subagent実行
      const result = await subagent.execute(input, context);

      // 実行完了
      const completedAt = new Date().toISOString();
      const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

      execution.status = result.success ? 'completed' : 'failed';
      execution.output = result.data;
      execution.error = result.error;
      execution.completedAt = completedAt;
      execution.duration = duration;

      // ログ記録: 実行完了
      await this.logExecution(execution, result.success ? 'completed' : 'failed');

      return execution;
    } catch (error) {
      const completedAt = new Date().toISOString();
      const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      execution.completedAt = completedAt;
      execution.duration = duration;

      // ログ記録: 実行失敗
      await this.logExecution(execution, 'failed');

      return execution;
    }
  }

  /**
   * 実行ログ記録
   */
  private async logExecution(execution: SubagentExecution, action: string): Promise<void> {
    await this.db
      .insertInto('logs')
      .values({
        id: randomUUID(),
        task_id: execution.context.taskId || null,
        spec_id: execution.context.specId,
        action: `subagent_${action}`,
        level: execution.status === 'failed' ? 'error' : 'info',
        message: `Subagent "${execution.subagentName}" ${action}`,
        metadata: JSON.stringify({
          executionId: execution.id,
          subagentName: execution.subagentName,
          status: execution.status,
          duration: execution.duration,
          error: execution.error,
        }),
        timestamp: new Date().toISOString(),
      })
      .execute();
  }

  /**
   * 実行履歴取得
   */
  async getExecutionHistory(specId: string, limit: number = 20): Promise<SubagentExecution[]> {
    const logs = await this.db
      .selectFrom('logs')
      .where('spec_id', '=', specId)
      .where('action', 'like', 'subagent_%')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .selectAll()
      .execute();

    return logs.map((log) => {
      const metadata = JSON.parse(log.metadata || '{}');
      return {
        id: metadata.executionId || log.id,
        subagentName: metadata.subagentName || 'unknown',
        status: metadata.status || 'unknown',
        input: {},
        startedAt:
          typeof log.timestamp === 'string' ? log.timestamp : new Date(log.timestamp).toISOString(),
        context: { specId, phase: 'unknown' },
      };
    });
  }
}
