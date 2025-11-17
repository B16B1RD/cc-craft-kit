import { Kysely } from 'kysely';
import { Database } from '../../core/database/schema.js';
import { GitHubIssues, CreateIssueParams, UpdateIssueParams } from './issues.js';
import { GitHubProjects } from './projects.js';

/**
 * 仕様書とIssueの同期パラメータ
 */
export interface SyncSpecToIssueParams {
  specId: string;
  owner: string;
  repo: string;
  createIfNotExists?: boolean;
}

/**
 * IssueからSpec更新パラメータ
 */
export interface SyncIssueToSpecParams {
  owner: string;
  repo: string;
  issueNumber: number;
}

/**
 * ProjectへのSpec追加パラメータ
 */
export interface AddSpecToProjectParams {
  specId: string;
  owner: string;
  projectNumber: number;
}

/**
 * GitHub同期サービス
 */
export class GitHubSyncService {
  constructor(
    private db: Kysely<Database>,
    private issues: GitHubIssues,
    private projects: GitHubProjects
  ) {}

  /**
   * 仕様書をGitHub Issueに同期
   */
  async syncSpecToIssue(params: SyncSpecToIssueParams): Promise<number> {
    // 仕様書取得
    const spec = await this.db
      .selectFrom('specs')
      .where('id', '=', params.specId)
      .selectAll()
      .executeTakeFirstOrThrow();

    // 既存のIssue確認
    if (spec.github_issue_id) {
      // 既存のIssue本文を取得して、テンプレートのままかチェック
      const existingIssue = await this.issues.get(params.owner, params.repo, spec.github_issue_id);
      const isTemplate =
        existingIssue.body?.includes('(背景を記述してください)') ||
        existingIssue.body?.includes('(必須要件1)') ||
        existingIssue.body?.includes('(機能要件1)');

      // Issue更新
      const updateParams: UpdateIssueParams = {
        owner: params.owner,
        repo: params.repo,
        issueNumber: spec.github_issue_id,
        title: `[${spec.phase}] ${spec.name}`,
        labels: [this.getPhaseLabel(spec.phase)],
        // テンプレートのままの場合は本文を更新、それ以外は履歴保持のため更新しない
        ...(isTemplate ? { body: await this.buildIssueBody(spec) } : {}),
      };

      await this.issues.update(updateParams);

      // 同期をコメントで記録
      const comment = `## 🔄 仕様書から同期

仕様書の内容をGitHub Issueに同期しました。

**同期日時:** ${new Date().toLocaleString('ja-JP')}
**フェーズ:** ${spec.phase}
**最新の仕様書:** [\`.takumi/specs/${spec.id}.md\`](../../.takumi/specs/${spec.id}.md)
`;

      try {
        console.log('Adding comment to issue...');
        const commentResult = await this.issues.addComment(
          params.owner,
          params.repo,
          spec.github_issue_id,
          comment
        );
        console.log(`✓ Comment added: ${commentResult.id}`);
      } catch (error) {
        console.error('Warning: Failed to add comment:', error);
      }

      return spec.github_issue_id;
    } else if (params.createIfNotExists) {
      // Issue作成
      const createParams: CreateIssueParams = {
        owner: params.owner,
        repo: params.repo,
        title: `[${spec.phase}] ${spec.name}`,
        body: await this.buildIssueBody(spec),
        labels: [this.getPhaseLabel(spec.phase)],
      };

      const issue = await this.issues.create(createParams);

      // 仕様書更新
      await this.db
        .updateTable('specs')
        .set({ github_issue_id: issue.number })
        .where('id', '=', params.specId)
        .execute();

      // 同期ログ記録
      await this.recordSyncLog({
        spec_id: params.specId,
        github_issue_id: issue.number,
        sync_direction: 'to_github',
        status: 'success',
        details: { created: true, issue_url: issue.html_url },
      });

      return issue.number;
    } else {
      throw new Error('Issue not linked and createIfNotExists is false');
    }
  }

  /**
   * IssueからSpec更新
   */
  async syncIssueToSpec(params: SyncIssueToSpecParams): Promise<string> {
    // Issue取得
    const issue = await this.issues.get(params.owner, params.repo, params.issueNumber);

    // 紐づく仕様書検索
    const spec = await this.db
      .selectFrom('specs')
      .where('github_issue_id', '=', params.issueNumber)
      .selectAll()
      .executeTakeFirst();

    if (!spec) {
      throw new Error(`No spec linked to issue #${params.issueNumber}`);
    }

    // Issueの状態からフェーズ判定
    const newPhase = issue.state === 'closed' ? 'completed' : spec.phase;

    // 仕様書更新
    await this.db
      .updateTable('specs')
      .set({
        name: this.extractSpecName(issue.title),
        phase: newPhase,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', spec.id)
      .execute();

    // 同期ログ記録
    await this.recordSyncLog({
      spec_id: spec.id,
      github_issue_id: issue.number,
      sync_direction: 'from_github',
      status: 'success',
      details: { updated_phase: newPhase },
    });

    return spec.id;
  }

  /**
   * 仕様書をProjectに追加
   */
  async addSpecToProject(params: AddSpecToProjectParams): Promise<string> {
    // 仕様書取得
    const spec = await this.db
      .selectFrom('specs')
      .where('id', '=', params.specId)
      .selectAll()
      .executeTakeFirstOrThrow();

    if (!spec.github_issue_id) {
      throw new Error('Spec has no linked GitHub Issue');
    }

    // Project取得
    const project = await this.projects.get(params.owner, params.projectNumber);

    // Issue Node ID取得
    const repoName = await this.extractRepoName(params.owner);
    const issueNodeId = await this.projects.getIssueNodeId(
      params.owner,
      repoName,
      spec.github_issue_id
    );

    // Projectにアイテム追加
    const item = await this.projects.addItem({
      projectId: project.id,
      contentId: issueNodeId,
    });

    // 仕様書更新（Project ID と Item ID を保存）
    await this.db
      .updateTable('specs')
      .set({
        github_project_id: project.id,
        github_project_item_id: item.id, // Item ID も保存
      })
      .where('id', '=', params.specId)
      .execute();

    return item.id;
  }

  /**
   * Issue本文生成（仕様書ファイルの内容を読み込む）
   */
  private async buildIssueBody(spec: {
    id: string;
    description?: string | null;
    phase: string;
    created_at: string | Date;
    updated_at: string | Date;
  }): Promise<string> {
    // 仕様書ファイルを読み込む
    const fs = await import('fs/promises');
    const path = await import('path');

    const specFilePath = path.join(process.cwd(), '.takumi', 'specs', `${spec.id}.md`);

    try {
      const specContent = await fs.readFile(specFilePath, 'utf-8');
      return specContent;
    } catch {
      // ファイルが存在しない場合はサマリーのみ
      console.warn(`Warning: Spec file not found at ${specFilePath}, using summary`);
      return `
## 仕様概要

${spec.description || '説明なし'}

## フェーズ

現在のフェーズ: **${spec.phase}**

## 関連情報

- Spec ID: \`${spec.id}\`
- 作成日時: ${spec.created_at}
- 更新日時: ${spec.updated_at}

---
*このIssueはTakumiにより自動管理されています*
      `.trim();
    }
  }

  /**
   * フェーズからラベル取得
   */
  private getPhaseLabel(phase: string): string {
    const labelMap: Record<string, string> = {
      requirements: 'phase:requirements',
      design: 'phase:design',
      tasks: 'phase:tasks',
      implementation: 'phase:implementation',
      completed: 'phase:completed',
    };
    return labelMap[phase] || 'takumi';
  }

  /**
   * Issueタイトルから仕様名抽出
   */
  private extractSpecName(title: string): string {
    // "[phase] Name" 形式から Name を抽出
    const match = title.match(/^\[.*?\]\s*(.+)$/);
    return match ? match[1] : title;
  }

  /**
   * リポジトリ名抽出（設定から取得）
   */
  private async extractRepoName(_owner: string): Promise<string> {
    // TODO: config.jsonから取得する実装
    return 'takumi';
  }

  /**
   * 同期ログ記録
   */
  private async recordSyncLog(params: {
    spec_id: string;
    github_issue_id: number;
    sync_direction: 'to_github' | 'from_github';
    status: 'success' | 'error';
    details: Record<string, unknown>;
  }): Promise<void> {
    const { randomUUID } = await import('crypto');
    // 仕様書とIssueの同期記録
    // entity_type は 'spec' を使用（'issue' ではない）
    await this.db
      .insertInto('github_sync')
      .values({
        id: randomUUID(),
        entity_type: 'spec',
        entity_id: params.spec_id,
        github_id: params.github_issue_id.toString(),
        github_number: params.github_issue_id,
        last_synced_at: new Date().toISOString(),
        sync_status: params.status === 'success' ? 'success' : 'failed',
        error_message: params.status === 'error' ? JSON.stringify(params.details) : null,
      })
      .execute();
  }
}
