/**
 * ブランチキャッシュ機構のテスト
 */

import { execSync } from 'node:child_process';
import { getCurrentBranch, clearBranchCache } from '../../../src/core/git/branch-cache.js';

// execSync をモック化
jest.mock('node:child_process', () => ({
  execSync: jest.fn(),
}));

describe('branch-cache', () => {
  const mockExecSync = jest.mocked(execSync);

  beforeEach(() => {
    // 各テスト前にキャッシュをクリア
    clearBranchCache();
    jest.clearAllMocks();
  });

  describe('getCurrentBranch', () => {
    test('should return current branch name from git command', () => {
      mockExecSync.mockReturnValueOnce('feature/test-branch\n' as never);

      const branch = getCurrentBranch();

      expect(branch).toBe('feature/test-branch');
      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    test('should cache branch name and not call git command twice', () => {
      mockExecSync.mockReturnValueOnce('develop\n' as never);

      const branch1 = getCurrentBranch();
      const branch2 = getCurrentBranch();

      expect(branch1).toBe('develop');
      expect(branch2).toBe('develop');
      expect(mockExecSync).toHaveBeenCalledTimes(1);
    });

    test('should return "main" when git command fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      const branch = getCurrentBranch();

      expect(branch).toBe('main');
    });

    test('should bypass cache when cache option is false', () => {
      mockExecSync
        .mockReturnValueOnce('develop\n' as never)
        .mockReturnValueOnce('feature/new-branch\n' as never);

      const branch1 = getCurrentBranch();
      const branch2 = getCurrentBranch({ cache: false });

      expect(branch1).toBe('develop');
      expect(branch2).toBe('feature/new-branch');
      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });

    test('should trim whitespace from branch name', () => {
      mockExecSync.mockReturnValueOnce('  feature/test  \n' as never);

      const branch = getCurrentBranch();

      expect(branch).toBe('feature/test');
    });
  });

  describe('clearBranchCache', () => {
    test('should clear cache and force git command execution', () => {
      mockExecSync
        .mockReturnValueOnce('develop\n' as never)
        .mockReturnValueOnce('feature/new-branch\n' as never);

      const branch1 = getCurrentBranch();
      clearBranchCache();
      const branch2 = getCurrentBranch();

      expect(branch1).toBe('develop');
      expect(branch2).toBe('feature/new-branch');
      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });

    test('should handle multiple cache clears', () => {
      mockExecSync
        .mockReturnValueOnce('main\n' as never)
        .mockReturnValueOnce('develop\n' as never)
        .mockReturnValueOnce('feature/test\n' as never);

      const branch1 = getCurrentBranch();
      clearBranchCache();
      const branch2 = getCurrentBranch();
      clearBranchCache();
      const branch3 = getCurrentBranch();

      expect(branch1).toBe('main');
      expect(branch2).toBe('develop');
      expect(branch3).toBe('feature/test');
      expect(mockExecSync).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    test('should cache "main" when git command fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      const branch1 = getCurrentBranch();
      const branch2 = getCurrentBranch();

      expect(branch1).toBe('main');
      expect(branch2).toBe('main');
      expect(mockExecSync).toHaveBeenCalledTimes(1);
    });

    test('should handle different error types', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: not a git repository');
      });

      const branch = getCurrentBranch();

      expect(branch).toBe('main');
    });
  });
});
