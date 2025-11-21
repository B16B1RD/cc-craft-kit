import { Skill, SkillContext, SkillResult } from '../types.js';
import { Kysely } from 'kysely';
import { Database, TaskStatus } from '../../database/schema.js';

// GitHubService型の定義（プレースホルダー）
interface GitHubService {
  createMilestone(params: { title: string; description?: string }): Promise<{ number: number }>;
  createIssue(params: {
    title: string;
    body: string;
    labels?: string[];
    milestone?: number;
  }): Promise<{ id: number; number: number }>;
  updateIssue(
    issueNumber: number,
    params: { title?: string; body?: string; state?: string; labels?: string[] }
  ): Promise<void>;
  listIssues(params: { milestone: number; state: string }): Promise<
    Array<{
      id: number;
      number: number;
      title: string;
      body: string | null;
      state: string;
      assignee?: { login: string };
    }>
  >;
}

export interface GitHubIssueSyncInput {
  specId: string;
  action: 'sync-to-github' | 'sync-from-github' | 'bidirectional';
  taskIds?: string[]; // 特定タスクのみ同期
  createMilestone?: boolean; // Spec用のマイルストーン作成
}

export interface GitHubIssueSyncOutput {
  synced: {
    created: number;
    updated: number;
    skipped: number;
  };
  issues: Array<{
    taskId: string;
    issueNumber: number;
    action: 'created' | 'updated' | 'skipped';
  }>;
  milestoneId?: number;
  summary: string;
}

/**
 * GitHubIssueSync Skill
 * ローカルタスクとGitHub Issuesを同期
 */
export class GitHubIssueSync implements Skill<GitHubIssueSyncInput, GitHubIssueSyncOutput> {
  name = 'github-issue-sync';
  description = 'ローカルタスクとGitHub Issuesを双方向同期します';
  version = '1.0.0';
  category = 'integration' as const;

  constructor(private db: Kysely<Database>) {}

  async execute(
    input: GitHubIssueSyncInput,
    _context: SkillContext
  ): Promise<SkillResult<GitHubIssueSyncOutput>> {
    try {
      // Note: GitHub integration is a placeholder for now
      const github: GitHubService | null = null;
      if (!github) {
        throw new Error('GitHub integration not configured');
      }

      let output: GitHubIssueSyncOutput;

      // アクション別の処理
      switch (input.action) {
        case 'sync-to-github':
          output = await this.syncToGitHub(input, github);
          break;
        case 'sync-from-github':
          output = await this.syncFromGitHub(input, github);
          break;
        case 'bidirectional': {
          const toGitHub = await this.syncToGitHub(input, github);
          const fromGitHub = await this.syncFromGitHub(input, github);
          output = this.mergeSyncResults(toGitHub, fromGitHub);
          break;
        }
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }

      return {
        success: true,
        data: output,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async validate(input: GitHubIssueSyncInput): Promise<boolean> {
    return !!input.specId && !!input.action;
  }

  getSummary(): string {
    return 'GitHub Issue同期: ローカルタスクとGitHub Issuesを双方向同期';
  }

  /**
   * ローカル→GitHubへ同期
   */
  private async syncToGitHub(
    input: GitHubIssueSyncInput,
    github: GitHubService
  ): Promise<GitHubIssueSyncOutput> {
    const synced = { created: 0, updated: 0, skipped: 0 };
    const issues: GitHubIssueSyncOutput['issues'] = [];
    let milestoneId: number | undefined;

    // Spec取得（github_sync テーブルとの LEFT JOIN）
    const spec = await this.db
      .selectFrom('specs')
      .leftJoin('github_sync', (join) =>
        join
          .onRef('github_sync.entity_id', '=', 'specs.id')
          .on('github_sync.entity_type', '=', 'spec')
      )
      .where('specs.id', '=', input.specId)
      .select([
        'specs.id',
        'specs.name',
        'specs.description',
        'github_sync.github_number as github_milestone_id',
      ])
      .executeTakeFirst();

    if (!spec) {
      throw new Error(`Spec not found: ${input.specId}`);
    }

    // マイルストーン作成
    if (input.createMilestone && spec.github_milestone_id === null) {
      try {
        const milestone = await github.createMilestone({
          title: spec.name,
          description: spec.description || undefined,
        });

        milestoneId = milestone.number;

        // github_sync テーブルにマイルストーンを記録
        const { randomUUID } = await import('crypto');
        await this.db
          .insertInto('github_sync')
          .values({
            id: randomUUID(),
            entity_type: 'spec',
            entity_id: input.specId,
            github_id: milestoneId.toString(),
            github_number: milestoneId,
            last_synced_at: new Date().toISOString(),
            sync_status: 'success',
            error_message: null,
          })
          .execute();
      } catch (error) {
        console.error('Failed to create milestone:', error);
      }
    } else {
      milestoneId = spec.github_milestone_id || undefined;
    }

    // タスク取得
    let tasksQuery = this.db.selectFrom('tasks').where('spec_id', '=', input.specId);

    if (input.taskIds && input.taskIds.length > 0) {
      tasksQuery = tasksQuery.where('id', 'in', input.taskIds);
    }

    const tasks = await tasksQuery.selectAll().execute();

    // 各タスクをGitHub Issueに同期
    for (const task of tasks) {
      try {
        if (task.github_issue_number === null) {
          // 新規Issue作成
          const issue = await github.createIssue({
            title: task.title,
            body: task.description || '',
            labels: [this.mapStatusToLabel(task.status)],
            milestone: milestoneId,
          });

          await this.db
            .updateTable('tasks')
            .set({
              github_issue_id: issue.id,
              github_issue_number: issue.number,
              updated_at: new Date().toISOString(),
            })
            .where('id', '=', task.id)
            .execute();

          synced.created++;
          issues.push({
            taskId: task.id,
            issueNumber: issue.number,
            action: 'created',
          });
        } else {
          // 既存Issue更新
          await github.updateIssue(task.github_issue_number, {
            title: task.title,
            body: task.description || undefined,
            state: task.status === 'done' ? 'closed' : 'open',
            labels: [this.mapStatusToLabel(task.status)],
          });

          synced.updated++;
          issues.push({
            taskId: task.id,
            issueNumber: task.github_issue_number,
            action: 'updated',
          });
        }
      } catch {
        synced.skipped++;
        issues.push({
          taskId: task.id,
          issueNumber: task.github_issue_number || 0,
          action: 'skipped',
        });
      }
    }

    return {
      synced,
      issues,
      milestoneId,
      summary: `GitHub同期完了: 作成${synced.created}件, 更新${synced.updated}件, スキップ${synced.skipped}件`,
    };
  }

  /**
   * GitHub→ローカルへ同期
   */
  private async syncFromGitHub(
    input: GitHubIssueSyncInput,
    github: GitHubService
  ): Promise<GitHubIssueSyncOutput> {
    const synced = { created: 0, updated: 0, skipped: 0 };
    const issues: GitHubIssueSyncOutput['issues'] = [];

    // Spec取得（github_sync テーブルとの LEFT JOIN）
    const spec = await this.db
      .selectFrom('specs')
      .leftJoin('github_sync', (join) =>
        join
          .onRef('github_sync.entity_id', '=', 'specs.id')
          .on('github_sync.entity_type', '=', 'spec')
      )
      .where('specs.id', '=', input.specId)
      .select(['specs.id', 'github_sync.github_number as github_milestone_id'])
      .executeTakeFirst();

    if (!spec || !spec.github_milestone_id) {
      return {
        synced,
        issues,
        summary: 'GitHubマイルストーンが設定されていません',
      };
    }

    // マイルストーンのIssue一覧取得
    const githubIssues = await github.listIssues({
      milestone: spec.github_milestone_id,
      state: 'all',
    });

    // 各IssueをローカルTaskに同期
    for (const githubIssue of githubIssues) {
      try {
        // 既存タスク検索
        const existingTask = await this.db
          .selectFrom('tasks')
          .where('github_issue_number', '=', githubIssue.number)
          .selectAll()
          .executeTakeFirst();

        if (!existingTask) {
          // 新規タスク作成
          await this.db
            .insertInto('tasks')
            .values({
              id: `task-${Date.now()}-${Math.random()}`,
              spec_id: input.specId,
              title: githubIssue.title,
              description: githubIssue.body || '',
              status: this.mapIssueStateToStatus(githubIssue.state) as TaskStatus,
              priority: 3,
              github_issue_id: githubIssue.id,
              github_issue_number: githubIssue.number,
              assignee: githubIssue.assignee?.login || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .execute();

          synced.created++;
          issues.push({
            taskId: `task-${githubIssue.number}`,
            issueNumber: githubIssue.number,
            action: 'created',
          });
        } else {
          // 既存タスク更新
          await this.db
            .updateTable('tasks')
            .set({
              title: githubIssue.title,
              description: githubIssue.body || existingTask.description,
              status: this.mapIssueStateToStatus(githubIssue.state) as TaskStatus,
              assignee: githubIssue.assignee?.login || existingTask.assignee,
              updated_at: new Date().toISOString(),
            })
            .where('id', '=', existingTask.id)
            .execute();

          synced.updated++;
          issues.push({
            taskId: existingTask.id,
            issueNumber: githubIssue.number,
            action: 'updated',
          });
        }
      } catch {
        synced.skipped++;
      }
    }

    return {
      synced,
      issues,
      summary: `ローカル同期完了: 作成${synced.created}件, 更新${synced.updated}件, スキップ${synced.skipped}件`,
    };
  }

  /**
   * 同期結果のマージ
   */
  private mergeSyncResults(
    result1: GitHubIssueSyncOutput,
    result2: GitHubIssueSyncOutput
  ): GitHubIssueSyncOutput {
    return {
      synced: {
        created: result1.synced.created + result2.synced.created,
        updated: result1.synced.updated + result2.synced.updated,
        skipped: result1.synced.skipped + result2.synced.skipped,
      },
      issues: [...result1.issues, ...result2.issues],
      milestoneId: result1.milestoneId || result2.milestoneId,
      summary: `双方向同期完了: 作成${result1.synced.created + result2.synced.created}件, 更新${result1.synced.updated + result2.synced.updated}件`,
    };
  }

  /**
   * タスクステータス→GitHubラベルマッピング
   */
  private mapStatusToLabel(status: string): string {
    switch (status) {
      case 'todo':
        return 'status: todo';
      case 'in_progress':
        return 'status: in-progress';
      case 'review':
        return 'status: review';
      case 'done':
        return 'status: done';
      case 'blocked':
        return 'status: blocked';
      default:
        return 'status: todo';
    }
  }

  /**
   * GitHubステータス→タスクステータスマッピング
   */
  private mapIssueStateToStatus(state: string): string {
    switch (state) {
      case 'open':
        return 'todo';
      case 'closed':
        return 'done';
      default:
        return 'todo';
    }
  }
}
