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
import { GitHubSyncService } from '../../integrations/github/sync.js';
import { resolveProjectId } from '../../integrations/github/project-resolver.js';
import { mapPhaseToStatus, type Phase } from '../../integrations/github/phase-status-mapper.js';
import { SubIssueManager } from '../../integrations/github/sub-issues.js';
import { parseTaskListFromSpec } from '../utils/task-parser.js';
import { getErrorHandler } from '../errors/error-handler.js';
import { getSpecWithGitHubInfo } from '../database/helpers.js';
import {
  detectChanges,
  buildChangelogComment,
  formatChangeSummary,
} from '../../integrations/github/changelog-writer.js';
import { z } from 'zod';

/**
 * task.completed イベントデータのスキーマ
 */
const TaskCompletedEventDataSchema = z.object({
  taskId: z.string().uuid('taskId must be a valid UUID'),
});

/**
 * エラーをログに記録
 */
async function logError(
  level: 'error' | 'warn' | 'info',
  message: string,
  error: unknown,
  context: Record<string, unknown>
): Promise<void> {
  const errorHandler = getErrorHandler();
  const errorObj = error instanceof Error ? error : new Error(String(error));

  await errorHandler.handle(errorObj, {
    ...context,
    originalMessage: message,
  });

  // デバッグモードではコンソール出力も行う
  if (process.env.DEBUG === '1') {
    if (level === 'error') {
      console.error(message, error);
    } else if (level === 'warn') {
      console.warn(message, error);
    } else {
      console.log(message, error);
    }
  }
}

/**
 * GitHub設定を取得
 */
function getGitHubConfig(ccCraftKitDir: string): { owner: string; repo: string } | null {
  const configPath = join(ccCraftKitDir, 'config.json');
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
          // トークンが未設定の場合は警告を出力してスキップ
          console.warn(`
⚠️ GitHub Issue が自動作成されませんでした

原因: GITHUB_TOKEN 環境変数が設定されていません

対処方法:
1. GitHub Personal Access Token を作成
   https://github.com/settings/tokens/new?scopes=repo,project

2. .env ファイルに以下を追加:
   GITHUB_TOKEN=ghp_xxxxxxxxxxxx

3. /cft:github-init <owner> <repo> を実行して GitHub 統合を初期化

手動で Issue を作成する場合:
   /cft:github-issue-create ${event.specId.substring(0, 8)}
`);
          return;
        }

        const cwd = process.cwd();
        const ccCraftKitDir = join(cwd, '.cc-craft-kit');
        const githubConfig = getGitHubConfig(ccCraftKitDir);

        if (!githubConfig) {
          // GitHub 設定がない場合は警告を出力してスキップ
          console.warn(`
⚠️ GitHub Issue が自動作成されませんでした

原因: GitHub 統合が初期化されていません

対処方法:
1. /cft:github-init <owner> <repo> を実行して GitHub 統合を初期化

   例: /cft:github-init myorg myrepo

手動で Issue を作成する場合:
   /cft:github-issue-create ${event.specId.substring(0, 8)}
`);
          return;
        }

        // GitHub APIクライアント作成
        const client = new GitHubClient({ token: githubToken });
        const issues = new GitHubIssues(client);
        const projects = new GitHubProjects(client);
        const syncService = new GitHubSyncService(db, issues, projects);

        // syncSpecToIssue メソッドで Issue 作成（重複チェック込み）
        const issueNumber = await syncService.syncSpecToIssue({
          specId: event.specId,
          owner: githubConfig.owner,
          repo: githubConfig.repo,
          createIfNotExists: true,
        });

        console.log(`\n✓ GitHub Issue created automatically: #${issueNumber}`);
        console.log(
          `  URL: https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/${issueNumber}\n`
        );

        // Project に自動追加
        try {
          const projectNumber = await resolveProjectId(ccCraftKitDir, githubToken);

          if (projectNumber) {
            // addSpecToProject メソッドを使用（重複チェック込み）
            await syncService.addSpecToProject({
              specId: event.specId,
              owner: githubConfig.owner,
              projectNumber,
            });

            console.log(`✓ Added to GitHub Project #${projectNumber}\n`);
          }
        } catch (projectError) {
          // Project 追加失敗は警告のみ（Issue 作成は成功）
          await logError('warn', 'Failed to add issue to GitHub Project', projectError, {
            event: 'spec.created',
            specId: event.specId,
            action: 'add_to_project',
          });
          console.log(
            'You can add it manually with: /cft:github-project-add <spec-id> <project-number>\n'
          );
        }
      } catch (error) {
        // 重複エラーの場合は警告のみ表示（エラーログ記録なし）
        if (
          error instanceof Error &&
          error.message.includes('既に GitHub Issue が作成されています')
        ) {
          console.warn(`⚠️  ${error.message}\n`);
          return;
        }

        // その他のエラーが発生しても仕様書作成自体は成功させる
        await logError('error', 'Failed to create GitHub issue automatically', error, {
          event: 'spec.created',
          specId: event.specId,
          action: 'create_issue',
        });
        console.log('You can create the issue manually with: /cft:github-issue-create <spec-id>\n');
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
        const ccCraftKitDir = join(cwd, '.cc-craft-kit');
        const githubConfig = getGitHubConfig(ccCraftKitDir);

        if (!githubConfig) {
          return;
        }

        const spec = await getSpecWithGitHubInfo(db, event.specId);

        if (!spec || !spec.github_issue_number) {
          return;
        }

        const client = new GitHubClient({ token: githubToken });
        const issues = new GitHubIssues(client);
        const projects = new GitHubProjects(client);

        // Issue タイトル・ラベル更新 + 仕様書ファイルから本文を更新
        const specPath = join(ccCraftKitDir, 'specs', `${spec.id}.md`);
        let newSpecContent = '';

        if (existsSync(specPath)) {
          try {
            newSpecContent = readFileSync(specPath, 'utf-8');
            if (process.env.DEBUG === '1') {
              console.log(`[DEBUG] Read spec file: ${specPath} (${newSpecContent.length} bytes)`);
            }
          } catch (error) {
            await logError('warn', `Failed to read spec file: ${specPath}`, error, {
              event: 'spec.phase_changed',
              specId: event.specId,
              action: 'read_spec_file',
            });
          }
        } else {
          if (process.env.DEBUG === '1') {
            console.log(`[DEBUG] Spec file not found: ${specPath}`);
          }
        }

        // 既存の Issue 内容を取得して変更を検出
        let oldContent = '';
        try {
          const existingIssue = await issues.get(
            githubConfig.owner,
            githubConfig.repo,
            spec.github_issue_number
          );
          oldContent = existingIssue.body || '';
          if (process.env.DEBUG === '1') {
            console.log(`[DEBUG] Fetched existing issue body (${oldContent.length} bytes)`);
          }
        } catch (fetchError) {
          await logError(
            'warn',
            'Failed to fetch existing Issue for change detection',
            fetchError,
            {
              event: 'spec.phase_changed',
              specId: event.specId,
              action: 'fetch_existing_issue',
            }
          );
        }

        // 変更を検出
        const changes = detectChanges(oldContent, newSpecContent);
        if (process.env.DEBUG === '1') {
          console.log(`[DEBUG] Detected ${changes.length} changes`);
        }

        // Issue を更新（本文を必ず含める）
        await issues.update({
          owner: githubConfig.owner,
          repo: githubConfig.repo,
          issueNumber: spec.github_issue_number,
          title: `[${event.data.newPhase}] ${spec.name}`,
          labels: [`phase:${event.data.newPhase}`],
          body: newSpecContent || oldContent, // 新しい内容がなければ既存を維持
        });

        // フェーズ移行をコメントで記録
        const phaseChangeComment = `## 🔄 フェーズ移行

フェーズが更新されました。

**変更前:** ${event.data.oldPhase}
**変更後:** ${event.data.newPhase}
**変更日時:** ${new Date().toLocaleString('ja-JP')}
**最新の仕様書:** [\`.cc-craft-kit/specs/${spec.id}.md\`](../../.cc-craft-kit/specs/${spec.id}.md)
`;

        try {
          await issues.addComment(
            githubConfig.owner,
            githubConfig.repo,
            spec.github_issue_number,
            phaseChangeComment
          );
        } catch (commentError) {
          await logError(
            'warn',
            'Failed to add phase change comment to GitHub Issue',
            commentError,
            {
              event: 'spec.phase_changed',
              specId: event.specId,
              oldPhase: event.data.oldPhase,
              newPhase: event.data.newPhase,
              action: 'add_comment',
            }
          );
        }

        // 変更履歴コメントを追加（変更がある場合のみ）
        if (changes.length > 0) {
          const changelogComment = buildChangelogComment(changes, spec.id);
          const changeSummary = formatChangeSummary(changes);

          try {
            await issues.addComment(
              githubConfig.owner,
              githubConfig.repo,
              spec.github_issue_number,
              changelogComment
            );

            if (process.env.DEBUG === '1') {
              console.log(`[DEBUG] Changelog comment added: ${changeSummary}`);
            }
          } catch (changelogError) {
            await logError(
              'warn',
              'Failed to add changelog comment to GitHub Issue',
              changelogError,
              {
                event: 'spec.phase_changed',
                specId: event.specId,
                action: 'add_changelog_comment',
                changesCount: changes.length,
              }
            );
          }
        } else {
          if (process.env.DEBUG === '1') {
            console.log('[DEBUG] No changes detected, skipping changelog comment');
          }
        }

        // ========== ここから新規追加: Project ステータス更新 ==========

        // Project ステータス更新
        // github_sync テーブルから project_item_id を取得
        const projectSync = await db
          .selectFrom('github_sync')
          .where('entity_id', '=', spec.id)
          .where('entity_type', '=', 'project')
          .selectAll()
          .executeTakeFirst();

        if (projectSync) {
          try {
            const projectNumber = await resolveProjectId(ccCraftKitDir, githubToken);
            if (!projectNumber) {
              return;
            }

            const newStatus = mapPhaseToStatus(event.data.newPhase as Phase);

            await projects.updateProjectStatus({
              owner: githubConfig.owner,
              projectNumber,
              itemId: projectSync.github_id,
              status: newStatus,
            });

            // ステータス更新を検証＋リトライ
            try {
              const verification = await projects.verifyProjectStatusUpdate({
                owner: githubConfig.owner,
                projectNumber,
                itemId: projectSync.github_id,
                expectedStatus: newStatus,
                maxRetries: 3,
              });

              if (verification.success) {
                console.log(
                  `✓ Updated project status to "${verification.actualStatus}"` +
                    (verification.attempts > 1 ? ` (${verification.attempts} attempts)` : '')
                );
              } else {
                console.warn(
                  `⚠ Failed to update project status after ${verification.attempts} retries.\n` +
                    `Expected: "${newStatus}", ` +
                    `Actual: "${verification.actualStatus}"\n` +
                    `Please check GitHub Projects manually.`
                );

                await logError(
                  'error',
                  'Project status update verification failed',
                  new Error('Status verification failed'),
                  {
                    specId: event.specId,
                    expectedStatus: newStatus,
                    actualStatus: verification.actualStatus,
                    attempts: verification.attempts,
                  }
                );
              }
            } catch (verificationError) {
              // レート制限エラー、認証エラーなどの致命的なエラー
              if (
                verificationError instanceof Error &&
                verificationError.message.includes('rate limit')
              ) {
                console.warn(
                  `⚠ GitHub API rate limit exceeded.\n` +
                    `Status update will be retried after reset.`
                );
              } else {
                console.error('Failed to verify project status update:', verificationError);
              }

              await logError(
                'error',
                'Project status update verification error',
                verificationError instanceof Error
                  ? verificationError
                  : new Error(String(verificationError)),
                {
                  specId: event.specId,
                }
              );
            }
          } catch (projectError) {
            // Project 更新失敗は警告のみ（Issue 更新は成功）
            await logError('warn', 'Failed to update GitHub Project status', projectError, {
              event: 'spec.phase_changed',
              specId: event.specId,
              oldPhase: event.data.oldPhase,
              newPhase: event.data.newPhase,
              action: 'update_project_status',
            });
          }
        }

        // ========== ここまで新規追加 ==========

        // design フェーズ移行時に Sub Issue を自動作成
        // 注意: tasks フェーズは非推奨。design フェーズでタスク分割と Sub Issue 作成を同時実行
        if (event.data.newPhase === 'design' || event.data.newPhase === 'tasks') {
          try {
            const specPath = join(ccCraftKitDir, 'specs', `${spec.id}.md`);
            if (!existsSync(specPath)) {
              await logError(
                'warn',
                'Spec file not found for Sub Issue creation',
                new Error('File not found'),
                {
                  event: 'spec.phase_changed',
                  specId: event.specId,
                  newPhase: event.data.newPhase,
                  action: 'create_sub_issues',
                  specPath,
                }
              );
              return;
            }

            // 仕様書からタスクリストを解析
            const taskList = await parseTaskListFromSpec(specPath);

            if (taskList.length === 0) {
              // design フェーズではタスクリストがなくても正常（まだ生成されていない場合がある）
              if (event.data.newPhase === 'design') {
                console.log(
                  'No tasks found yet, Sub Issue creation will be handled by spec-phase.md'
                );
              } else {
                console.log('No tasks found in spec file, skipping Sub Issue creation');
              }
              return;
            }

            // Sub Issue を作成（specId を含めて親 Issue 関連性を記録）
            const subIssueManager = new SubIssueManager(db);
            await subIssueManager.createSubIssuesFromTaskList({
              owner: githubConfig.owner,
              repo: githubConfig.repo,
              parentIssueNumber: spec.github_issue_number,
              taskList,
              githubToken,
              specId: spec.id,
            });

            console.log(`✓ Created ${taskList.length} Sub Issues for spec ${spec.name}`);
          } catch (subIssueError) {
            await logError('warn', 'Failed to create Sub Issues', subIssueError, {
              event: 'spec.phase_changed',
              specId: event.specId,
              newPhase: event.data.newPhase,
              action: 'create_sub_issues',
            });
          }
        }

        // completed フェーズで Issue をクローズ
        if (event.data.newPhase === 'completed') {
          try {
            const closeComment = `## ✅ 実装完了

この仕様書の実装が完了しました。

**完了日時:** ${new Date().toLocaleString('ja-JP')}
**最終フェーズ:** completed
**仕様書:** [\`.cc-craft-kit/specs/${spec.id}.md\`](../../.cc-craft-kit/specs/${spec.id}.md)
`;

            await issues.addComment(
              githubConfig.owner,
              githubConfig.repo,
              spec.github_issue_number,
              closeComment
            );

            await issues.close(githubConfig.owner, githubConfig.repo, spec.github_issue_number);

            console.log(`✓ GitHub Issue #${spec.github_issue_number} closed automatically`);
          } catch (closeError) {
            await logError('warn', 'Failed to close GitHub Issue', closeError, {
              event: 'spec.phase_changed',
              specId: event.specId,
              newPhase: event.data.newPhase,
              action: 'close_issue',
            });
          }
        }
      } catch (error) {
        await logError('error', 'Failed to update GitHub Issue labels and status', error, {
          event: 'spec.phase_changed',
          specId: event.specId,
          action: 'update_issue',
        });
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
      const ccCraftKitDir = join(cwd, '.cc-craft-kit');
      const githubConfig = getGitHubConfig(ccCraftKitDir);

      if (!githubConfig) {
        return;
      }

      const spec = await getSpecWithGitHubInfo(db, event.specId);

      if (!spec || !spec.github_issue_number) {
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
          spec.github_issue_number,
          comment
        );
      } catch (commentError) {
        await logError('warn', 'Failed to add progress comment to GitHub Issue', commentError, {
          event: 'knowledge.progress_recorded',
          specId: event.specId,
          action: 'add_comment',
        });
      }
    } catch (error) {
      await logError('error', 'Failed to handle knowledge.progress_recorded event', error, {
        event: 'knowledge.progress_recorded',
        specId: event.specId,
      });
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
      const ccCraftKitDir = join(cwd, '.cc-craft-kit');
      const githubConfig = getGitHubConfig(ccCraftKitDir);

      if (!githubConfig) {
        return;
      }

      const spec = await getSpecWithGitHubInfo(db, event.specId);

      if (!spec || !spec.github_issue_number) {
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
          spec.github_issue_number,
          comment
        );
      } catch (commentError) {
        await logError(
          'warn',
          'Failed to add error solution comment to GitHub Issue',
          commentError,
          {
            event: 'knowledge.error_recorded',
            specId: event.specId,
            action: 'add_comment',
          }
        );
      }
    } catch (error) {
      await logError('error', 'Failed to handle knowledge.error_recorded event', error, {
        event: 'knowledge.error_recorded',
        specId: event.specId,
      });
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
      const ccCraftKitDir = join(cwd, '.cc-craft-kit');
      const githubConfig = getGitHubConfig(ccCraftKitDir);

      if (!githubConfig) {
        return;
      }

      const spec = await getSpecWithGitHubInfo(db, event.specId);

      if (!spec || !spec.github_issue_number) {
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
          spec.github_issue_number,
          comment
        );
      } catch (commentError) {
        await logError('warn', 'Failed to add tip comment to GitHub Issue', commentError, {
          event: 'knowledge.tip_recorded',
          specId: event.specId,
          action: 'add_comment',
        });
      }
    } catch (error) {
      await logError('error', 'Failed to handle knowledge.tip_recorded event', error, {
        event: 'knowledge.tip_recorded',
        specId: event.specId,
      });
    }
  });

  // spec.updated → GitHub Issue 本文更新 + 変更履歴コメント追加
  eventBus.on('spec.updated', async (event: WorkflowEvent) => {
    try {
      const githubToken = process.env.GITHUB_TOKEN;
      if (!githubToken) {
        return;
      }

      const cwd = process.cwd();
      const ccCraftKitDir = join(cwd, '.cc-craft-kit');
      const githubConfig = getGitHubConfig(ccCraftKitDir);

      if (!githubConfig) {
        return;
      }

      const spec = await getSpecWithGitHubInfo(db, event.specId);

      if (!spec || !spec.github_issue_number) {
        return;
      }

      // 仕様書ファイルを読み込む
      const specPath = join(ccCraftKitDir, 'specs', `${spec.id}.md`);
      if (!existsSync(specPath)) {
        await logError(
          'warn',
          'Spec file not found for GitHub Issue update',
          new Error('File not found'),
          {
            event: 'spec.updated',
            specId: event.specId,
            action: 'update_issue',
            specPath,
          }
        );
        return;
      }

      const specContent = readFileSync(specPath, 'utf-8');

      const client = new GitHubClient({ token: githubToken });
      const issues = new GitHubIssues(client);

      // 既存の Issue 本文を取得して変更を検出
      let oldContent = '';
      try {
        const existingIssue = await issues.get(
          githubConfig.owner,
          githubConfig.repo,
          spec.github_issue_number
        );
        oldContent = existingIssue.body || '';
      } catch {
        // Issue 取得に失敗した場合は変更検出をスキップ
      }

      // 変更を検出
      const changes = detectChanges(oldContent, specContent);

      // Issue 本文を仕様書の最新内容で更新
      try {
        await issues.update({
          owner: githubConfig.owner,
          repo: githubConfig.repo,
          issueNumber: spec.github_issue_number,
          body: specContent,
        });
      } catch (updateError) {
        await logError('warn', 'Failed to update GitHub Issue body', updateError, {
          event: 'spec.updated',
          specId: event.specId,
          action: 'update_issue_body',
        });
      }

      // 変更履歴をコメントで記録（変更がある場合のみ）
      if (changes.length > 0) {
        const changelogComment = buildChangelogComment(changes, spec.id);
        const changeSummary = formatChangeSummary(changes);

        try {
          await issues.addComment(
            githubConfig.owner,
            githubConfig.repo,
            spec.github_issue_number,
            changelogComment
          );

          if (process.env.DEBUG === '1') {
            console.log(`✓ Changelog comment added: ${changeSummary}`);
          }
        } catch (commentError) {
          await logError('warn', 'Failed to add changelog comment to GitHub Issue', commentError, {
            event: 'spec.updated',
            specId: event.specId,
            action: 'add_changelog_comment',
          });
        }
      }
    } catch (error) {
      await logError('error', 'Failed to handle spec.updated event', error, {
        event: 'spec.updated',
        specId: event.specId,
      });
    }
  });

  // spec.deleted → GitHub Projects ステータス更新
  eventBus.on('spec.deleted', async (event: WorkflowEvent) => {
    try {
      const githubToken = process.env.GITHUB_TOKEN;
      if (!githubToken) {
        return;
      }

      const ccCraftKitDir = join(process.cwd(), '.cc-craft-kit');
      const githubConfig = getGitHubConfig(ccCraftKitDir);

      if (!githubConfig) {
        return;
      }

      // GitHub Projects 同期情報を取得
      const projectSync = await db
        .selectFrom('github_sync')
        .select(['github_id'])
        .where('entity_id', '=', event.specId)
        .where('entity_type', '=', 'project')
        .executeTakeFirst();

      if (!projectSync) {
        // Project に追加されていない場合はスキップ
        return;
      }

      try {
        // GitHub API クライアント作成
        const client = new GitHubClient({ token: githubToken });
        const projects = new GitHubProjects(client);

        // Project 番号を解決
        const projectNumber = await resolveProjectId(ccCraftKitDir, githubToken);

        if (!projectNumber) {
          await logError(
            'warn',
            'GitHub Project number not found',
            new Error('Project number not configured'),
            {
              event: 'spec.deleted',
              specId: event.specId,
              action: 'update_project_status',
            }
          );
          return;
        }

        // Project ステータスを "Done" に更新
        await projects.updateProjectStatus({
          owner: githubConfig.owner,
          projectNumber,
          itemId: projectSync.github_id,
          status: 'Done',
        });

        // ステータス更新を検証＋リトライ
        try {
          const verification = await projects.verifyProjectStatusUpdate({
            owner: githubConfig.owner,
            projectNumber,
            itemId: projectSync.github_id,
            expectedStatus: 'Done',
            maxRetries: 3,
          });

          if (verification.success) {
            console.log(
              `✓ GitHub Project status updated to "Done" (verified after ${verification.attempts} attempts)`
            );
          } else {
            console.warn(
              `⚠ GitHub Project status update could not be verified (tried ${verification.attempts} times)`
            );
          }
        } catch (verifyError) {
          // 検証失敗は警告のみで処理続行
          console.warn(`⚠ GitHub Project status verification failed: ${verifyError}`);
        }
      } catch (projectError) {
        // Project ステータス更新失敗は警告のみで処理続行
        await logError(
          'warn',
          'Failed to update GitHub Project status on spec deletion',
          projectError,
          {
            event: 'spec.deleted',
            specId: event.specId,
            action: 'update_project_status',
          }
        );
      }
    } catch (error) {
      await logError('error', 'Failed to handle spec.deleted event', error, {
        event: 'spec.deleted',
        specId: event.specId,
      });
    }
  });

  // task.completed → Sub Issue ステータス更新 + 親 Issue 連携 + Projects ステータス更新
  eventBus.on<{ taskId: string }>(
    'task.completed',
    async (event: WorkflowEvent<{ taskId: string }>) => {
      // タスク ID を早期に取得してログ出力用に使用
      const taskIdForLog = event.data?.taskId || (event as { taskId?: string }).taskId;
      console.log(`[task.completed] ハンドラー開始: taskId=${taskIdForLog}`);

      try {
        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
          console.log('[task.completed] GitHub トークン未設定のためスキップ');
          return;
        }

        const ccCraftKitDir = join(process.cwd(), '.cc-craft-kit');
        const githubConfig = getGitHubConfig(ccCraftKitDir);

        if (!githubConfig) {
          console.log('[task.completed] GitHub 設定未設定のためスキップ');
          return;
        }

        // タスク ID を Zod スキーマで検証
        const eventDataToValidate = {
          taskId: taskIdForLog,
        };
        const parseResult = TaskCompletedEventDataSchema.safeParse(eventDataToValidate);
        if (!parseResult.success) {
          await logError(
            'warn',
            `task.completed event validation failed: ${parseResult.error.errors.map((e) => e.message).join(', ')}`,
            new Error(parseResult.error.message),
            {
              event: 'task.completed',
              specId: event.specId,
              action: 'update_sub_issue_status',
              receivedData: JSON.stringify(eventDataToValidate),
            }
          );
          return;
        }
        const { taskId } = parseResult.data;

        // Sub Issue Manager で一連の処理を実行:
        // 1. Sub Issue をクローズ
        // 2. 親 Issue のチェックボックスを更新
        // 3. 全 Sub Issue がクローズされていたら親 Issue もクローズ
        console.log(
          `[task.completed] SubIssueManager.handleTaskCompletion 呼び出し: taskId=${taskId}`
        );
        const subIssueManager = new SubIssueManager(db);
        await subIssueManager.handleTaskCompletion(taskId, githubToken);

        console.log(`[task.completed] ハンドラー完了: taskId=${taskId}`);

        // GitHub Projects ステータス更新を試みる（Done）
        await updateSubIssueProjectStatus(db, taskId, githubConfig, githubToken, 'Done');
      } catch (error) {
        // Sub Issue が存在しない場合は警告のみ
        if (error instanceof Error && error.message.includes('Sub issue not found')) {
          console.log(`No Sub Issue found for task, skipping status update`);
        } else if (error instanceof Error && error.message.includes('No Sub Issue found')) {
          console.log(`No Sub Issue found for task, skipping parent issue update`);
        } else {
          await logError('warn', 'Failed to update Sub Issue status', error, {
            event: 'task.completed',
            specId: event.specId,
            action: 'update_sub_issue_status',
          });
        }
      }
    }
  );

  // task.started → Projects ステータスを In Progress に更新
  eventBus.on<{ taskId: string }>(
    'task.started',
    async (event: WorkflowEvent<{ taskId: string }>) => {
      const taskIdForLog = event.data?.taskId || (event as { taskId?: string }).taskId;
      console.log(`[task.started] ハンドラー開始: taskId=${taskIdForLog}`);

      try {
        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
          console.log('[task.started] GitHub トークン未設定のためスキップ');
          return;
        }

        const ccCraftKitDir = join(process.cwd(), '.cc-craft-kit');
        const githubConfig = getGitHubConfig(ccCraftKitDir);

        if (!githubConfig) {
          console.log('[task.started] GitHub 設定未設定のためスキップ');
          return;
        }

        // タスク ID を Zod スキーマで検証
        const eventDataToValidate = {
          taskId: taskIdForLog,
        };
        const parseResult = TaskCompletedEventDataSchema.safeParse(eventDataToValidate);
        if (!parseResult.success) {
          await logError(
            'warn',
            `task.started event validation failed: ${parseResult.error.errors.map((e) => e.message).join(', ')}`,
            new Error(parseResult.error.message),
            {
              event: 'task.started',
              specId: event.specId,
              action: 'update_sub_issue_status',
              receivedData: JSON.stringify(eventDataToValidate),
            }
          );
          return;
        }
        const { taskId } = parseResult.data;

        // GitHub Projects ステータスを In Progress に更新
        console.log(`[task.started] Projects ステータスを In Progress に更新: taskId=${taskId}`);
        await updateSubIssueProjectStatus(db, taskId, githubConfig, githubToken, 'In Progress');

        console.log(`[task.started] ハンドラー完了: taskId=${taskId}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Sub issue not found')) {
          console.log(`No Sub Issue found for task, skipping status update`);
        } else if (error instanceof Error && error.message.includes('No Sub Issue found')) {
          console.log(`No Sub Issue found for task, skipping Projects status update`);
        } else {
          await logError('warn', 'Failed to update Sub Issue Projects status', error, {
            event: 'task.started',
            specId: event.specId,
            action: 'update_sub_issue_status',
          });
        }
      }
    }
  );
}

/**
 * Sub Issue の GitHub Projects ステータスを更新
 *
 * Sub Issue が Project に追加されている場合、指定されたステータスに更新します。
 * Project に追加されていない場合は、追加してからステータスを更新します。
 *
 * @param status 'In Progress' または 'Done'
 */
async function updateSubIssueProjectStatus(
  db: Kysely<Database>,
  taskId: string,
  githubConfig: { owner: string; repo: string },
  githubToken: string,
  status: 'In Progress' | 'Done' = 'Done'
): Promise<void> {
  try {
    // 1. config.json から project_number を取得
    const ccCraftKitDir = join(process.cwd(), '.cc-craft-kit');
    const configPath = join(ccCraftKitDir, 'config.json');

    if (!existsSync(configPath)) {
      console.log('No config.json found, skipping Projects status update');
      return;
    }

    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const projectNumber = config.github?.project_name_cache?.resolved_number;

    if (!projectNumber) {
      console.log('No project_number in config, skipping Projects status update');
      return;
    }

    // 2. github_sync から Sub Issue の node_id を取得
    const syncRecord = await db
      .selectFrom('github_sync')
      .selectAll()
      .where('entity_id', '=', taskId)
      .where('entity_type', '=', 'sub_issue')
      .executeTakeFirst();

    if (!syncRecord || !syncRecord.github_node_id) {
      console.log('No Sub Issue node_id found, skipping Projects status update');
      return;
    }

    // 3. GitHub Client 作成
    const client = new GitHubClient({ token: githubToken });
    const projects = new GitHubProjects(client);

    // 4. Project ID を取得
    const project = await projects.get(githubConfig.owner, projectNumber);

    // 5. Sub Issue を Project に追加（既に追加されている場合は既存の item を返す）
    let projectItemId: string;
    try {
      const addResult = await projects.addItem({
        projectId: project.id,
        contentId: syncRecord.github_node_id,
      });
      projectItemId = addResult.id;
    } catch (addError) {
      // 既に追加されている場合のエラーは無視してステータス更新を試みる
      if (addError instanceof Error && addError.message.includes('already exists')) {
        // 既存のアイテム ID を取得する必要があるが、現在の API では取得が難しい
        // そのため、ステータス更新はスキップ
        console.log('Sub Issue already in Project, but cannot get item ID for status update');
        return;
      }
      throw addError;
    }

    // 6. ステータスを更新
    await projects.updateProjectStatus({
      owner: githubConfig.owner,
      projectNumber,
      itemId: projectItemId,
      status,
    });

    console.log(`✓ Updated Sub Issue Projects status to ${status}`);
  } catch (error) {
    // Projects 更新エラーは警告のみ（Sub Issue クローズは成功しているため）
    if (process.env.DEBUG === '1') {
      console.warn('Failed to update Sub Issue Projects status:', error);
    }
  }
}
