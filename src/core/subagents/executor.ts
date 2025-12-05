import { Subagent, SubagentContext, SubagentExecution } from './types.js';
import { randomUUID } from 'crypto';
import { appendLog, readLogs } from '../storage/index.js';

/**
 * Subagent実行エンジン
 */
export class SubagentExecutor {
  constructor() {}

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
    this.logExecution(execution, 'started');

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
      this.logExecution(execution, result.success ? 'completed' : 'failed');

      return execution;
    } catch (error) {
      const completedAt = new Date().toISOString();
      const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      execution.completedAt = completedAt;
      execution.duration = duration;

      // ログ記録: 実行失敗
      this.logExecution(execution, 'failed');

      return execution;
    }
  }

  /**
   * 実行ログ記録
   */
  private logExecution(execution: SubagentExecution, action: string): void {
    appendLog({
      task_id: execution.context.taskId || null,
      spec_id: execution.context.specId,
      action: `subagent_${action}`,
      level: execution.status === 'failed' ? 'error' : 'info',
      message: `Subagent "${execution.subagentName}" ${action}`,
      metadata: {
        executionId: execution.id,
        subagentName: execution.subagentName,
        status: execution.status,
        duration: execution.duration,
        error: execution.error,
      },
    });
  }

  /**
   * 実行履歴取得
   */
  getExecutionHistory(specId: string, limit: number = 20): SubagentExecution[] {
    const allLogs = readLogs();

    return allLogs
      .filter((log) => log.spec_id === specId && log.action.startsWith('subagent_'))
      .slice(0, limit)
      .map((log): SubagentExecution => {
        const metadata = log.metadata ?? {};
        const status = (metadata.status as string) || 'pending';
        const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];
        return {
          id: (metadata.executionId as string) || log.id,
          subagentName: (metadata.subagentName as string) || 'unknown',
          status: validStatuses.includes(status)
            ? (status as SubagentExecution['status'])
            : 'pending',
          input: {},
          startedAt: log.timestamp,
          context: { specId, phase: 'pending' },
        };
      });
  }
}
