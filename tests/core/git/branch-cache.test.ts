/**
 * ブランチキャッシュ機構のテスト
 */

describe('branch-cache', () => {
  beforeEach(() => {
    // モジュールキャッシュをクリアして、各テストで独立したモジュールをロード
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('getCurrentBranch', () => {
    test('should return current branch name from git command', async () => {
      await jest.isolateModulesAsync(async () => {
        const mockExecSync = jest.fn().mockReturnValueOnce('feature/test-branch\n');
        jest.doMock('node:child_process', () => ({
          execSync: mockExecSync,
        }));

        const { getCurrentBranch } = await import('../../../src/core/git/branch-cache.js');
        const branch = getCurrentBranch();

        expect(branch).toBe('feature/test-branch');
        expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --abbrev-ref HEAD', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      });
    });

    test('should cache branch name and not call git command twice', async () => {
      await jest.isolateModulesAsync(async () => {
        const mockExecSync = jest.fn().mockReturnValueOnce('develop\n');
        jest.doMock('node:child_process', () => ({
          execSync: mockExecSync,
        }));

        const { getCurrentBranch } = await import('../../../src/core/git/branch-cache.js');
        const branch1 = getCurrentBranch();
        const branch2 = getCurrentBranch();

        expect(branch1).toBe('develop');
        expect(branch2).toBe('develop');
        expect(mockExecSync).toHaveBeenCalledTimes(1);
      });
    });

    test('should return "main" when git command fails', async () => {
      await jest.isolateModulesAsync(async () => {
        const mockExecSync = jest.fn().mockImplementation(() => {
          throw new Error('Not a git repository');
        });
        jest.doMock('node:child_process', () => ({
          execSync: mockExecSync,
        }));

        const { getCurrentBranch } = await import('../../../src/core/git/branch-cache.js');
        const branch = getCurrentBranch();

        expect(branch).toBe('main');
      });
    });

    test('should bypass cache when cache option is false', async () => {
      await jest.isolateModulesAsync(async () => {
        const mockExecSync = jest
          .fn()
          .mockReturnValueOnce('develop\n')
          .mockReturnValueOnce('feature/new-branch\n');
        jest.doMock('node:child_process', () => ({
          execSync: mockExecSync,
        }));

        const { getCurrentBranch } = await import('../../../src/core/git/branch-cache.js');
        const branch1 = getCurrentBranch();
        const branch2 = getCurrentBranch({ cache: false });

        expect(branch1).toBe('develop');
        expect(branch2).toBe('feature/new-branch');
        expect(mockExecSync).toHaveBeenCalledTimes(2);
      });
    });

    test('should trim whitespace from branch name', async () => {
      await jest.isolateModulesAsync(async () => {
        const mockExecSync = jest.fn().mockReturnValueOnce('  feature/test  \n');
        jest.doMock('node:child_process', () => ({
          execSync: mockExecSync,
        }));

        const { getCurrentBranch } = await import('../../../src/core/git/branch-cache.js');
        const branch = getCurrentBranch();

        expect(branch).toBe('feature/test');
      });
    });
  });

  describe('clearBranchCache', () => {
    test('should clear cache and force git command execution', async () => {
      await jest.isolateModulesAsync(async () => {
        const mockExecSync = jest
          .fn()
          .mockReturnValueOnce('develop\n')
          .mockReturnValueOnce('feature/new-branch\n');
        jest.doMock('node:child_process', () => ({
          execSync: mockExecSync,
        }));

        const { getCurrentBranch, clearBranchCache } = await import('../../../src/core/git/branch-cache.js');
        const branch1 = getCurrentBranch();
        clearBranchCache();
        const branch2 = getCurrentBranch();

        expect(branch1).toBe('develop');
        expect(branch2).toBe('feature/new-branch');
        expect(mockExecSync).toHaveBeenCalledTimes(2);
      });
    });

    test('should handle multiple cache clears', async () => {
      await jest.isolateModulesAsync(async () => {
        const mockExecSync = jest
          .fn()
          .mockReturnValueOnce('main\n')
          .mockReturnValueOnce('develop\n')
          .mockReturnValueOnce('feature/test\n');
        jest.doMock('node:child_process', () => ({
          execSync: mockExecSync,
        }));

        const { getCurrentBranch, clearBranchCache } = await import('../../../src/core/git/branch-cache.js');
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
  });

  describe('error handling', () => {
    test('should cache "main" when git command fails', async () => {
      await jest.isolateModulesAsync(async () => {
        const mockExecSync = jest.fn().mockImplementation(() => {
          throw new Error('Not a git repository');
        });
        jest.doMock('node:child_process', () => ({
          execSync: mockExecSync,
        }));

        const { getCurrentBranch } = await import('../../../src/core/git/branch-cache.js');
        const branch1 = getCurrentBranch();
        const branch2 = getCurrentBranch();

        expect(branch1).toBe('main');
        expect(branch2).toBe('main');
        expect(mockExecSync).toHaveBeenCalledTimes(1);
      });
    });

    test('should handle different error types', async () => {
      await jest.isolateModulesAsync(async () => {
        const mockExecSync = jest.fn().mockImplementation(() => {
          throw new Error('fatal: not a git repository');
        });
        jest.doMock('node:child_process', () => ({
          execSync: mockExecSync,
        }));

        const { getCurrentBranch } = await import('../../../src/core/git/branch-cache.js');
        const branch = getCurrentBranch();

        expect(branch).toBe('main');
      });
    });
  });
});
