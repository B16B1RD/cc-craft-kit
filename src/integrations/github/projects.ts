import { GitHubClient } from './client.js';

/**
 * Project V2 フィールド型
 */
export type ProjectFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'ITERATION';

/**
 * Project V2 作成パラメータ
 */
export interface CreateProjectParams {
  ownerId: string; // Organization or User GraphQL Node ID
  title: string;
  body?: string;
}

/**
 * Project V2 アイテム追加パラメータ
 */
export interface AddProjectItemParams {
  projectId: string; // Project GraphQL Node ID
  contentId: string; // Issue/PR GraphQL Node ID
}

/**
 * Project V2 フィールド更新パラメータ
 */
export interface UpdateProjectItemFieldParams {
  projectId: string;
  itemId: string;
  fieldId: string;
  value: string | number;
}

/**
 * Project V2 レスポンス
 */
export interface ProjectResponse {
  id: string;
  number: number;
  title: string;
  url: string;
  shortDescription: string | null;
  public: boolean;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Project V2 アイテムレスポンス
 */
export interface ProjectItemResponse {
  id: string;
  content: {
    id: string;
    number: number;
    title: string;
  };
  fieldValues: Array<{
    field: {
      id: string;
      name: string;
    };
    value: unknown;
  }>;
}

/**
 * GitHub Projects V2 管理クラス
 */
export class GitHubProjects {
  constructor(private client: GitHubClient) {}

  /**
   * Project V2 作成
   */
  async create(params: CreateProjectParams): Promise<ProjectResponse> {
    const mutation = `
      mutation($ownerId: ID!, $title: String!, $body: String) {
        createProjectV2(input: {
          ownerId: $ownerId
          title: $title
          body: $body
        }) {
          projectV2 {
            id
            number
            title
            url
            shortDescription
            public
            closed
            createdAt
            updatedAt
          }
        }
      }
    `;

    const result = await this.client.query<{
      createProjectV2: { projectV2: ProjectResponse };
    }>(mutation, { ...params } as Record<string, unknown>);

    return result.createProjectV2.projectV2;
  }

  /**
   * Project V2 取得
   */
  async get(owner: string, projectNumber: number): Promise<ProjectResponse> {
    // まず owner が user か organization かを判別
    const ownerType = await this.getOwnerType(owner);

    const query = `
      query($owner: String!, $number: Int!) {
        ${ownerType}(login: $owner) {
          projectV2(number: $number) {
            id
            number
            title
            url
            shortDescription
            public
            closed
            createdAt
            updatedAt
          }
        }
      }
    `;

    const result = await this.client.query<{
      user?: { projectV2: ProjectResponse };
      organization?: { projectV2: ProjectResponse };
    }>(query, { owner, number: projectNumber });

    const project = result.user?.projectV2 || result.organization?.projectV2;
    if (!project) {
      throw new Error(`Project #${projectNumber} not found for ${owner}`);
    }
    return project;
  }

  /**
   * Project V2 にアイテム追加
   */
  async addItem(params: AddProjectItemParams): Promise<ProjectItemResponse> {
    const mutation = `
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {
          projectId: $projectId
          contentId: $contentId
        }) {
          item {
            id
            content {
              ... on Issue {
                id
                number
                title
              }
            }
          }
        }
      }
    `;

    const result = await this.client.query<{
      addProjectV2ItemById: { item: ProjectItemResponse };
    }>(mutation, { ...params } as Record<string, unknown>);

    return result.addProjectV2ItemById.item;
  }

  /**
   * Project V2 アイテムフィールド更新
   */
  async updateItemField(params: UpdateProjectItemFieldParams): Promise<{ id: string }> {
    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: $value
        }) {
          projectV2Item {
            id
          }
        }
      }
    `;

    const result = await this.client.query<{
      updateProjectV2ItemFieldValue: { projectV2Item: { id: string } };
    }>(mutation, {
      projectId: params.projectId,
      itemId: params.itemId,
      fieldId: params.fieldId,
      value: { text: params.value.toString() },
    });

    return result.updateProjectV2ItemFieldValue.projectV2Item;
  }

  /**
   * プロジェクト名でプロジェクトを検索
   */
  async searchByName(owner: string, projectName: string): Promise<ProjectResponse | null> {
    const ownerType = await this.getOwnerType(owner);

    const query = `
      query($owner: String!) {
        ${ownerType}(login: $owner) {
          projectsV2(first: 100) {
            nodes {
              id
              number
              title
              url
              shortDescription
              public
              closed
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    const result = await this.client.query<{
      user?: { projectsV2: { nodes: ProjectResponse[] } };
      organization?: { projectsV2: { nodes: ProjectResponse[] } };
    }>(query, { owner });

    const projects = result.user?.projectsV2.nodes || result.organization?.projectsV2.nodes || [];

    // プロジェクト名で完全一致検索
    const project = projects.find((p) => p.title === projectName);
    return project || null;
  }

  /**
   * Owner の種類を判別（user or organization）
   */
  private async getOwnerType(owner: string): Promise<'user' | 'organization'> {
    const query = `
      query($owner: String!) {
        user(login: $owner) {
          id
        }
      }
    `;

    try {
      const result = await this.client.query<{
        user: { id: string } | null;
      }>(query, { owner });

      return result.user ? 'user' : 'organization';
    } catch {
      // user として解決できない場合は organization
      return 'organization';
    }
  }

  /**
   * Organization/User の Node ID 取得
   */
  async getOwnerId(owner: string): Promise<string> {
    const query = `
      query($owner: String!) {
        user(login: $owner) {
          id
        }
        organization(login: $owner) {
          id
        }
      }
    `;

    const result = await this.client.query<{
      user: { id: string } | null;
      organization: { id: string } | null;
    }>(query, { owner });

    const ownerId = result.user?.id || result.organization?.id;
    if (!ownerId) {
      throw new Error(`Owner ${owner} not found (neither user nor organization)`);
    }
    return ownerId;
  }

  /**
   * Issue の Node ID 取得
   */
  async getIssueNodeId(owner: string, repo: string, issueNumber: number): Promise<string> {
    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
          }
        }
      }
    `;

    const result = await this.client.query<{
      repository: { issue: { id: string } };
    }>(query, { owner, repo, number: issueNumber });

    return result.repository.issue.id;
  }
}
