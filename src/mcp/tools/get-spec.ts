import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../../core/database/connection.js';

/**
 * 仕様書詳細取得ツール
 */
const GetSpecSchema = z.object({
  id: z.string().uuid().describe('仕様書ID'),
});

type GetSpecParams = z.infer<typeof GetSpecSchema>;

interface GetSpecResult {
  success: boolean;
  spec: {
    id: string;
    name: string;
    description: string | null;
    phase: string;
    githubIssueId: number | null;
    githubProjectId: string | null;
    githubMilestoneId: number | null;
    createdAt: string;
    updatedAt: string;
  };
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: number;
    githubIssueId: number | null;
    githubIssueNumber: number | null;
    assignee: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  githubSync: {
    githubId: number;
    githubNumber: number;
    lastSyncedAt: string;
    syncStatus: string;
    errorMessage: string | null;
  } | null;
  stats: {
    totalTasks: number;
    tasksByStatus: {
      todo: number;
      inProgress: number;
      blocked: number;
      review: number;
      done: number;
    };
  };
}

export const getSpecTool: Tool & { handler: (params: GetSpecParams) => Promise<GetSpecResult> } = {
  name: 'takumi:get_spec',
  description: '指定したIDの仕様書詳細を取得します。関連するタスクも含みます。',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: '仕様書ID (UUID)',
      },
    },
    required: ['id'],
  },

  async handler(params: GetSpecParams): Promise<GetSpecResult> {
    const validated = GetSpecSchema.parse(params);
    const db = getDatabase();

    // 仕様書取得
    const spec = await db
      .selectFrom('specs')
      .selectAll()
      .where('id', '=', validated.id)
      .executeTakeFirst();

    if (!spec) {
      throw new Error(`Spec not found: ${validated.id}`);
    }

    // 関連タスク取得
    const tasks = await db
      .selectFrom('tasks')
      .selectAll()
      .where('spec_id', '=', validated.id)
      .orderBy('priority', 'asc')
      .orderBy('created_at', 'asc')
      .execute();

    // GitHub同期情報取得
    const githubSync = await db
      .selectFrom('github_sync')
      .selectAll()
      .where('entity_type', '=', 'spec')
      .where('entity_id', '=', validated.id)
      .executeTakeFirst();

    return {
      success: true,
      spec: {
        id: spec.id,
        name: spec.name,
        description: spec.description,
        phase: spec.phase,
        githubIssueId: spec.github_issue_id,
        githubProjectId: spec.github_project_id,
        githubMilestoneId: spec.github_milestone_id,
        createdAt: spec.created_at.toISOString(),
        updatedAt: spec.updated_at.toISOString(),
      },
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        githubIssueId: task.github_issue_id,
        githubIssueNumber: task.github_issue_number,
        assignee: task.assignee,
        createdAt: task.created_at.toISOString(),
        updatedAt: task.updated_at.toISOString(),
      })),
      githubSync: githubSync
        ? {
            githubId: Number(githubSync.github_id),
            githubNumber: githubSync.github_number ?? 0,
            lastSyncedAt: githubSync.last_synced_at.toISOString(),
            syncStatus: githubSync.sync_status,
            errorMessage: githubSync.error_message,
          }
        : null,
      stats: {
        totalTasks: tasks.length,
        tasksByStatus: {
          todo: tasks.filter((t) => t.status === 'todo').length,
          inProgress: tasks.filter((t) => t.status === 'in_progress').length,
          blocked: tasks.filter((t) => t.status === 'blocked').length,
          review: tasks.filter((t) => t.status === 'review').length,
          done: tasks.filter((t) => t.status === 'done').length,
        },
      },
    };
  },
};
