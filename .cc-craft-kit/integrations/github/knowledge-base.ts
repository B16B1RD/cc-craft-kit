import { GitHubIssues } from './issues.js';
import { getSpecWithGitHubInfo, appendLog } from '../../core/storage/index.js';

/**
 * ナレッジエントリ種別
 */
export type KnowledgeEntryType = 'progress' | 'error_solution' | 'tip' | 'decision';

/**
 * ナレッジエントリ
 */
export interface KnowledgeEntry {
  type: KnowledgeEntryType;
  title: string;
  content: string;
  tags?: string[];
  timestamp: string;
}

/**
 * 進捗記録パラメータ
 */
export interface RecordProgressParams {
  specId: string;
  owner: string;
  repo: string;
  summary: string;
  details: string;
  completedTasks?: string[];
  nextSteps?: string[];
}

/**
 * エラー解決記録パラメータ
 */
export interface RecordErrorSolutionParams {
  specId: string;
  owner: string;
  repo: string;
  errorDescription: string;
  solution: string;
  rootCause?: string;
  relatedIssues?: number[];
}

/**
 * Tips記録パラメータ
 */
export interface RecordTipParams {
  specId: string;
  owner: string;
  repo: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

/**
 * GitHub Issue ナレッジベースサービス
 */
export class GitHubKnowledgeBase {
  constructor(private issues: GitHubIssues) {}

  /**
   * 進捗をIssueコメントに記録
   */
  async recordProgress(params: RecordProgressParams): Promise<number> {
    const spec = getSpecWithGitHubInfo(params.specId);

    if (!spec) {
      throw new Error(`Spec not found: ${params.specId}`);
    }

    if (!spec.github_issue_number) {
      throw new Error('Spec has no linked GitHub Issue');
    }

    const body = this.buildProgressComment({
      summary: params.summary,
      details: params.details,
      completedTasks: params.completedTasks,
      nextSteps: params.nextSteps,
    });

    const comment = await this.issues.addComment(
      params.owner,
      params.repo,
      spec.github_issue_number,
      body
    );

    // ログに記録（JSON ストレージ）
    appendLog({
      task_id: null,
      spec_id: params.specId,
      action: 'record_progress',
      level: 'info',
      message: `Progress recorded: ${params.summary}`,
      metadata: {
        type: 'progress',
        commentId: comment.id,
        issueNumber: spec.github_issue_number,
      },
    });

    return comment.id;
  }

  /**
   * エラー解決をIssueコメントに記録
   */
  async recordErrorSolution(params: RecordErrorSolutionParams): Promise<number> {
    const spec = getSpecWithGitHubInfo(params.specId);

    if (!spec) {
      throw new Error(`Spec not found: ${params.specId}`);
    }

    if (!spec.github_issue_number) {
      throw new Error('Spec has no linked GitHub Issue');
    }

    const body = this.buildErrorSolutionComment({
      errorDescription: params.errorDescription,
      solution: params.solution,
      rootCause: params.rootCause,
      relatedIssues: params.relatedIssues,
    });

    const comment = await this.issues.addComment(
      params.owner,
      params.repo,
      spec.github_issue_number,
      body
    );

    // ログに記録（JSON ストレージ）
    appendLog({
      task_id: null,
      spec_id: params.specId,
      action: 'record_error_solution',
      level: 'warn',
      message: `Error solution recorded: ${params.errorDescription.substring(0, 50)}...`,
      metadata: {
        type: 'error_solution',
        commentId: comment.id,
        issueNumber: spec.github_issue_number,
      },
    });

    return comment.id;
  }

  /**
   * TipsをIssueコメントに記録
   */
  async recordTip(params: RecordTipParams): Promise<number> {
    const spec = getSpecWithGitHubInfo(params.specId);

    if (!spec) {
      throw new Error(`Spec not found: ${params.specId}`);
    }

    if (!spec.github_issue_number) {
      throw new Error('Spec has no linked GitHub Issue');
    }

    const body = this.buildTipComment({
      title: params.title,
      content: params.content,
      category: params.category,
      tags: params.tags,
    });

    const comment = await this.issues.addComment(
      params.owner,
      params.repo,
      spec.github_issue_number,
      body
    );

    // ログに記録（JSON ストレージ）
    appendLog({
      task_id: null,
      spec_id: params.specId,
      action: 'record_tip',
      level: 'info',
      message: `Tip recorded: ${params.title}`,
      metadata: {
        type: 'tip',
        commentId: comment.id,
        issueNumber: spec.github_issue_number,
        category: params.category,
      },
    });

    return comment.id;
  }

  /**
   * 進捗コメント生成
   */
  private buildProgressComment(params: {
    summary: string;
    details: string;
    completedTasks?: string[];
    nextSteps?: string[];
  }): string {
    let comment = `## 📊 進捗報告\n\n`;
    comment += `**要約**: ${params.summary}\n\n`;
    comment += `### 詳細\n\n${params.details}\n\n`;

    if (params.completedTasks && params.completedTasks.length > 0) {
      comment += `### ✅ 完了したタスク\n\n`;
      params.completedTasks.forEach((task) => {
        comment += `- ${task}\n`;
      });
      comment += `\n`;
    }

    if (params.nextSteps && params.nextSteps.length > 0) {
      comment += `### 🎯 次のステップ\n\n`;
      params.nextSteps.forEach((step) => {
        comment += `- ${step}\n`;
      });
      comment += `\n`;
    }

    comment += `---\n`;
    comment += `*🤖 cc-craft-kit Knowledge Base - ${new Date().toISOString()}*`;

    return comment;
  }

  /**
   * エラー解決コメント生成
   */
  private buildErrorSolutionComment(params: {
    errorDescription: string;
    solution: string;
    rootCause?: string;
    relatedIssues?: number[];
  }): string {
    let comment = `## 🐛 エラー解決記録\n\n`;
    comment += `### エラー内容\n\n${params.errorDescription}\n\n`;

    if (params.rootCause) {
      comment += `### 根本原因\n\n${params.rootCause}\n\n`;
    }

    comment += `### 解決方法\n\n${params.solution}\n\n`;

    if (params.relatedIssues && params.relatedIssues.length > 0) {
      comment += `### 関連Issue\n\n`;
      params.relatedIssues.forEach((issueNum) => {
        comment += `- #${issueNum}\n`;
      });
      comment += `\n`;
    }

    comment += `---\n`;
    comment += `*🤖 cc-craft-kit Knowledge Base - ${new Date().toISOString()}*`;

    return comment;
  }

  /**
   * Tipsコメント生成
   */
  private buildTipComment(params: {
    title: string;
    content: string;
    category?: string;
    tags?: string[];
  }): string {
    let comment = `## 💡 Tips\n\n`;
    comment += `### ${params.title}\n\n`;

    if (params.category) {
      comment += `**カテゴリ**: ${params.category}\n\n`;
    }

    comment += `${params.content}\n\n`;

    if (params.tags && params.tags.length > 0) {
      comment += `**タグ**: ${params.tags.map((t) => `\`${t}\``).join(', ')}\n\n`;
    }

    comment += `---\n`;
    comment += `*🤖 cc-craft-kit Knowledge Base - ${new Date().toISOString()}*`;

    return comment;
  }
}
