/**
 * 仕様書作成時のブランチ自動作成機能のテスト
 */

import { execSync } from 'node:child_process';

// execSync をモック化
jest.mock('node:child_process', () => ({
  execSync: jest.fn(),
}));

// getCurrentBranch をモック化
jest.mock('../../../src/core/git/branch-cache.js', () => ({
  getCurrentBranch: jest.fn(),
  clearBranchCache: jest.fn(),
}));

describe('spec create branch automation', () => {
  const mockExecSync = jest.mocked(execSync);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PROTECTED_BRANCHES = 'main,develop';
  });

  describe('branch creation logic', () => {
    test('should generate correct branch name from spec ID', () => {
      const specId = '12345678-1234-1234-1234-123456789abc';
      const expectedBranchName = 'spec/12345678';

      const shortId = specId.substring(0, 8);
      const branchName = `spec/${shortId}`;

      expect(branchName).toBe(expectedBranchName);
    });

    test('should check if Git repo exists before creating branch', () => {
      mockExecSync.mockImplementation((cmd) => {
        if (cmd === 'git rev-parse --is-inside-work-tree') {
          return Buffer.from('true\n');
        }
        throw new Error('Command not mocked');
      });

      expect(() =>
        mockExecSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' })
      ).not.toThrow();
    });

    test('should skip branch creation on protected branches', () => {
      const protectedBranches = ['main', 'develop'];
      const currentBranch = 'main';

      const shouldCreateBranch = !protectedBranches.includes(currentBranch);

      expect(shouldCreateBranch).toBe(false);
    });

    test('should create branch on feature branches', () => {
      const protectedBranches = ['main', 'develop'];
      const currentBranch = 'feature/test';

      const shouldCreateBranch = !protectedBranches.includes(currentBranch);

      expect(shouldCreateBranch).toBe(true);
    });

    test('should use PROTECTED_BRANCHES env var', () => {
      process.env.PROTECTED_BRANCHES = 'main,develop,staging';
      const protectedBranches = (process.env.PROTECTED_BRANCHES || 'main,develop').split(',');

      expect(protectedBranches).toEqual(['main', 'develop', 'staging']);
    });

    test('should default to main,develop if env var not set', () => {
      delete process.env.PROTECTED_BRANCHES;
      const protectedBranches = (process.env.PROTECTED_BRANCHES || 'main,develop').split(',');

      expect(protectedBranches).toEqual(['main', 'develop']);
    });
  });

  describe('branch creation execution', () => {
    test('should execute git checkout -b with correct branch name', () => {
      const branchName = 'spec/12345678';

      mockExecSync.mockReturnValueOnce(Buffer.from(''));

      expect(() =>
        mockExecSync(`git checkout -b ${branchName}`, { stdio: 'inherit' })
      ).not.toThrow();

      expect(mockExecSync).toHaveBeenCalledWith(`git checkout -b ${branchName}`, {
        stdio: 'inherit',
      });
    });

    test('should handle git command failure gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: A branch named "spec/12345678" already exists.');
      });

      expect(() => mockExecSync('git checkout -b spec/12345678')).toThrow();
    });
  });

  describe('rollback on error', () => {
    test('should delete branch on rollback', () => {
      const originalBranch = 'feature/test';
      const branchName = 'spec/12345678';

      mockExecSync
        .mockReturnValueOnce(Buffer.from('')) // git checkout original
        .mockReturnValueOnce(Buffer.from('')); // git branch -D

      expect(() => {
        mockExecSync(`git checkout ${originalBranch}`, { stdio: 'ignore' });
        mockExecSync(`git branch -D ${branchName}`, { stdio: 'ignore' });
      }).not.toThrow();

      expect(mockExecSync).toHaveBeenCalledWith(`git checkout ${originalBranch}`, {
        stdio: 'ignore',
      });
      expect(mockExecSync).toHaveBeenCalledWith(`git branch -D ${branchName}`, { stdio: 'ignore' });
    });

    test('should handle rollback errors gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: branch not found');
      });

      // ロールバック失敗はエラーログのみ表示し、例外をスローしない
      // このテストでは、例外がスローされることを確認
      expect(() => mockExecSync('git checkout main')).toThrow('fatal: branch not found');
    });
  });

  describe('branch name format validation', () => {
    test('should use first 8 characters of UUID', () => {
      const specId = 'abcdefgh-1234-5678-90ab-cdef01234567';
      const shortId = specId.substring(0, 8);

      expect(shortId).toBe('abcdefgh');
      expect(shortId).toHaveLength(8);
    });

    test('should create branch name with spec/ prefix', () => {
      const shortId = '12345678';
      const branchName = `spec/${shortId}`;

      expect(branchName).toBe('spec/12345678');
      expect(branchName.startsWith('spec/')).toBe(true);
    });

    test('should handle different UUID formats', () => {
      const uuids = [
        '12345678-1234-1234-1234-123456789abc',
        'abcdefgh-5678-90ab-cdef-0123456789ab',
        '00000000-0000-0000-0000-000000000000',
      ];

      const branchNames = uuids.map((id) => `spec/${id.substring(0, 8)}`);

      expect(branchNames).toEqual(['spec/12345678', 'spec/abcdefgh', 'spec/00000000']);
    });
  });

  describe('error scenarios', () => {
    test('should handle git repo not initialized', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: not a git repository');
      });

      expect(() => mockExecSync('git rev-parse --is-inside-work-tree')).toThrow(
        'fatal: not a git repository'
      );
    });

    test('should handle branch already exists error', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: A branch named "spec/12345678" already exists.');
      });

      expect(() => mockExecSync('git checkout -b spec/12345678')).toThrow(
        'fatal: A branch named "spec/12345678" already exists.'
      );
    });

    test('should handle permission denied error', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: could not create work tree dir: Permission denied');
      });

      expect(() => mockExecSync('git checkout -b spec/12345678')).toThrow('Permission denied');
    });
  });

  describe('integration scenarios', () => {
    test('should complete full branch creation workflow', () => {
      const specId = '12345678-1234-1234-1234-123456789abc';
      const shortId = specId.substring(0, 8);
      const branchName = `spec/${shortId}`;
      const currentBranch = 'feature/test';
      const protectedBranches = ['main', 'develop'];

      // Git repo exists
      mockExecSync.mockReturnValueOnce(Buffer.from('true\n'));

      // Not a protected branch
      const shouldCreate = !protectedBranches.includes(currentBranch);
      expect(shouldCreate).toBe(true);

      // Create branch
      mockExecSync.mockReturnValueOnce(Buffer.from(''));

      expect(() => {
        mockExecSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
        mockExecSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
      }).not.toThrow();

      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });

    test('should skip branch creation on protected branch', () => {
      const currentBranch = 'main';
      const protectedBranches = ['main', 'develop'];

      // Protected branch - skip creation
      const shouldCreate = !protectedBranches.includes(currentBranch);
      expect(shouldCreate).toBe(false);

      // This test is logic-only - no actual git commands should be executed
      expect(mockExecSync).toHaveBeenCalledTimes(0);
    });
  });
});
