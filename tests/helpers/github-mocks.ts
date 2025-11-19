/**
 * GitHub API クライアントのモックヘルパー
 */

export function createMockGitHubIssues() {
  return {
    create: jest.fn(),
    update: jest.fn(),
    addComment: jest.fn(),
    close: jest.fn(),
  };
}

export function createMockGitHubProjects() {
  return {
    get: jest.fn(),
    getIssueNodeId: jest.fn(),
    addItem: jest.fn(),
    updateProjectStatus: jest.fn(),
    verifyProjectStatusUpdate: jest.fn(),
  };
}

export function createMockSubIssueManager() {
  return {
    createSubIssuesFromTaskList: jest.fn(),
    updateSubIssueStatus: jest.fn(),
  };
}
