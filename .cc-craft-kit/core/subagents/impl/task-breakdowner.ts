import { Kysely } from 'kysely';
import { Database } from '../../database/schema.js';
import { Subagent, SubagentContext, SubagentResult } from '../types.js';
import { randomUUID } from 'crypto';

/**
 * TaskBreakdowner入力
 */
export interface TaskBreakdownerInput {
  specId: string;
  requirements: string[];
  estimatedComplexity?: 'low' | 'medium' | 'high';
}

/**
 * TaskBreakdowner出力
 */
export interface TaskBreakdownerOutput {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: number;
    estimatedHours: number;
    dependencies: string[];
  }>;
  totalEstimatedHours: number;
}

/**
 * TaskBreakdowner Subagent
 * 要件からタスクに分解
 */
export class TaskBreakdowner implements Subagent<TaskBreakdownerInput, TaskBreakdownerOutput> {
  name = 'task-breakdowner';
  description = '要件を実装可能なタスクに分解します';
  version = '1.0.0';

  constructor(private db: Kysely<Database>) {}

  async execute(
    input: TaskBreakdownerInput,
    _context: SubagentContext
  ): Promise<SubagentResult<TaskBreakdownerOutput>> {
    try {
      // タスク分解
      const breakdown = await this.breakdownTasks(input);

      // タスクをDBに保存
      for (const task of breakdown.tasks) {
        await this.db
          .insertInto('tasks')
          .values({
            id: task.id,
            spec_id: input.specId,
            title: task.title,
            description: task.description,
            status: 'todo',
            priority: task.priority,
            github_issue_id: null,
            github_issue_number: null,
            assignee: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute();
      }

      return {
        success: true,
        data: breakdown,
        logs: [`Created ${breakdown.tasks.length} tasks for spec ${input.specId}`],
        nextActions: ['進行: 実装フェーズへ移行', 'タスクをGitHub Issueに同期'],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async validate(input: TaskBreakdownerInput): Promise<boolean> {
    return !!input.specId && input.requirements.length > 0;
  }

  /**
   * タスク分解ロジック
   */
  private async breakdownTasks(input: TaskBreakdownerInput): Promise<TaskBreakdownerOutput> {
    const tasks: TaskBreakdownerOutput['tasks'] = [];
    const complexity = input.estimatedComplexity || 'medium';
    const baseHours = complexity === 'low' ? 2 : complexity === 'high' ? 8 : 4;

    // 要件ごとにタスク作成
    input.requirements.forEach((requirement, index) => {
      // メインタスク
      const mainTaskId = randomUUID();
      tasks.push({
        id: mainTaskId,
        title: requirement.substring(0, 100),
        description: requirement,
        priority: this.calculatePriority(requirement, index),
        estimatedHours: baseHours,
        dependencies: index > 0 ? [tasks[index - 1].id] : [],
      });

      // 複雑な要件の場合はサブタスク追加
      if (complexity === 'high' || requirement.length > 200) {
        tasks.push({
          id: randomUUID(),
          title: `${requirement.substring(0, 50)} - テスト作成`,
          description: `${requirement}のテスト実装`,
          priority: this.calculatePriority(requirement, index),
          estimatedHours: baseHours * 0.5,
          dependencies: [mainTaskId],
        });
      }
    });

    // 共通タスク追加
    if (input.requirements.length > 3) {
      tasks.push({
        id: randomUUID(),
        title: 'ドキュメント作成',
        description: '実装内容のドキュメント作成とREADME更新',
        priority: 2,
        estimatedHours: 2,
        dependencies: tasks.slice(0, 3).map((t) => t.id),
      });
    }

    const totalEstimatedHours = tasks.reduce((sum, task) => sum + task.estimatedHours, 0);

    return {
      tasks,
      totalEstimatedHours,
    };
  }

  /**
   * 優先度計算
   */
  private calculatePriority(requirement: string, index: number): number {
    // キーワードベースの優先度判定
    const highPriorityKeywords = ['critical', 'must', '必須', '重要'];
    const lowPriorityKeywords = ['optional', 'nice to have', 'オプション'];

    if (highPriorityKeywords.some((kw) => requirement.toLowerCase().includes(kw))) {
      return 1; // 最高
    }

    if (lowPriorityKeywords.some((kw) => requirement.toLowerCase().includes(kw))) {
      return 4; // 低
    }

    // デフォルトは順序ベース
    return index < 3 ? 2 : 3;
  }
}
