import { GitHubClient } from './client.js';

/**
 * Issue 作成パラメータ
 */
export interface CreateIssueParams {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

/**
 * Issue 更新パラメータ
 */
export interface UpdateIssueParams {
  owner: string;
  repo: string;
  issueNumber: number;
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  labels?: string[];
  assignees?: string[];
  milestone?: number | null;
}

/**
 * Issue レスポンス
 */
export interface IssueResponse {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  assignees: Array<{
    id: number;
    login: string;
  }>;
  milestone: {
    id: number;
    number: number;
    title: string;
  } | null;
}

/**
 * GitHub Issues 管理クラス
 */
export class GitHubIssues {
  constructor(private client: GitHubClient) {}

  /**
   * Issue 作成
   */
  async create(params: CreateIssueParams): Promise<IssueResponse> {
    const { data } = await this.client.rest.issues.create({
      owner: params.owner,
      repo: params.repo,
      title: params.title,
      body: params.body,
      labels: params.labels,
      assignees: params.assignees,
      milestone: params.milestone,
    });

    return this.mapIssueResponse(data);
  }

  /**
   * Issue 更新
   */
  async update(params: UpdateIssueParams): Promise<IssueResponse> {
    const { data } = await this.client.rest.issues.update({
      owner: params.owner,
      repo: params.repo,
      issue_number: params.issueNumber,
      title: params.title,
      body: params.body,
      state: params.state,
      labels: params.labels,
      assignees: params.assignees,
      milestone: params.milestone,
    });

    return this.mapIssueResponse(data);
  }

  /**
   * Issue 取得
   */
  async get(owner: string, repo: string, issueNumber: number): Promise<IssueResponse> {
    const { data } = await this.client.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    return this.mapIssueResponse(data);
  }

  /**
   * Issue 一覧取得
   */
  async list(
    owner: string,
    repo: string,
    options?: {
      state?: 'open' | 'closed' | 'all';
      labels?: string;
      sort?: 'created' | 'updated' | 'comments';
      direction?: 'asc' | 'desc';
      per_page?: number;
      page?: number;
    }
  ): Promise<IssueResponse[]> {
    const { data } = await this.client.rest.issues.listForRepo({
      owner,
      repo,
      state: options?.state || 'open',
      labels: options?.labels,
      sort: options?.sort || 'created',
      direction: options?.direction || 'desc',
      per_page: options?.per_page || 30,
      page: options?.page || 1,
    });

    return data.map((issue) => this.mapIssueResponse(issue));
  }

  /**
   * Issue コメント追加
   */
  async addComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<{ id: number; body: string; created_at: string }> {
    const { data } = await this.client.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });

    return {
      id: data.id,
      body: data.body || '',
      created_at: data.created_at,
    };
  }

  /**
   * Issue レスポンスマッピング
   */
  private mapIssueResponse(data: {
    id: number;
    number: number;
    title: string;
    body?: string | null;
    state: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    labels: Array<
      string | { id?: number; name?: string; color?: string | null; description?: string | null }
    >;
    assignees?: Array<{ id: number; login: string }> | null;
    milestone: { id: number; number: number; title: string } | null;
  }): IssueResponse {
    return {
      id: data.id,
      number: data.number,
      title: data.title,
      body: data.body ?? null,
      state: data.state,
      html_url: data.html_url,
      created_at: data.created_at,
      updated_at: data.updated_at,
      labels: data.labels.map((label) => {
        if (typeof label === 'string') {
          return { id: 0, name: label, color: '' };
        }
        return {
          id: label.id ?? 0,
          name: label.name ?? '',
          color: label.color ?? '',
        };
      }),
      assignees: (data.assignees ?? []).map((assignee) => ({
        id: assignee.id,
        login: assignee.login,
      })),
      milestone: data.milestone
        ? {
            id: data.milestone.id,
            number: data.milestone.number,
            title: data.milestone.title,
          }
        : null,
    };
  }
}
