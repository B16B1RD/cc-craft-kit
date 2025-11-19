/**
 * テストフィクスチャ
 *
 * テストデータ生成ヘルパー
 */

import type { IssueResponse } from '../../src/integrations/github/issues.js';
import type { ProjectResponse } from '../../src/integrations/github/projects.js';

/**
 * GitHub Issue フィクスチャ
 */
export function createIssueFixture(overrides?: Partial<IssueResponse>): IssueResponse {
  return {
    id: 123456789,
    number: 1,
    title: 'Test Issue',
    body: 'This is a test issue body',
    state: 'open',
    html_url: 'https://github.com/owner/repo/issues/1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    labels: [
      {
        id: 1,
        name: 'bug',
        color: 'd73a4a',
      },
    ],
    assignees: [
      {
        id: 100,
        login: 'testuser',
      },
    ],
    milestone: null,
    ...overrides,
  };
}

/**
 * GitHub Project フィクスチャ
 */
export function createProjectFixture(overrides?: Partial<ProjectResponse>): ProjectResponse {
  return {
    id: 'PVT_kwDOABCDEFG',
    number: 1,
    title: 'Test Project',
    url: 'https://github.com/users/testuser/projects/1',
    shortDescription: 'A test project',
    public: false,
    closed: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Spec データフィクスチャ
 */
export interface SpecFixture {
  id: string;
  name: string;
  description: string | null;
  phase: 'requirements' | 'design' | 'tasks' | 'implementation' | 'completed';
  file_path: string;
  created_at: string;
  updated_at: string;
}

export function createSpecFixture(overrides?: Partial<SpecFixture>): SpecFixture {
  const id = overrides?.id || 'f6621295-1234-5678-9abc-def012345678';
  return {
    id,
    name: 'Test Specification',
    description: 'This is a test specification',
    phase: 'requirements',
    file_path: `.cc-craft-kit/specs/${id}.md`,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Task データフィクスチャ
 */
export interface TaskFixture {
  id: string;
  spec_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'blocked' | 'review' | 'done';
  priority: number;
  dependencies: string[] | null;
  created_at: string;
  updated_at: string;
}

export function createTaskFixture(overrides?: Partial<TaskFixture>): TaskFixture {
  return {
    id: 'task-1234-5678-9abc',
    spec_id: 'f6621295-1234-5678-9abc-def012345678',
    title: 'Test Task',
    description: 'This is a test task',
    status: 'todo',
    priority: 1,
    dependencies: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * GitHub Sync データフィクスチャ
 */
export interface GitHubSyncFixture {
  id: number;
  entity_type: 'spec' | 'task';
  entity_id: string;
  github_type: 'issue' | 'pr';
  github_id: number;
  github_number: number;
  github_url: string;
  last_synced_at: string;
  sync_status: 'success' | 'failed' | 'pending';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function createGitHubSyncFixture(overrides?: Partial<GitHubSyncFixture>): GitHubSyncFixture {
  return {
    id: 1,
    entity_type: 'spec',
    entity_id: 'f6621295-1234-5678-9abc-def012345678',
    github_type: 'issue',
    github_id: 123456789,
    github_number: 1,
    github_url: 'https://github.com/owner/repo/issues/1',
    last_synced_at: '2025-01-01T00:00:00Z',
    sync_status: 'success',
    error_message: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * ランダムUUID生成ヘルパー
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * ISO日付文字列生成ヘルパー
 */
export function createISODate(daysOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}
