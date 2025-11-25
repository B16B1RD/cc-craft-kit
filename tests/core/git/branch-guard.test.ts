/**
 * BranchGuard のテスト
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { execSync } from 'node:child_process';
import {
  getCurrentBranch,
  getProtectedBranches,
  isProtectedBranch,
  validateBranch,
  suggestWorkingBranch,
  clearCache,
} from '../../../src/core/git/branch-guard.js';
import { ProtectedBranchError } from '../../../src/core/errors/protected-branch-error.js';

// execSync のモック
jest.mock('node:child_process');
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('BranchGuard', () => {
  beforeEach(() => {
    // キャッシュをクリア
    clearCache();
    // 環境変数をクリア
    delete process.env.PROTECTED_BRANCHES;
    // モックをリセット
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearCache();
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      mockedExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          return '.git\n' as unknown as Buffer;
        }
        if (command === 'git rev-parse --abbrev-ref HEAD') {
          return 'feature/test-branch\n' as unknown as Buffer;
        }
        throw new Error('Unexpected command');
      });

      const branch = await getCurrentBranch();
      expect(branch).toBe('feature/test-branch');
    });

    it('should throw error if not a git repository', async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      await expect(getCurrentBranch()).rejects.toThrow('Not a git repository');
    });

    it('should cache branch name', async () => {
      mockedExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          return '.git\n' as unknown as Buffer;
        }
        if (command === 'git rev-parse --abbrev-ref HEAD') {
          return 'main\n' as unknown as Buffer;
        }
        throw new Error('Unexpected command');
      });

      const branch1 = await getCurrentBranch();
      const branch2 = await getCurrentBranch();

      expect(branch1).toBe('main');
      expect(branch2).toBe('main');
      // 2回目の呼び出しではキャッシュが使われるため、execSync は1度だけ呼ばれる
      expect(mockedExecSync).toHaveBeenCalledTimes(2); // git-dir チェック + branch 取得
    });
  });

  describe('getProtectedBranches', () => {
    it('should return branches from environment variable', async () => {
      process.env.PROTECTED_BRANCHES = 'main,develop,staging';

      const branches = await getProtectedBranches();
      expect(branches).toEqual(['main', 'develop', 'staging']);
    });

    it('should trim whitespace from branch names', async () => {
      process.env.PROTECTED_BRANCHES = ' main , develop , staging ';

      const branches = await getProtectedBranches();
      expect(branches).toEqual(['main', 'develop', 'staging']);
    });

    it('should filter empty branch names', async () => {
      process.env.PROTECTED_BRANCHES = 'main,,develop,';

      const branches = await getProtectedBranches();
      expect(branches).toEqual(['main', 'develop']);
    });

    it('should auto-detect default branch when environment variable is not set', async () => {
      mockedExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          return '.git\n' as unknown as Buffer;
        }
        if (command === 'git symbolic-ref refs/remotes/origin/HEAD') {
          return 'refs/remotes/origin/main\n' as unknown as Buffer;
        }
        throw new Error('Unexpected command');
      });

      const branches = await getProtectedBranches();
      expect(branches).toEqual(['main']);
    });

    it('should fallback to main if remote default branch detection fails', async () => {
      mockedExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          return '.git\n' as unknown as Buffer;
        }
        if (command === 'git symbolic-ref refs/remotes/origin/HEAD') {
          throw new Error('No remote HEAD');
        }
        if (command === 'git rev-parse --verify main') {
          return '' as unknown as Buffer; // main ブランチが存在
        }
        throw new Error('Unexpected command');
      });

      const branches = await getProtectedBranches();
      expect(branches).toEqual(['main']);
    });

    it('should fallback to master if main does not exist', async () => {
      mockedExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          return '.git\n' as unknown as Buffer;
        }
        if (command === 'git symbolic-ref refs/remotes/origin/HEAD') {
          throw new Error('No remote HEAD');
        }
        if (command === 'git rev-parse --verify main') {
          throw new Error('main does not exist');
        }
        if (command === 'git rev-parse --verify master') {
          return '' as unknown as Buffer; // master ブランチが存在
        }
        throw new Error('Unexpected command');
      });

      const branches = await getProtectedBranches();
      expect(branches).toEqual(['master']);
    });

    it('should cache protected branches', async () => {
      process.env.PROTECTED_BRANCHES = 'main,develop';

      const branches1 = await getProtectedBranches();
      const branches2 = await getProtectedBranches();

      expect(branches1).toEqual(['main', 'develop']);
      expect(branches2).toEqual(['main', 'develop']);
    });
  });

  describe('isProtectedBranch', () => {
    it('should return true if branch is protected', async () => {
      process.env.PROTECTED_BRANCHES = 'main,develop';

      const isProtected1 = await isProtectedBranch('main');
      const isProtected2 = await isProtectedBranch('develop');

      expect(isProtected1).toBe(true);
      expect(isProtected2).toBe(true);
    });

    it('should return false if branch is not protected', async () => {
      process.env.PROTECTED_BRANCHES = 'main,develop';

      const isProtected = await isProtectedBranch('feature/test');

      expect(isProtected).toBe(false);
    });
  });

  describe('validateBranch', () => {
    it('should not throw error if current branch is not protected', async () => {
      process.env.PROTECTED_BRANCHES = 'main,develop';
      mockedExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          return '.git\n' as unknown as Buffer;
        }
        if (command === 'git rev-parse --abbrev-ref HEAD') {
          return 'feature/test-branch\n' as unknown as Buffer;
        }
        throw new Error('Unexpected command');
      });

      await expect(validateBranch()).resolves.not.toThrow();
    });

    it('should throw ProtectedBranchError if current branch is protected', async () => {
      process.env.PROTECTED_BRANCHES = 'main,develop';
      mockedExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          return '.git\n' as unknown as Buffer;
        }
        if (command === 'git rev-parse --abbrev-ref HEAD') {
          return 'main\n' as unknown as Buffer;
        }
        throw new Error('Unexpected command');
      });

      await expect(validateBranch()).rejects.toThrow(ProtectedBranchError);
    });

    it('should not throw error if not a git repository', async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      await expect(validateBranch()).resolves.not.toThrow();
    });
  });

  describe('suggestWorkingBranch', () => {
    it('should suggest feature branch for implementation phase', () => {
      const suggestions = suggestWorkingBranch('implementation');
      expect(suggestions).toContain('feature/<機能名>');
    });

    it('should suggest common branches for no phase', () => {
      const suggestions = suggestWorkingBranch();
      expect(suggestions).toContain('feature/<機能名>');
      expect(suggestions).toContain('fix/<修正内容>');
      expect(suggestions).toContain('refactor/<リファクタリング内容>');
    });

    it('should not have duplicate suggestions', () => {
      const suggestions = suggestWorkingBranch('implementation');
      const unique = Array.from(new Set(suggestions));
      expect(suggestions.length).toBe(unique.length);
    });
  });
});
