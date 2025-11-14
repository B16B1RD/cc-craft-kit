import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getDatabase } from '../../core/database/connection.js';
import { getGitHubClient } from '../../integrations/github/client.js';
import { GitHubIssues } from '../../integrations/github/issues.js';
import { GitHubKnowledgeBase } from '../../integrations/github/knowledge-base.js';

/**
 * 進捗記録ツール
 */
export const recordProgressTool: Tool & { handler: (params: any) => Promise<any> } = {
  name: 'takumi:record_progress',
  description: '仕様書の進捗をGitHub Issueに記録します。コンテキスト圧迫を減らすためのナレッジベース機能です。',
  inputSchema: {
    type: 'object',
    properties: {
      specId: { type: 'string', description: '仕様書ID' },
      owner: { type: 'string', description: 'GitHubオーナー名' },
      repo: { type: 'string', description: 'リポジトリ名' },
      summary: { type: 'string', description: '進捗の要約' },
      details: { type: 'string', description: '進捗の詳細' },
      completedTasks: { type: 'array', items: { type: 'string' }, description: '完了したタスクリスト' },
      nextSteps: { type: 'array', items: { type: 'string' }, description: '次のステップ' },
    },
    required: ['specId', 'owner', 'repo', 'summary', 'details'],
  },

  async handler(args: any) {
    try {
      const db = getDatabase();
      const client = getGitHubClient();
      const issues = new GitHubIssues(client);
      const kb = new GitHubKnowledgeBase(db, issues);

      const commentId = await kb.recordProgress({
        specId: args.specId,
        owner: args.owner,
        repo: args.repo,
        summary: args.summary,
        details: args.details,
        completedTasks: args.completedTasks,
        nextSteps: args.nextSteps,
      });

      const spec = await db
        .selectFrom('specs')
        .where('id', '=', args.specId)
        .selectAll()
        .executeTakeFirstOrThrow();

      return {
        success: true,
        commentId,
        issueUrl: `https://github.com/${args.owner}/${args.repo}/issues/${spec.github_issue_id}#issuecomment-${commentId}`,
        message: '進捗がIssueコメントに記録されました',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

/**
 * エラー解決記録ツール
 */
export const recordErrorSolutionTool: Tool & { handler: (params: any) => Promise<any> } = {
  name: 'takumi:record_error_solution',
  description: 'エラーとその解決方法をGitHub Issueに記録します。同じエラーの再発時に参照できます。',
  inputSchema: {
    type: 'object',
    properties: {
      specId: { type: 'string', description: '仕様書ID' },
      owner: { type: 'string', description: 'GitHubオーナー名' },
      repo: { type: 'string', description: 'リポジトリ名' },
      errorDescription: { type: 'string', description: 'エラーの説明' },
      solution: { type: 'string', description: '解決方法' },
      rootCause: { type: 'string', description: '根本原因' },
      relatedIssues: { type: 'array', items: { type: 'number' }, description: '関連Issue番号リスト' },
    },
    required: ['specId', 'owner', 'repo', 'errorDescription', 'solution'],
  },

  async handler(args: any) {
    try {
      const db = getDatabase();
      const client = getGitHubClient();
      const issues = new GitHubIssues(client);
      const kb = new GitHubKnowledgeBase(db, issues);

      const commentId = await kb.recordErrorSolution({
        specId: args.specId,
        owner: args.owner,
        repo: args.repo,
        errorDescription: args.errorDescription,
        solution: args.solution,
        rootCause: args.rootCause,
        relatedIssues: args.relatedIssues,
      });

      const spec = await db
        .selectFrom('specs')
        .where('id', '=', args.specId)
        .selectAll()
        .executeTakeFirstOrThrow();

      return {
        success: true,
        commentId,
        issueUrl: `https://github.com/${args.owner}/${args.repo}/issues/${spec.github_issue_id}#issuecomment-${commentId}`,
        message: 'エラー解決がIssueコメントに記録されました',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

/**
 * Tips記録ツール
 */
export const recordTipTool: Tool & { handler: (params: any) => Promise<any> } = {
  name: 'takumi:record_tip',
  description: '開発中に得たTipsやベストプラクティスをGitHub Issueに記録します。',
  inputSchema: {
    type: 'object',
    properties: {
      specId: { type: 'string', description: '仕様書ID' },
      owner: { type: 'string', description: 'GitHubオーナー名' },
      repo: { type: 'string', description: 'リポジトリ名' },
      title: { type: 'string', description: 'Tipsのタイトル' },
      content: { type: 'string', description: 'Tipsの内容' },
      category: { type: 'string', description: 'カテゴリ' },
      tags: { type: 'array', items: { type: 'string' }, description: 'タグリスト' },
    },
    required: ['specId', 'owner', 'repo', 'title', 'content'],
  },

  async handler(args: any) {
    try {
      const db = getDatabase();
      const client = getGitHubClient();
      const issues = new GitHubIssues(client);
      const kb = new GitHubKnowledgeBase(db, issues);

      const commentId = await kb.recordTip({
        specId: args.specId,
        owner: args.owner,
        repo: args.repo,
        title: args.title,
        content: args.content,
        category: args.category,
        tags: args.tags,
      });

      const spec = await db
        .selectFrom('specs')
        .where('id', '=', args.specId)
        .selectAll()
        .executeTakeFirstOrThrow();

      return {
        success: true,
        commentId,
        issueUrl: `https://github.com/${args.owner}/${args.repo}/issues/${spec.github_issue_id}#issuecomment-${commentId}`,
        message: 'TipsがIssueコメントに記録されました',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
