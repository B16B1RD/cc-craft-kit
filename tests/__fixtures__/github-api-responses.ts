/**
 * GitHub API レスポンスフィクスチャ
 *
 * テストで使用する GitHub API のモックレスポンスを定義します。
 */

/**
 * GitHub User レスポンス
 */
export const mockUserResponse = {
  login: 'test-user',
  id: 12345,
  type: 'User',
  name: 'Test User',
  email: 'test@example.com',
  avatar_url: 'https://avatars.githubusercontent.com/u/12345',
  html_url: 'https://github.com/test-user',
};

/**
 * GitHub Repository レスポンス
 */
export const mockRepoResponse = {
  data: {
    id: 67890,
    name: 'test-repo',
    full_name: 'test-user/test-repo',
    owner: mockUserResponse,
    private: false,
    html_url: 'https://github.com/test-user/test-repo',
    description: 'Test repository',
    fork: false,
    default_branch: 'main',
  },
};

/**
 * GitHub Issue レスポンス
 */
export const mockIssueResponse = {
  data: {
    id: 1111111,
    number: 1,
    title: 'Test Issue',
    body: 'Test issue body',
    state: 'open',
    html_url: 'https://github.com/test-user/test-repo/issues/1',
    user: mockUserResponse,
    labels: [],
    assignees: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
};

/**
 * GitHub Issue Comment レスポンス
 */
export const mockCommentResponse = {
  data: {
    id: 2222222,
    body: 'Test comment',
    user: mockUserResponse,
    html_url: 'https://github.com/test-user/test-repo/issues/1#issuecomment-2222222',
    created_at: '2025-01-01T01:00:00Z',
    updated_at: '2025-01-01T01:00:00Z',
  },
};

/**
 * GitHub Label レスポンス
 */
export const mockLabelResponse = {
  data: [
    {
      id: 3333333,
      name: 'requirements',
      color: 'blue',
      description: 'Requirements phase',
    },
    {
      id: 3333334,
      name: 'design',
      color: 'green',
      description: 'Design phase',
    },
  ],
};

/**
 * GitHub Project v2 レスポンス（GraphQL）
 */
export const mockProjectV2Response = {
  repository: {
    projectV2: {
      id: 'PVT_kwDOABCDEF',
      number: 1,
      title: 'Test Project',
      url: 'https://github.com/users/test-user/projects/1',
      fields: {
        nodes: [
          {
            id: 'PVTF_lADOABCDEF',
            name: 'Status',
            dataType: 'SINGLE_SELECT',
            options: [
              { id: 'option1', name: 'Todo' },
              { id: 'option2', name: 'In Progress' },
              { id: 'option3', name: 'Done' },
            ],
          },
        ],
      },
      items: {
        nodes: [
          {
            id: 'PVTI_lADOABCDEF',
            content: {
              id: 'I_kwDOABCDEF',
              number: 1,
            },
            fieldValues: {
              nodes: [
                {
                  field: {
                    id: 'PVTF_lADOABCDEF',
                    name: 'Status',
                  },
                  value: 'Todo',
                },
              ],
            },
          },
        ],
      },
    },
  },
};

/**
 * GitHub Project v2 Item 追加レスポンス（GraphQL）
 */
export const mockAddProjectV2ItemResponse = {
  addProjectV2ItemById: {
    item: {
      id: 'PVTI_lADOABCDEF',
    },
  },
};

/**
 * GitHub Project v2 Item フィールド更新レスポンス（GraphQL）
 */
export const mockUpdateProjectV2ItemFieldValueResponse = {
  updateProjectV2ItemFieldValue: {
    projectV2Item: {
      id: 'PVTI_lADOABCDEF',
    },
  },
};

/**
 * GitHub Pull Request レスポンス
 */
export const mockPullRequestResponse = {
  data: {
    id: 4444444,
    number: 10,
    title: 'Test Pull Request',
    body: 'Test PR body',
    state: 'open',
    html_url: 'https://github.com/test-user/test-repo/pull/10',
    user: mockUserResponse,
    head: {
      ref: 'feature-branch',
      sha: 'abc1234567890def',
    },
    base: {
      ref: 'main',
      sha: 'fed0987654321cba',
    },
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
  },
};

/**
 * GitHub Milestone レスポンス
 */
export const mockMilestoneResponse = {
  data: {
    id: 5555555,
    number: 1,
    title: 'v1.0',
    description: 'Version 1.0 release',
    state: 'open',
    html_url: 'https://github.com/test-user/test-repo/milestone/1',
    created_at: '2025-01-03T00:00:00Z',
    due_on: '2025-12-31T00:00:00Z',
  },
};
