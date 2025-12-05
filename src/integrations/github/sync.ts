import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GitHubIssues, CreateIssueParams, UpdateIssueParams } from './issues.js';
import { GitHubProjects } from './projects.js';
import {
  getSpecWithGitHubInfo,
  updateSpec,
  loadGitHubSync,
  addGitHubSync,
  updateGitHubSync,
  getGitHubSyncByEntity,
} from '../../core/storage/index.js';
import { CheckboxSyncService, formatCheckboxChangeSummary } from './checkbox-sync.js';

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
    private issues: GitHubIssues,
    private projects: GitHubProjects
  ) {}

  /**
   * 仕様書をGitHub Issueに同期
   */
  async syncSpecToIssue(params: SyncSpecToIssueParams): Promise<number> {
    // 仕様書取得（JSON ストレージから）
    const spec = getSpecWithGitHubInfo(params.specId);

    if (!spec) {
      throw new Error(`Spec not found: ${params.specId}`);
    }

    // 重複チェック: github-sync.json で既存 Issue を確認
    const existingSync = getGitHubSyncByEntity(params.specId, 'spec');

    if (existingSync && params.createIfNotExists) {
      // 重複 Issue が存在する場合はエラー
      const issueUrl = `https://github.com/${params.owner}/${params.repo}/issues/${existingSync.github_number}`;
      throw new Error(`この仕様書には既に GitHub Issue が作成されています: ${issueUrl}`);
    }

    // 既存のIssue確認
    if (spec.github_issue_number) {
      // Issue更新（常に仕様書ファイルの内容で本文を上書き）
      // Source of Truth は仕様書ファイルであり、Issue は可視化ビューとして機能する
      const updateParams: UpdateIssueParams = {
        owner: params.owner,
        repo: params.repo,
        issueNumber: spec.github_issue_number,
        title: `[${spec.phase}] ${spec.name}`,
        body: await this.buildIssueBody(spec),
        labels: [this.getPhaseLabel(spec.phase)],
      };

      await this.issues.update(updateParams);

      // 同期をコメントで記録
      const comment = `## 🔄 仕様書から同期

仕様書の内容をGitHub Issueに同期しました。

**同期日時:** ${new Date().toLocaleString('ja-JP')}
**フェーズ:** ${spec.phase}
**最新の仕様書:** [\`.cc-craft-kit/specs/${spec.id}.md\`](../../.cc-craft-kit/specs/${spec.id}.md)
`;

      try {
        console.log('Adding comment to issue...');
        const commentResult = await this.issues.addComment(
          params.owner,
          params.repo,
          spec.github_issue_number,
          comment
        );
        console.log(`✓ Comment added: ${commentResult.id}`);
      } catch (error) {
        console.error('Warning: Failed to add comment:', error);
      }

      return spec.github_issue_number;
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

      // 同期ログ記録（github-sync.json に追加）
      this.recordSyncLog({
        spec_id: params.specId,
        github_issue_id: issue.number,
        github_node_id: issue.node_id,
        sync_direction: 'to_github',
        status: 'success',
        details: { created: true, issue_url: issue.html_url },
      });

      // specs.json の updated_at のみ更新
      updateSpec(params.specId, { updated_at: new Date().toISOString() });

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

    // 紐づく仕様書検索（github-sync.json から）
    const allSyncData = loadGitHubSync();
    const syncRecord = allSyncData.find(
      (s) => s.entity_type === 'spec' && s.github_number === params.issueNumber
    );

    if (!syncRecord) {
      throw new Error(`No spec linked to issue #${params.issueNumber}`);
    }

    const spec = getSpecWithGitHubInfo(syncRecord.entity_id);

    if (!spec) {
      throw new Error(`Spec not found: ${syncRecord.entity_id}`);
    }

    // Issueの状態からフェーズ判定
    const newPhase = issue.state === 'closed' ? 'completed' : spec.phase;

    // 仕様書更新（JSON ストレージ）
    updateSpec(spec.id, {
      name: this.extractSpecName(issue.title),
      phase: newPhase,
      updated_at: new Date().toISOString(),
    });

    // チェックボックス同期（Issue → 仕様書）
    if (issue.body) {
      const specPath = join(process.cwd(), '.cc-craft-kit', 'specs', `${spec.id}.md`);

      if (existsSync(specPath)) {
        try {
          const checkboxSync = new CheckboxSyncService();
          const result = await checkboxSync.syncToSpec(spec.id, specPath, issue.body);

          if (result.success && result.changes.length > 0) {
            const summary = formatCheckboxChangeSummary(result.changes);
            console.log(`✓ Checkbox sync (Issue → Spec): ${summary}`);
          }
        } catch (error) {
          console.error('Warning: Failed to sync checkboxes from Issue:', error);
        }
      }
    }

    // 同期ログ記録
    this.recordSyncLog({
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
    // 仕様書取得（JSON ストレージから）
    const spec = getSpecWithGitHubInfo(params.specId);

    if (!spec) {
      throw new Error(`Spec not found: ${params.specId}`);
    }

    if (!spec.github_issue_number) {
      throw new Error('Spec has no linked GitHub Issue');
    }

    // Project取得
    const project = await this.projects.get(params.owner, params.projectNumber);

    // Issue Node ID取得
    const repoName = await this.extractRepoName(params.owner);
    const issueNodeId = await this.projects.getIssueNodeId(
      params.owner,
      repoName,
      spec.github_issue_number
    );

    // Projectにアイテム追加
    const item = await this.projects.addItem({
      projectId: project.id,
      contentId: issueNodeId,
    });

    // Project 情報を github-sync.json に保存
    addGitHubSync({
      entity_type: 'project',
      entity_id: params.specId,
      github_id: item.id,
      github_number: null,
      github_node_id: project.id,
      issue_number: null,
      issue_url: null,
      pr_number: null,
      pr_url: null,
      pr_merged_at: null,
      sync_status: 'success',
      error_message: null,
      checkbox_hash: null,
      last_body_hash: null,
      parent_issue_number: null,
      parent_spec_id: null,
    });

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

    const specFilePath = path.join(process.cwd(), '.cc-craft-kit', 'specs', `${spec.id}.md`);

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
*このIssueはcc-craft-kitにより自動管理されています*
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
    return labelMap[phase] || 'cc-craft-kit';
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
    return 'cc-craft-kit';
  }

  /**
   * 同期ログ記録
   */
  private recordSyncLog(params: {
    spec_id: string;
    github_issue_id: number;
    github_node_id?: string;
    sync_direction: 'to_github' | 'from_github';
    status: 'success' | 'error';
    details: Record<string, unknown>;
  }): void {
    // 既存のレコードを検索（entity_type と entity_id で検索）
    const existing = getGitHubSyncByEntity(params.spec_id, 'spec');

    const syncData = {
      entity_type: 'spec' as const,
      entity_id: params.spec_id,
      github_id: params.github_issue_id.toString(),
      github_number: params.github_issue_id,
      github_node_id: params.github_node_id || null,
      issue_number: params.github_issue_id,
      issue_url: null,
      pr_number: null,
      pr_url: null,
      pr_merged_at: null,
      sync_status: (params.status === 'success' ? 'success' : 'failed') as 'success' | 'failed',
      error_message: params.status === 'error' ? JSON.stringify(params.details) : null,
      checkbox_hash: null,
      last_body_hash: null,
      parent_issue_number: null,
      parent_spec_id: null,
    };

    if (existing) {
      // 既存レコードを更新
      updateGitHubSync(existing.id, {
        github_id: syncData.github_id,
        github_number: syncData.github_number,
        github_node_id: syncData.github_node_id,
        sync_status: syncData.sync_status,
        error_message: syncData.error_message,
        last_synced_at: new Date().toISOString(),
      });
    } else {
      // 新規レコードを挿入
      addGitHubSync(syncData);
    }
  }
}
