import { GitHubClient } from './client.js';
import { ProjectStatus, isProjectStatus } from './phase-status-mapper.js';

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
  value?: string | number; // TEXT, NUMBER フィールド用
  fieldType?: ProjectFieldType; // フィールドタイプ
  optionId?: string; // SINGLE_SELECT フィールド用
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
 * Project V2 フィールドオプション
 */
export interface ProjectFieldOption {
  id: string;
  name: string;
}

/**
 * Project V2 フィールドレスポンス
 */
export interface ProjectFieldResponse {
  id: string;
  name: string;
  options: ProjectFieldOption[];
}

/**
 * ステータス検証パラメータ
 */
export interface VerifyProjectStatusParams {
  owner: string;
  projectNumber: number;
  itemId: string;
  expectedStatus: ProjectStatus;
  maxRetries?: number;
}

/**
 * ステータス検証結果
 */
export interface VerifyProjectStatusResult {
  success: boolean;
  actualStatus: ProjectStatus | null;
  attempts: number;
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

    // フィールドタイプに応じて value を構築
    let value: Record<string, unknown>;
    if (params.fieldType === 'SINGLE_SELECT') {
      if (!params.optionId) {
        throw new Error('optionId is required for SINGLE_SELECT field type');
      }
      value = { singleSelectOptionId: params.optionId };
    } else {
      // TEXT, NUMBER などのデフォルト
      if (params.value === undefined) {
        throw new Error('value is required for non-SINGLE_SELECT field types');
      }
      value = { text: params.value.toString() };
    }

    const result = await this.client.query<{
      updateProjectV2ItemFieldValue: { projectV2Item: { id: string } };
    }>(mutation, {
      projectId: params.projectId,
      itemId: params.itemId,
      fieldId: params.fieldId,
      value,
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

  /**
   * Project のステータスフィールドを更新
   */
  async updateProjectStatus(params: {
    owner: string;
    projectNumber: number;
    itemId: string;
    status: 'Todo' | 'In Progress' | 'Done';
  }): Promise<void> {
    // 1. Project のフィールド一覧を取得
    const fields = await this.getProjectFields(params.owner, params.projectNumber);

    // 2. "Status" フィールドを検索
    const statusField = fields.find((f) => f.name === 'Status');
    if (!statusField) {
      throw new Error('Status field not found in project');
    }

    // 3. ステータスオプション ID を検索
    const option = statusField.options.find((o) => o.name === params.status);
    if (!option) {
      throw new Error(`Status option "${params.status}" not found`);
    }

    // 4. Project 情報を取得
    const project = await this.get(params.owner, params.projectNumber);

    // 5. フィールド更新
    await this.updateItemField({
      projectId: project.id,
      itemId: params.itemId,
      fieldId: statusField.id,
      fieldType: 'SINGLE_SELECT',
      optionId: option.id,
    });
  }

  /**
   * Project のフィールド一覧とオプションを取得
   */
  async getProjectFields(owner: string, projectNumber: number): Promise<ProjectFieldResponse[]> {
    const ownerType = await this.getOwnerType(owner);

    const query = `
      query($owner: String!, $number: Int!) {
        ${ownerType}(login: $owner) {
          projectV2(number: $number) {
            fields(first: 20) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.client.query<{
      user?: {
        projectV2: {
          fields: {
            nodes: Array<{
              id: string;
              name: string;
              options: Array<{ id: string; name: string }>;
            }>;
          };
        };
      };
      organization?: {
        projectV2: {
          fields: {
            nodes: Array<{
              id: string;
              name: string;
              options: Array<{ id: string; name: string }>;
            }>;
          };
        };
      };
    }>(query, { owner, number: projectNumber });

    const fields =
      result.user?.projectV2.fields.nodes || result.organization?.projectV2.fields.nodes || [];

    return fields;
  }

  /**
   * プロジェクトアイテムの現在のステータスを取得
   */
  async getProjectItemStatus(itemId: string): Promise<ProjectStatus | null> {
    try {
      const query = `
        query getProjectItemStatus($itemId: ID!) {
          node(id: $itemId) {
            ... on ProjectV2Item {
              id
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field {
                      ... on ProjectV2SingleSelectField {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result = await this.client.query<{
        node: {
          id: string;
          fieldValues: {
            nodes: Array<{
              name: string;
              field: { name: string };
            }>;
          };
        };
      }>(query, { itemId });

      // "Status" フィールドを検索
      const statusField = result.node.fieldValues.nodes.find((fv) => fv?.field?.name === 'Status');

      if (!statusField) {
        return null;
      }

      // ステータス名を ProjectStatus 型にマッピング
      const statusName = statusField.name;
      if (isProjectStatus(statusName)) {
        return statusName;
      }

      // 想定外のステータス名をログに記録
      console.warn(
        `Unknown project status: "${statusName}". Expected: Todo, In Progress, or Done.`
      );
      return null;
    } catch (error) {
      console.warn('Failed to get project item status:', error);
      return null;
    }
  }

  /**
   * 指定されたミリ秒待機する
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      // eslint-disable-next-line no-undef
      setTimeout(() => resolve(), ms);
    });
  }

  /**
   * ステータス更新後に検証し、必要に応じてリトライする
   */
  async verifyProjectStatusUpdate(
    params: VerifyProjectStatusParams
  ): Promise<VerifyProjectStatusResult> {
    const maxRetries = params.maxRetries ?? 3;
    let attempts = 0;

    for (let i = 0; i <= maxRetries; i++) {
      attempts++;

      // 指数バックオフで待機（初回は1秒、2回目は2秒、3回目は4秒）
      const waitTime = i === 0 ? 1000 : 1000 * Math.pow(2, i - 1);
      await this.sleep(waitTime);

      try {
        const actualStatus = await this.getProjectItemStatus(params.itemId);

        if (actualStatus === params.expectedStatus) {
          return { success: true, actualStatus, attempts };
        }

        // 最後のリトライでない場合は再度ステータス更新
        if (i < maxRetries) {
          await this.updateProjectStatus({
            owner: params.owner,
            projectNumber: params.projectNumber,
            itemId: params.itemId,
            status: params.expectedStatus,
          });
        }
      } catch (error) {
        // レート制限エラーの場合は即座に失敗
        if (error instanceof Error && error.message.includes('rate limit')) {
          throw error;
        }

        // その他のエラーはリトライを継続
        console.warn(`Retry attempt ${attempts} failed:`, error);
      }
    }

    // 最終的に失敗
    const finalStatus = await this.getProjectItemStatus(params.itemId);
    return { success: false, actualStatus: finalStatus, attempts };
  }
}
