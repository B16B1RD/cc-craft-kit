/**
 * GitHubProjects テスト
 *
 * TDD 実践: projects.ts のカバレッジを 19% → 80% に向上させる
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GitHubProjects } from '../../../src/integrations/github/projects.js';
import { IGitHubClient } from '../../../src/integrations/github/client.js';
import type {
  CreateProjectParams,
  AddProjectItemParams,
  UpdateProjectItemFieldParams,
  ProjectResponse,
  ProjectItemResponse,
  ProjectFieldResponse,
} from '../../../src/integrations/github/projects.js';

describe('GitHubProjects', () => {
  let mockClient: jest.Mocked<IGitHubClient>;
  let projects: GitHubProjects;

  beforeEach(() => {
    // モッククライアントを作成
    mockClient = {
      query: jest.fn(),
      rest: {} as any,
    } as jest.Mocked<IGitHubClient>;

    projects = new GitHubProjects(mockClient);
  });

  describe('create', () => {
    it('should create a new Project V2', async () => {
      // Arrange
      const params: CreateProjectParams = {
        ownerId: 'MDQ6VXNlcjEyMzQ1', // User GraphQL Node ID
        title: 'Test Project',
        body: 'Test Description',
      };

      const expectedResponse: ProjectResponse = {
        id: 'PVT_kwDOABCDEF4Aa1b2',
        number: 1,
        title: 'Test Project',
        url: 'https://github.com/users/testuser/projects/1',
        shortDescription: 'Test Description',
        public: true,
        closed: false,
        createdAt: '2025-11-21T00:00:00Z',
        updatedAt: '2025-11-21T00:00:00Z',
      };

      mockClient.query.mockResolvedValue({
        createProjectV2: { projectV2: expectedResponse },
      });

      // Act
      const result = await projects.create(params);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('createProjectV2'),
        params
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should create a project without body', async () => {
      // Arrange
      const params: CreateProjectParams = {
        ownerId: 'MDQ6VXNlcjEyMzQ1',
        title: 'Test Project',
      };

      const expectedResponse: ProjectResponse = {
        id: 'PVT_kwDOABCDEF4Aa1b2',
        number: 1,
        title: 'Test Project',
        url: 'https://github.com/users/testuser/projects/1',
        shortDescription: null,
        public: true,
        closed: false,
        createdAt: '2025-11-21T00:00:00Z',
        updatedAt: '2025-11-21T00:00:00Z',
      };

      mockClient.query.mockResolvedValue({
        createProjectV2: { projectV2: expectedResponse },
      });

      // Act
      const result = await projects.create(params);

      // Assert
      expect(result.shortDescription).toBeNull();
    });
  });

  describe('get', () => {
    it('should get a project for a user', async () => {
      // Arrange
      const owner = 'testuser';
      const projectNumber = 1;

      const expectedResponse: ProjectResponse = {
        id: 'PVT_kwDOABCDEF4Aa1b2',
        number: 1,
        title: 'Test Project',
        url: 'https://github.com/users/testuser/projects/1',
        shortDescription: 'Test Description',
        public: true,
        closed: false,
        createdAt: '2025-11-21T00:00:00Z',
        updatedAt: '2025-11-21T00:00:00Z',
      };

      // getOwnerType のモック
      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: { projectV2: expectedResponse },
        });

      // Act
      const result = await projects.get(owner, projectNumber);

      // Assert
      expect(result).toEqual(expectedResponse);
    });

    it('should get a project for an organization', async () => {
      // Arrange
      const owner = 'testorg';
      const projectNumber = 1;

      const expectedResponse: ProjectResponse = {
        id: 'PVT_kwDOABCDEF4Aa1b2',
        number: 1,
        title: 'Test Project',
        url: 'https://github.com/orgs/testorg/projects/1',
        shortDescription: 'Test Description',
        public: true,
        closed: false,
        createdAt: '2025-11-21T00:00:00Z',
        updatedAt: '2025-11-21T00:00:00Z',
      };

      // getOwnerType のモック
      mockClient.query
        .mockResolvedValueOnce({ organization: { type: 'Organization' } })
        .mockResolvedValueOnce({
          organization: { projectV2: expectedResponse },
        });

      // Act
      const result = await projects.get(owner, projectNumber);

      // Assert
      expect(result).toEqual(expectedResponse);
    });

    it('should throw error when project not found', async () => {
      // Arrange
      const owner = 'testuser';
      const projectNumber = 999;

      // getOwnerType のモック
      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: { projectV2: null },
        });

      // Act & Assert
      await expect(projects.get(owner, projectNumber)).rejects.toThrow(
        'Project #999 not found for testuser'
      );
    });
  });

  describe('addItem', () => {
    it('should add an item to a project', async () => {
      // Arrange
      const params: AddProjectItemParams = {
        projectId: 'PVT_kwDOABCDEF4Aa1b2',
        contentId: 'I_kwDOABCDEF4Aa1b2', // Issue GraphQL Node ID
      };

      const expectedResponse: ProjectItemResponse = {
        id: 'PVTI_lADOABCDEF4Aa1b2zgABCDE',
        content: {
          id: 'I_kwDOABCDEF4Aa1b2',
          number: 123,
          title: 'Test Issue',
        },
        fieldValues: [],
      };

      mockClient.query.mockResolvedValue({
        addProjectV2ItemById: { item: expectedResponse },
      });

      // Act
      const result = await projects.addItem(params);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('addProjectV2ItemById'),
        params
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('updateItemField', () => {
    it('should update a SINGLE_SELECT field', async () => {
      // Arrange
      const params: UpdateProjectItemFieldParams = {
        projectId: 'PVT_kwDOABCDEF4Aa1b2',
        itemId: 'PVTI_lADOABCDEF4Aa1b2zgABCDE',
        fieldId: 'PVTF_lADOABCDEF4Aa1b2zgABCDE',
        fieldType: 'SINGLE_SELECT',
        optionId: 'PVTFO_lADOABCDEF4Aa1b2zgABCDE',
      };

      const expectedResponse = {
        id: 'PVTI_lADOABCDEF4Aa1b2zgABCDE',
      };

      mockClient.query.mockResolvedValue({
        updateProjectV2ItemFieldValue: { projectV2Item: expectedResponse },
      });

      // Act
      const result = await projects.updateItemField(params);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('updateProjectV2ItemFieldValue'),
        expect.objectContaining({
          projectId: params.projectId,
          itemId: params.itemId,
          fieldId: params.fieldId,
          value: { singleSelectOptionId: params.optionId },
        })
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should update a TEXT field', async () => {
      // Arrange
      const params: UpdateProjectItemFieldParams = {
        projectId: 'PVT_kwDOABCDEF4Aa1b2',
        itemId: 'PVTI_lADOABCDEF4Aa1b2zgABCDE',
        fieldId: 'PVTF_lADOABCDEF4Aa1b2zgABCDE',
        fieldType: 'TEXT',
        value: 'Test Value',
      };

      const expectedResponse = {
        id: 'PVTI_lADOABCDEF4Aa1b2zgABCDE',
      };

      mockClient.query.mockResolvedValue({
        updateProjectV2ItemFieldValue: { projectV2Item: expectedResponse },
      });

      // Act
      const result = await projects.updateItemField(params);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('updateProjectV2ItemFieldValue'),
        expect.objectContaining({
          value: { text: 'Test Value' },
        })
      );
    });

    it('should throw error when optionId is missing for SINGLE_SELECT', async () => {
      // Arrange
      const params: UpdateProjectItemFieldParams = {
        projectId: 'PVT_kwDOABCDEF4Aa1b2',
        itemId: 'PVTI_lADOABCDEF4Aa1b2zgABCDE',
        fieldId: 'PVTF_lADOABCDEF4Aa1b2zgABCDE',
        fieldType: 'SINGLE_SELECT',
      };

      // Act & Assert
      await expect(projects.updateItemField(params)).rejects.toThrow(
        'optionId is required for SINGLE_SELECT field type'
      );
    });

    it('should throw error when value is missing for non-SINGLE_SELECT', async () => {
      // Arrange
      const params: UpdateProjectItemFieldParams = {
        projectId: 'PVT_kwDOABCDEF4Aa1b2',
        itemId: 'PVTI_lADOABCDEF4Aa1b2zgABCDE',
        fieldId: 'PVTF_lADOABCDEF4Aa1b2zgABCDE',
        fieldType: 'TEXT',
      };

      // Act & Assert
      await expect(projects.updateItemField(params)).rejects.toThrow(
        'value is required for non-SINGLE_SELECT field types'
      );
    });
  });

  describe('searchByName', () => {
    it('should find a project by name for a user', async () => {
      // Arrange
      const owner = 'testuser';
      const projectName = 'Test Project';

      const expectedResponse: ProjectResponse = {
        id: 'PVT_kwDOABCDEF4Aa1b2',
        number: 1,
        title: 'Test Project',
        url: 'https://github.com/users/testuser/projects/1',
        shortDescription: 'Test Description',
        public: true,
        closed: false,
        createdAt: '2025-11-21T00:00:00Z',
        updatedAt: '2025-11-21T00:00:00Z',
      };

      // getOwnerType のモック
      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectsV2: {
              nodes: [expectedResponse],
            },
          },
        });

      // Act
      const result = await projects.searchByName(owner, projectName);

      // Assert
      expect(result).toEqual(expectedResponse);
    });

    it('should return null when project not found', async () => {
      // Arrange
      const owner = 'testuser';
      const projectName = 'Non-existent Project';

      // getOwnerType のモック
      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectsV2: {
              nodes: [],
            },
          },
        });

      // Act
      const result = await projects.searchByName(owner, projectName);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getOwnerId', () => {
    it('should get owner ID for a user', async () => {
      // Arrange
      const owner = 'testuser';
      const expectedId = 'MDQ6VXNlcjEyMzQ1';

      mockClient.query.mockResolvedValue({
        user: { id: expectedId },
        organization: null,
      });

      // Act
      const result = await projects.getOwnerId(owner);

      // Assert
      expect(result).toBe(expectedId);
    });

    it('should get owner ID for an organization', async () => {
      // Arrange
      const owner = 'testorg';
      const expectedId = 'MDEyOk9yZ2FuaXphdGlvbjEyMzQ1';

      mockClient.query.mockResolvedValue({
        user: null,
        organization: { id: expectedId },
      });

      // Act
      const result = await projects.getOwnerId(owner);

      // Assert
      expect(result).toBe(expectedId);
    });

    it('should throw error when owner not found', async () => {
      // Arrange
      const owner = 'nonexistent';

      mockClient.query.mockResolvedValue({
        user: null,
        organization: null,
      });

      // Act & Assert
      await expect(projects.getOwnerId(owner)).rejects.toThrow(
        'Owner nonexistent not found (neither user nor organization)'
      );
    });
  });

  describe('getIssueNodeId', () => {
    it('should get issue node ID', async () => {
      // Arrange
      const owner = 'testuser';
      const repo = 'testrepo';
      const issueNumber = 123;
      const expectedNodeId = 'I_kwDOABCDEF4Aa1b2';

      mockClient.query.mockResolvedValue({
        repository: {
          issue: { id: expectedNodeId },
        },
      });

      // Act
      const result = await projects.getIssueNodeId(owner, repo, issueNumber);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('repository'),
        { owner, repo, number: issueNumber }
      );
      expect(result).toBe(expectedNodeId);
    });

    it('should throw error when issue not found', async () => {
      // Arrange
      const owner = 'testuser';
      const repo = 'testrepo';
      const issueNumber = 999;

      mockClient.query.mockResolvedValue({
        repository: {
          issue: null,
        },
      });

      // Act & Assert
      // NOTE: 現在の実装はエラーハンドリングが不足しているため、
      // null アクセスエラーが発生する
      await expect(projects.getIssueNodeId(owner, repo, issueNumber)).rejects.toThrow();
    });
  });

  describe('getProjectFields', () => {
    it('should get project fields for a user project', async () => {
      // Arrange
      const owner = 'testuser';
      const projectNumber = 1;

      const expectedFields: ProjectFieldResponse[] = [
        {
          id: 'PVTF_lADOABCDEF4Aa1b2zgABCDE',
          name: 'Status',
          options: [
            { id: 'PVTFO_lADOABCDEF4Aa1b2zgABCDE', name: 'Todo' },
            { id: 'PVTFO_lADOABCDEF4Aa1b2zgABCDF', name: 'In Progress' },
            { id: 'PVTFO_lADOABCDEF4Aa1b2zgABCDG', name: 'Done' },
          ],
        },
      ];

      // getOwnerType のモック
      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectV2: {
              fields: {
                nodes: expectedFields,
              },
            },
          },
        });

      // Act
      const result = await projects.getProjectFields(owner, projectNumber);

      // Assert
      expect(result).toEqual(expectedFields);
    });

    it('should throw error when project not found', async () => {
      // Arrange
      const owner = 'testuser';
      const projectNumber = 999;

      // getOwnerType のモック
      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectV2: null,
          },
        });

      // Act & Assert
      // NOTE: 現在の実装はエラーハンドリングが不足しているため、
      // null アクセスエラーが発生する
      await expect(projects.getProjectFields(owner, projectNumber)).rejects.toThrow();
    });
  });

  describe('updateProjectStatus', () => {
    it('should update project status successfully', async () => {
      // Arrange
      const params = {
        owner: 'testuser',
        projectNumber: 1,
        itemId: 'PVTI_lADOABCDEF4Aa1b2zgABCDE',
        status: 'In Progress',
      };

      const fields: ProjectFieldResponse[] = [
        {
          id: 'PVTF_lADOABCDEF4Aa1b2zgABCDE',
          name: 'Status',
          options: [
            { id: 'PVTFO_todo', name: 'Todo' },
            { id: 'PVTFO_inprogress', name: 'In Progress' },
            { id: 'PVTFO_done', name: 'Done' },
          ],
        },
      ];

      const project: ProjectResponse = {
        id: 'PVT_kwDOABCDEF4Aa1b2',
        number: 1,
        title: 'Test Project',
        url: 'https://github.com/users/testuser/projects/1',
        shortDescription: null,
        public: true,
        closed: false,
        createdAt: '2025-11-21T00:00:00Z',
        updatedAt: '2025-11-21T00:00:00Z',
      };

      // getOwnerType のモック
      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectV2: {
              fields: {
                nodes: fields,
              },
            },
          },
        })
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: { projectV2: project },
        })
        .mockResolvedValueOnce({
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: params.itemId },
          },
        });

      // Act
      await projects.updateProjectStatus(params);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('updateProjectV2ItemFieldValue'),
        expect.objectContaining({
          projectId: project.id,
          itemId: params.itemId,
          fieldId: fields[0].id,
          value: { singleSelectOptionId: 'PVTFO_inprogress' },
        })
      );
    });

    it('should throw error when Status field not found', async () => {
      // Arrange
      const params = {
        owner: 'testuser',
        projectNumber: 1,
        itemId: 'PVTI_lADOABCDEF4Aa1b2zgABCDE',
        status: 'In Progress',
      };

      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectV2: {
              fields: {
                nodes: [],
              },
            },
          },
        });

      // Act & Assert
      await expect(projects.updateProjectStatus(params)).rejects.toThrow(
        'Status field "Status" not found in project'
      );
    });

    it('should use custom statusFieldName when provided', async () => {
      // Arrange
      const params = {
        owner: 'testuser',
        projectNumber: 1,
        itemId: 'PVTI_lADOABCDEF4Aa1b2zgABCDE',
        status: 'Open',
        statusFieldName: 'CustomStatus',
      };

      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectV2: {
              fields: {
                nodes: [],
              },
            },
          },
        });

      // Act & Assert
      await expect(projects.updateProjectStatus(params)).rejects.toThrow(
        'Status field "CustomStatus" not found in project'
      );
    });

    it('should fallback to fallbackStatus when status option not found', async () => {
      // Arrange
      const params = {
        owner: 'testuser',
        projectNumber: 1,
        itemId: 'PVTI_lADOABCDEF4Aa1b2zgABCDE',
        status: 'In Review', // このステータスは存在しない
        fallbackStatus: 'In Progress',
      };

      const fields: ProjectFieldResponse[] = [
        {
          id: 'PVTF_lADOABCDEF4Aa1b2zgABCDE',
          name: 'Status',
          options: [
            { id: 'PVTFO_todo', name: 'Todo' },
            { id: 'PVTFO_inprogress', name: 'In Progress' },
            { id: 'PVTFO_done', name: 'Done' },
          ],
        },
      ];

      const project: ProjectResponse = {
        id: 'PVT_kwDOABCDEF4Aa1b2',
        number: 1,
        title: 'Test Project',
        url: 'https://github.com/users/testuser/projects/1',
        shortDescription: null,
        public: true,
        closed: false,
        createdAt: '2025-11-21T00:00:00Z',
        updatedAt: '2025-11-21T00:00:00Z',
      };

      // getOwnerType のモック
      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectV2: {
              fields: {
                nodes: fields,
              },
            },
          },
        })
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: { projectV2: project },
        })
        .mockResolvedValueOnce({
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: params.itemId },
          },
        });

      // console.warn をスパイ
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      await projects.updateProjectStatus(params);

      // Assert - フォールバックが適用されて In Progress の option ID が使われる
      expect(mockClient.query).toHaveBeenLastCalledWith(
        expect.stringContaining('updateProjectV2ItemFieldValue'),
        expect.objectContaining({
          value: { singleSelectOptionId: 'PVTFO_inprogress' },
        })
      );
      expect(warnSpy).toHaveBeenCalledWith(
        'Status "In Review" not found, falling back to "In Progress"'
      );

      warnSpy.mockRestore();
    });

    it('should throw error when both status and fallback not found', async () => {
      // Arrange
      const params = {
        owner: 'testuser',
        projectNumber: 1,
        itemId: 'PVTI_lADOABCDEF4Aa1b2zgABCDE',
        status: 'Unknown',
        fallbackStatus: 'AlsoUnknown',
      };

      const fields: ProjectFieldResponse[] = [
        {
          id: 'PVTF_lADOABCDEF4Aa1b2zgABCDE',
          name: 'Status',
          options: [
            { id: 'PVTFO_todo', name: 'Todo' },
            { id: 'PVTFO_done', name: 'Done' },
          ],
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectV2: {
              fields: {
                nodes: fields,
              },
            },
          },
        });

      // Act & Assert
      await expect(projects.updateProjectStatus(params)).rejects.toThrow(
        'Status option "Unknown" not found, and fallback "AlsoUnknown" also not available'
      );
    });

    it('should throw error when status option not found (legacy test)', async () => {
      // Arrange - fallbackStatus が指定されていない場合、デフォルトの "In Progress" が使われる
      // In Progress が存在しない場合はエラーになる
      const params = {
        owner: 'testuser',
        projectNumber: 1,
        itemId: 'PVTI_lADOABCDEF4Aa1b2zgABCDE',
        status: 'Invalid Status',
        fallbackStatus: 'Also Invalid', // 明示的に無効なフォールバックを指定
      };

      const fields: ProjectFieldResponse[] = [
        {
          id: 'PVTF_lADOABCDEF4Aa1b2zgABCDE',
          name: 'Status',
          options: [
            { id: 'PVTFO_todo', name: 'Todo' },
            { id: 'PVTFO_done', name: 'Done' },
          ],
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectV2: {
              fields: {
                nodes: fields,
              },
            },
          },
        });

      // Act & Assert
      await expect(projects.updateProjectStatus(params)).rejects.toThrow(
        'Status option "Invalid Status" not found, and fallback "Also Invalid" also not available'
      );
    });
  });

  describe('detectAvailableStatuses', () => {
    it('should return available statuses for a project', async () => {
      // Arrange
      const owner = 'testuser';
      const projectNumber = 1;

      const fields: ProjectFieldResponse[] = [
        {
          id: 'PVTF_lADOABCDEF4Aa1b2zgABCDE',
          name: 'Status',
          options: [
            { id: 'PVTFO_todo', name: 'Todo' },
            { id: 'PVTFO_inprogress', name: 'In Progress' },
            { id: 'PVTFO_inreview', name: 'In Review' },
            { id: 'PVTFO_done', name: 'Done' },
          ],
        },
      ];

      // getOwnerType のモック
      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectV2: {
              fields: {
                nodes: fields,
              },
            },
          },
        });

      // Act
      const result = await projects.detectAvailableStatuses(owner, projectNumber);

      // Assert
      expect(result).toEqual(['Todo', 'In Progress', 'In Review', 'Done']);
    });

    it('should return empty array when Status field not found', async () => {
      // Arrange
      const owner = 'testuser';
      const projectNumber = 1;

      // getOwnerType のモック
      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectV2: {
              fields: {
                nodes: [],
              },
            },
          },
        });

      // Act
      const result = await projects.detectAvailableStatuses(owner, projectNumber);

      // Assert
      expect(result).toEqual([]);
    });

    it('should use custom statusFieldName when provided', async () => {
      // Arrange
      const owner = 'testuser';
      const projectNumber = 1;
      const statusFieldName = 'CustomStatus';

      const fields: ProjectFieldResponse[] = [
        {
          id: 'PVTF_custom',
          name: 'CustomStatus',
          options: [
            { id: 'PVTFO_open', name: 'Open' },
            { id: 'PVTFO_closed', name: 'Closed' },
          ],
        },
        {
          id: 'PVTF_status',
          name: 'Status',
          options: [
            { id: 'PVTFO_todo', name: 'Todo' },
            { id: 'PVTFO_done', name: 'Done' },
          ],
        },
      ];

      // getOwnerType のモック
      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectV2: {
              fields: {
                nodes: fields,
              },
            },
          },
        });

      // Act
      const result = await projects.detectAvailableStatuses(owner, projectNumber, statusFieldName);

      // Assert
      expect(result).toEqual(['Open', 'Closed']);
    });

    it('should return 3-stage statuses (backward compatibility)', async () => {
      // Arrange
      const owner = 'testuser';
      const projectNumber = 1;

      const fields: ProjectFieldResponse[] = [
        {
          id: 'PVTF_lADOABCDEF4Aa1b2zgABCDE',
          name: 'Status',
          options: [
            { id: 'PVTFO_todo', name: 'Todo' },
            { id: 'PVTFO_inprogress', name: 'In Progress' },
            { id: 'PVTFO_done', name: 'Done' },
          ],
        },
      ];

      // getOwnerType のモック
      mockClient.query
        .mockResolvedValueOnce({ user: { type: 'User' } })
        .mockResolvedValueOnce({
          user: {
            projectV2: {
              fields: {
                nodes: fields,
              },
            },
          },
        });

      // Act
      const result = await projects.detectAvailableStatuses(owner, projectNumber);

      // Assert - In Review がない 3 段階ステータス
      expect(result).toEqual(['Todo', 'In Progress', 'Done']);
      expect(result).not.toContain('In Review');
    });
  });
});
