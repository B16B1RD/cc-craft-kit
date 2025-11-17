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
        // 仕様書とIssueの同期記録
        // entity_type は 'spec' を使用（'issue' ではない）
        await db
          .insertInto('github_sync')
          .values({
            entity_type: 'spec',
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

        // Issue タイトル・ラベル更新（本文は履歴保持のため更新しない）
        await issues.update({
          owner: githubConfig.owner,
          repo: githubConfig.repo,
          issueNumber: spec.github_issue_id,
          title: `[${event.data.newPhase}] ${spec.name}`,
          labels: [`phase:${event.data.newPhase}`],
        });

        // フェーズ移行をコメントで記録
        const phaseChangeComment = `## 🔄 フェーズ移行

フェーズが更新されました。

**変更前:** ${event.data.oldPhase}
**変更後:** ${event.data.newPhase}
**変更日時:** ${new Date().toLocaleString('ja-JP')}
**最新の仕様書:** [\`.takumi/specs/${spec.id}.md\`](../../.takumi/specs/${spec.id}.md)
`;

        try {
          await issues.addComment(
            githubConfig.owner,
            githubConfig.repo,
            spec.github_issue_id,
            phaseChangeComment
          );
        } catch (commentError) {
          console.warn('Warning: Failed to add phase change comment:', commentError);
        }

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

        // completed フェーズで Issue をクローズ
        if (event.data.newPhase === 'completed') {
          try {
            const closeComment = `## ✅ 実装完了

この仕様書の実装が完了しました。

**完了日時:** ${new Date().toLocaleString('ja-JP')}
**最終フェーズ:** completed
**仕様書:** [\`.takumi/specs/${spec.id}.md\`](../../.takumi/specs/${spec.id}.md)
`;

            await issues.addComment(
              githubConfig.owner,
              githubConfig.repo,
              spec.github_issue_id,
              closeComment
            );

            await issues.close(githubConfig.owner, githubConfig.repo, spec.github_issue_id);

            console.log(`✓ GitHub Issue #${spec.github_issue_id} closed automatically`);
          } catch (closeError) {
            console.warn('Warning: Failed to close GitHub issue:', closeError);
          }
        }
      } catch (error) {
        console.error('Warning: Failed to update GitHub issue labels:', error);
      }
    }
  );

  // knowledge.progress_recorded → GitHub Issue コメント追加
  eventBus.on('knowledge.progress_recorded', async (event: WorkflowEvent) => {
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

      const data = event.data as { message: string; timestamp: string };
      const comment = `## 📊 進捗記録

${data.message}

**記録日時:** ${new Date(data.timestamp).toLocaleString('ja-JP')}
`;

      try {
        await issues.addComment(
          githubConfig.owner,
          githubConfig.repo,
          spec.github_issue_id,
          comment
        );
      } catch (commentError) {
        console.warn('Warning: Failed to add progress comment:', commentError);
      }
    } catch (error) {
      console.error('Warning: Failed to handle knowledge.progress_recorded event:', error);
    }
  });

  // knowledge.error_recorded → GitHub Issue コメント追加
  eventBus.on('knowledge.error_recorded', async (event: WorkflowEvent) => {
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

      const data = event.data as { errorDescription: string; solution: string; timestamp: string };
      const comment = `## 🐛 エラー解決策

**エラー内容:**
${data.errorDescription}

**解決策:**
${data.solution}

**記録日時:** ${new Date(data.timestamp).toLocaleString('ja-JP')}
`;

      try {
        await issues.addComment(
          githubConfig.owner,
          githubConfig.repo,
          spec.github_issue_id,
          comment
        );
      } catch (commentError) {
        console.warn('Warning: Failed to add error solution comment:', commentError);
      }
    } catch (error) {
      console.error('Warning: Failed to handle knowledge.error_recorded event:', error);
    }
  });

  // knowledge.tip_recorded → GitHub Issue コメント追加
  eventBus.on('knowledge.tip_recorded', async (event: WorkflowEvent) => {
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

      const data = event.data as {
        category: string;
        title: string;
        content: string;
        timestamp: string;
      };
      const comment = `## 💡 Tips: ${data.category}

**${data.title}**

${data.content}

**記録日時:** ${new Date(data.timestamp).toLocaleString('ja-JP')}
`;

      try {
        await issues.addComment(
          githubConfig.owner,
          githubConfig.repo,
          spec.github_issue_id,
          comment
        );
      } catch (commentError) {
        console.warn('Warning: Failed to add tip comment:', commentError);
      }
    } catch (error) {
      console.error('Warning: Failed to handle knowledge.tip_recorded event:', error);
    }
  });

  // spec.updated → GitHub Issue 本文更新 + コメント追加
  eventBus.on('spec.updated', async (event: WorkflowEvent) => {
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

      // 仕様書ファイルを読み込む
      const specPath = join(takumiDir, 'specs', `${spec.id}.md`);
      if (!existsSync(specPath)) {
        console.warn(`Warning: Spec file not found: ${specPath}`);
        return;
      }

      const specContent = readFileSync(specPath, 'utf-8');

      const client = new GitHubClient({ token: githubToken });
      const issues = new GitHubIssues(client);

      // Issue 本文を仕様書の最新内容で更新
      try {
        await issues.update({
          owner: githubConfig.owner,
          repo: githubConfig.repo,
          issueNumber: spec.github_issue_id,
          body: specContent,
        });
      } catch (updateError) {
        console.warn('Warning: Failed to update issue body:', updateError);
      }

      // 仕様書更新をコメントで記録
      const updateComment = `## 📝 仕様書更新

仕様書が更新されました。Issue 本文を最新の内容で更新しました。

**更新日時:** ${new Date().toLocaleString('ja-JP')}
**最新の仕様書:** [\`.takumi/specs/${spec.id}.md\`](../../.takumi/specs/${spec.id}.md)
`;

      try {
        await issues.addComment(
          githubConfig.owner,
          githubConfig.repo,
          spec.github_issue_id,
          updateComment
        );
      } catch (commentError) {
        console.warn('Warning: Failed to add spec update comment:', commentError);
      }
    } catch (error) {
      console.error('Warning: Failed to handle spec.updated event:', error);
    }
  });
}
