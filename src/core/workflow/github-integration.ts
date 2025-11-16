/**
 * GitHub統合のイベントハンドラー
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Kysely } from 'kysely';
import { Database } from '../database/schema.js';
import { EventBus, WorkflowEvent } from './event-bus.js';
import { GitHubClient } from '../../integrations/github/client.js';
import { GitHubIssues } from '../../integrations/github/issues.js';
import { GitHubProjects } from '../../integrations/github/projects.js';
import { resolveProjectId } from '../../integrations/github/project-resolver.js';
import { mapPhaseToStatus, type Phase } from '../../integrations/github/phase-status-mapper.js';

/**
 * GitHub設定を取得
 */
function getGitHubConfig(takumiDir: string): { owner: string; repo: string } | null {
  const configPath = join(takumiDir, 'config.json');
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (!config.github || !config.github.owner || !config.github.repo) {
      return null;
    }

    return {
      owner: config.github.owner,
      repo: config.github.repo,
    };
  } catch {
    return null;
  }
}

/**
 * GitHub統合のイベントハンドラーを登録
 */
export function registerGitHubIntegrationHandlers(eventBus: EventBus, db: Kysely<Database>): void {
  // spec.created → GitHub Issue自動作成
  eventBus.on<{ name: string; description: string | null; phase: string }>(
    'spec.created',
    async (event: WorkflowEvent<{ name: string; description: string | null; phase: string }>) => {
      try {
        // GitHub統合チェック
        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
          // トークンが未設定の場合はスキップ（エラーにしない）
          return;
        }

        const cwd = process.cwd();
        const takumiDir = join(cwd, '.takumi');
        const githubConfig = getGitHubConfig(takumiDir);

        if (!githubConfig) {
          // GitHub設定がない場合はスキップ
          return;
        }

        // 仕様書取得
        const spec = await db
          .selectFrom('specs')
          .where('id', '=', event.specId)
          .selectAll()
          .executeTakeFirst();

        if (!spec) {
          return;
        }

        // 既にIssueが作成されている場合はスキップ
        if (spec.github_issue_id) {
          return;
        }

        // Markdownファイルを読み込んでIssue bodyとして使用
        const specPath = join(takumiDir, 'specs', `${spec.id}.md`);
        let body = '';
        if (existsSync(specPath)) {
          body = readFileSync(specPath, 'utf-8');
        } else {
          body = spec.description || '';
        }

        // GitHub APIクライアント作成
        const client = new GitHubClient({ token: githubToken });
        const issues = new GitHubIssues(client);

        // Issue作成
        const issue = await issues.create({
          owner: githubConfig.owner,
          repo: githubConfig.repo,
          title: spec.name,
          body,
          labels: [`phase:${spec.phase}`],
        });

        // データベース更新
        await db
          .updateTable('specs')
          .set({
            github_issue_id: issue.number,
            updated_at: new Date().toISOString(),
          })
          .where('id', '=', spec.id)
          .execute();

        // 同期ログ記録
        await db
          .insertInto('github_sync')
          .values({
            entity_type: 'issue',
            entity_id: spec.id,
            github_id: issue.number.toString(),
            last_synced_at: new Date().toISOString(),
            sync_status: 'success',
          })
          .execute();

        console.log(`\n✓ GitHub Issue created automatically: #${issue.number}`);
        console.log(`  URL: ${issue.html_url}\n`);

        // Project に自動追加
        try {
          const projectNumber = await resolveProjectId(takumiDir, githubToken);

          if (projectNumber) {
            const projects = new GitHubProjects(client);

            // Project の Node ID を取得
            const project = await projects.get(githubConfig.owner, projectNumber);

            // Issue の Node ID を取得
            const issueNodeId = await projects.getIssueNodeId(
              githubConfig.owner,
              githubConfig.repo,
              issue.number
            );

            // Project に Issue を追加
            const item = await projects.addItem({
              projectId: project.id,
              contentId: issueNodeId,
            });

            // Item ID をデータベースに保存
            await db
              .updateTable('specs')
              .set({ github_project_item_id: item.id })
              .where('id', '=', spec.id)
              .execute();

            console.log(`✓ Added to GitHub Project #${projectNumber}\n`);
          }
        } catch (projectError) {
          // Project 追加失敗は警告のみ（Issue 作成は成功）
          console.warn('Warning: Failed to add issue to project:', projectError);
          console.warn(
            'You can add it manually with: takumi github project add <spec-id> <project-number>\n'
          );
        }
      } catch (error) {
        // エラーが発生しても仕様書作成自体は成功させる
        console.error('Warning: Failed to create GitHub issue automatically:', error);
        console.error(
          'You can create the issue manually with: takumi github issue create <spec-id>\n'
        );
      }
    }
  );

  // spec.phase_changed → GitHub Issue ラベル更新
  eventBus.on<{ oldPhase: string; newPhase: string }>(
    'spec.phase_changed',
    async (event: WorkflowEvent<{ oldPhase: string; newPhase: string }>) => {
      try {
        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
          return;
        }

        const cwd = process.cwd();
        const takumiDir = join(cwd, '.takumi');
        const githubConfig = getGitHubConfig(takumiDir);

        if (!githubConfig) {
          return;
        }

        const spec = await db
          .selectFrom('specs')
          .where('id', '=', event.specId)
          .selectAll()
          .executeTakeFirst();

        if (!spec || !spec.github_issue_id) {
          return;
        }

        const client = new GitHubClient({ token: githubToken });
        const issues = new GitHubIssues(client);
        const projects = new GitHubProjects(client);

        // Issue ラベル更新（既存）
        await issues.update({
          owner: githubConfig.owner,
          repo: githubConfig.repo,
          issueNumber: spec.github_issue_id,
          labels: [`phase:${event.data.newPhase}`],
        });

        // ========== ここから新規追加: Project ステータス更新 ==========

        // Project ステータス更新
        if (spec.github_project_item_id) {
          try {
            const projectNumber = await resolveProjectId(takumiDir, githubToken);
            if (!projectNumber) {
              return;
            }

            const newStatus = mapPhaseToStatus(event.data.newPhase as Phase);

            await projects.updateProjectStatus({
              owner: githubConfig.owner,
              projectNumber,
              itemId: spec.github_project_item_id,
              status: newStatus,
            });

            console.log(`✓ Updated project status to "${newStatus}"`);
          } catch (projectError) {
            // Project 更新失敗は警告のみ（Issue 更新は成功）
            console.warn('Warning: Failed to update project status:', projectError);
          }
        }

        // ========== ここまで新規追加 ==========
      } catch (error) {
        console.error('Warning: Failed to update GitHub issue labels:', error);
      }
    }
  );
}
