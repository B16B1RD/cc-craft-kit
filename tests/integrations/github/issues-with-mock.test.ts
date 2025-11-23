/**
 * GitHubIssues モックファクトリーを使用した単体テスト
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { GitHubIssues } from '../../../src/integrations/github/issues.js';
import { createMockGitHubClient, createIssueFixture, createMockOctokitResponse } from '../../helpers/index.js';

describe('GitHubIssues with Mock Factory', () => {
  let mockClient: ReturnType<typeof createMockGitHubClient>;
  let githubIssues: GitHubIssues;

  beforeEach(() => {
    mockClient = createMockGitHubClient();
    githubIssues = new GitHubIssues(mockClient);
  });

  describe('create', () => {
    test('should create an issue successfully', async () => {
      const issueFixture = createIssueFixture({
        number: 123,
        title: 'Test Issue',
      });

      mockClient.rest.issues.create = jest
        .fn()
        .mockResolvedValue(createMockOctokitResponse(issueFixture));

      const result = await githubIssues.create({
        owner: 'testowner',
        repo: 'testrepo',
        title: 'Test Issue',
        body: 'Test body',
      });

      expect(result).toEqual(issueFixture);
      expect(mockClient.rest.issues.create).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        title: 'Test Issue',
        body: 'Test body',
        labels: undefined,
        assignees: undefined,
        milestone: undefined,
      });
    });
  });

  describe('get', () => {
    test('should get an issue successfully', async () => {
      const issueFixture = createIssueFixture({
        number: 456,
        title: 'Existing Issue',
      });

      mockClient.rest.issues.get = jest
        .fn()
        .mockResolvedValue(createMockOctokitResponse(issueFixture));

      const result = await githubIssues.get('testowner', 'testrepo', 456);

      expect(result).toEqual(issueFixture);
      expect(mockClient.rest.issues.get).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        issue_number: 456,
      });
    });
  });

  describe('update', () => {
    test('should update an issue successfully', async () => {
      const issueFixture = createIssueFixture({
        number: 789,
        title: 'Updated Issue',
        state: 'closed',
      });

      mockClient.rest.issues.update = jest
        .fn()
        .mockResolvedValue(createMockOctokitResponse(issueFixture));

      const result = await githubIssues.update({
        owner: 'testowner',
        repo: 'testrepo',
        issueNumber: 789,
        title: 'Updated Issue',
        state: 'closed',
      });

      expect(result.state).toBe('closed');
      expect(result.title).toBe('Updated Issue');
      expect(mockClient.rest.issues.update).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        issue_number: 789,
        title: 'Updated Issue',
        body: undefined,
        state: 'closed',
        labels: undefined,
        assignees: undefined,
        milestone: undefined,
      });
    });
  });

  describe('addComment', () => {
    test('should add a comment to an issue', async () => {
      const commentData = {
        id: 999,
        body: 'Test comment',
        created_at: '2025-01-01T00:00:00Z',
      };

      mockClient.rest.issues.createComment = jest
        .fn()
        .mockResolvedValue(createMockOctokitResponse(commentData));

      const result = await githubIssues.addComment('testowner', 'testrepo', 123, 'Test comment');

      expect(result).toEqual({
        id: 999,
        body: 'Test comment',
        created_at: '2025-01-01T00:00:00Z',
      });
      expect(mockClient.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        issue_number: 123,
        body: 'Test comment',
      });
    });
  });

  describe('close', () => {
    test('should close an issue successfully', async () => {
      const issueFixture = createIssueFixture({
        number: 123,
        title: 'Test Issue',
        state: 'closed',
      });

      mockClient.rest.issues.update = jest
        .fn()
        .mockResolvedValue(createMockOctokitResponse(issueFixture));

      const result = await githubIssues.close('testowner', 'testrepo', 123);

      expect(result.state).toBe('closed');
      expect(result.number).toBe(123);
      expect(mockClient.rest.issues.update).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        issue_number: 123,
        state: 'closed',
        title: undefined,
        body: undefined,
        labels: undefined,
        assignees: undefined,
        milestone: undefined,
      });
    });

    test('should handle 404 error when issue does not exist', async () => {
      const error = new Error('Not Found');
      mockClient.rest.issues.update = jest.fn().mockRejectedValue(error);

      await expect(githubIssues.close('testowner', 'testrepo', 999)).rejects.toThrow('Not Found');
    });

    test('should handle 401 authentication error', async () => {
      const error = new Error('Bad credentials');
      mockClient.rest.issues.update = jest.fn().mockRejectedValue(error);

      await expect(githubIssues.close('testowner', 'testrepo', 123)).rejects.toThrow(
        'Bad credentials'
      );
    });

    test('should handle 403 rate limit error', async () => {
      const error = new Error('API rate limit exceeded');
      mockClient.rest.issues.update = jest.fn().mockRejectedValue(error);

      await expect(githubIssues.close('testowner', 'testrepo', 123)).rejects.toThrow(
        'API rate limit exceeded'
      );
    });

    test('should handle 500 server error', async () => {
      const error = new Error('Internal server error');
      mockClient.rest.issues.update = jest.fn().mockRejectedValue(error);

      await expect(githubIssues.close('testowner', 'testrepo', 123)).rejects.toThrow(
        'Internal server error'
      );
    });
  });
});
