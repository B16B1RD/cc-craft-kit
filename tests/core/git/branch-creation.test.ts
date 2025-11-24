/**
 * ブランチ作成機能のテスト
 */

import { execFileSync } from 'node:child_process';
import { createSpecBranch } from '../../../src/core/git/branch-creation.js';
import { getCurrentBranch, clearBranchCache } from '../../../src/core/git/branch-cache.js';
import { getGitHubConfig } from '../../../src/core/config/github-config.js';

// execFileSync, getCurrentBranch, getGitHubConfig をモック化
jest.mock('node:child_process', () => ({
  execFileSync: jest.fn(),
}));

jest.mock('../../../src/core/git/branch-cache.js', () => ({
  getCurrentBranch: jest.fn(),
  clearBranchCache: jest.fn(),
}));

jest.mock('../../../src/core/config/github-config.js', () => ({
  getGitHubConfig: jest.fn(),
}));

describe('branch-creation', () => {
  const mockExecFileSync = jest.mocked(execFileSync);
  const mockGetCurrentBranch = jest.mocked(getCurrentBranch);
  const mockGetGitHubConfig = jest.mocked(getGitHubConfig);

  beforeEach(() => {
    jest.clearAllMocks();
    // デフォルトの GitHubConfig をモック
    mockGetGitHubConfig.mockReturnValue({
      owner: null,
      repo: null,
      baseBranch: 'develop',
      defaultBaseBranch: 'develop',
      protectedBranches: ['main', 'develop'],
    });
  });

  describe('createSpecBranch', () => {
    const validUuid = '12345678-1234-1234-1234-123456789abc';
    const shortId = '12345678';

    describe('UUID バリデーション', () => {
      test('should throw error for invalid UUID format', () => {
        expect(() => createSpecBranch('invalid-uuid')).toThrow(
          'Invalid spec ID format. Expected UUID, got: invalid-uuid'
        );
      });

      test('should accept valid UUID format', () => {
        const expectedBranch = `feature/spec-${shortId}`;
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --is-inside-work-tree
        mockGetCurrentBranch.mockReturnValue('main');
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid);

        expect(result).toBeDefined();
        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });
    });

    describe('Git リポジトリチェック', () => {
      test('should return not created when not in git repository', () => {
        mockExecFileSync.mockImplementation(() => {
          throw new Error('Not a git repository');
        });

        const result = createSpecBranch(validUuid);

        expect(result.created).toBe(false);
        expect(result.reason).toBe('Git リポジトリが初期化されていません。git init を実行してください。');
      });
    });

    describe('保護ブランチチェック', () => {
      beforeEach(() => {
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse
      });

      test('should create feature/spec-<id> branch from develop branch', () => {
        const expectedBranch = `feature/spec-${shortId}`;
        mockGetCurrentBranch.mockReturnValue('develop');
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe('develop');
        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git', ['branch', expectedBranch, 'develop'],
          expect.any(Object)
        );
      });

      test('should create feature/spec-<id> branch from main branch', () => {
        const expectedBranch = `feature/spec-${shortId}`;
        mockGetCurrentBranch.mockReturnValue('main');
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe('main');
        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git', ['branch', expectedBranch, 'develop'],
          expect.any(Object)
        );
      });

      test('should create feature/spec-<id>-<name> branch from develop with custom name', () => {
        const customName = 'auto-branch-creation';
        const expectedBranch = `feature/spec-${shortId}-${customName}`;
        mockGetCurrentBranch.mockReturnValue('develop');
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe('develop');
        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git', ['branch', expectedBranch, 'develop'],
          expect.any(Object)
        );
      });

      test('should create feature/spec-<id>-<name> branch from main with custom name', () => {
        const customName = 'improve-ux';
        const expectedBranch = `feature/spec-${shortId}-${customName}`;
        mockGetCurrentBranch.mockReturnValue('main');
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe('main');
        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git', ['branch', expectedBranch, 'develop'],
          expect.any(Object)
        );
      });

      test('should sanitize custom branch name in protected branch mode', () => {
        const customName = 'Improve@UX#Feature!';
        const expectedBranch = `feature/spec-${shortId}-improve-ux-feature`;
        mockGetCurrentBranch.mockReturnValue('develop');
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });
    });

    describe('通常ブランチからのブランチ作成', () => {
      beforeEach(() => {
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse
        mockGetCurrentBranch.mockReturnValue('feature/test');
      });

      test('should create spec/<id> branch from feature branch', () => {
        const expectedBranch = `spec/${shortId}`;
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe('feature/test');
        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git', ['branch', expectedBranch, 'develop'],
          expect.any(Object)
        );
      });

      test('should create spec/<id>-<name> branch from feature branch with custom name', () => {
        const customName = 'improve-perf';
        const expectedBranch = `spec/${shortId}-${customName}`;
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe('feature/test');
        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git', ['branch', expectedBranch, 'develop'],
          expect.any(Object)
        );
      });
    });

    describe('カスタムブランチ名なし(デフォルト)', () => {
      beforeEach(() => {
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse
        mockGetCurrentBranch.mockReturnValue('feature/test');
      });

      test('should create branch with default name format', () => {
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(`spec/${shortId}`);
        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git', ['branch', `spec/${shortId}`, 'develop'],
          expect.any(Object)
        );
      });
    });

    describe('カスタムブランチ名あり', () => {
      beforeEach(() => {
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse
        mockGetCurrentBranch.mockReturnValue('feature/test');
      });

      test('should create branch with custom name', () => {
        const customName = 'improve-branch-naming';
        const expectedBranch = `spec/${shortId}-${customName}`;

        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git', ['branch', expectedBranch, 'develop'],
          expect.any(Object)
        );
      });

      test('should sanitize custom branch name to lowercase', () => {
        const customName = 'Improve-Branch-Naming';
        const expectedBranch = `spec/${shortId}-improve-branch-naming`;

        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });

      test('should replace special characters with hyphens', () => {
        const customName = 'Improve@Branch#Naming!';
        const expectedBranch = `spec/${shortId}-improve-branch-naming`;

        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });

      test('should merge consecutive hyphens', () => {
        const customName = 'fix--bug';
        const expectedBranch = `spec/${shortId}-fix-bug`;

        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });

      test('should remove leading and trailing hyphens', () => {
        const customName = '-test-';
        const expectedBranch = `spec/${shortId}-test`;

        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });

      test('should keep alphanumeric characters, hyphens, and underscores', () => {
        const customName = 'test_123-branch';
        const expectedBranch = `spec/${shortId}-test_123-branch`;

        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });
    });

    describe('ブランチ作成検証', () => {
      beforeEach(() => {
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse
        mockGetCurrentBranch.mockReturnValue('feature/test');
      });

      test('should throw error if branch verification fails', () => {
        const expectedBranch = `spec/${shortId}`;
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockImplementation(() => {
          throw new Error('Branch does not exist');
        }); // git rev-parse --verify fails

        expect(() => createSpecBranch(validUuid)).toThrow(
          `ブランチ作成に失敗しました: ${expectedBranch}`
        );
      });
    });

    describe('ブランチ作成後の状態', () => {
      beforeEach(() => {
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse
        mockGetCurrentBranch.mockReturnValue('feature/test');
      });

      test('should stay on the original branch after branch creation', () => {
        const expectedBranch = `spec/${shortId}`;
        const originalBranch = 'feature/test';

        mockExecFileSync.mockReturnValueOnce(undefined as never); // git branch
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse --verify

        const result = createSpecBranch(validUuid);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe(originalBranch);

        // ブランチ切り替えコマンドが実行されていないことを確認
        expect(mockExecFileSync).not.toHaveBeenCalledWith(
          expect.stringContaining('git checkout'),
          expect.any(Object)
        );
      });
    });

    describe('エラーハンドリング', () => {
      beforeEach(() => {
        mockExecFileSync.mockReturnValueOnce(undefined as never); // git rev-parse
      });

      test('should throw error when getCurrentBranch fails', () => {
        mockGetCurrentBranch.mockImplementation(() => {
          throw new Error('Failed to get current branch');
        });

        expect(() => createSpecBranch(validUuid)).toThrow(
          '現在のブランチ名の取得に失敗しました: Failed to get current branch'
        );
      });

      test('should throw error when git branch fails', () => {
        const expectedBranch = `spec/${shortId}`;
        mockGetCurrentBranch.mockReturnValue('feature/test');
        mockExecFileSync.mockImplementation((cmd: string, args?: readonly string[]) => {
          if (cmd === 'git' && args?.[0] === 'rev-parse') {
            return undefined as never;
          }
          if (cmd === 'git' && args?.[0] === 'branch') {
            throw new Error('fatal: A branch named "spec/12345678" already exists.');
          }
          return undefined as never;
        });

        expect(() => createSpecBranch(validUuid)).toThrow(
          'ブランチ作成に失敗しました。既に同名のブランチが存在する可能性があります'
        );
      });

      test('should throw error when branch verification fails', () => {
        const expectedBranch = `spec/${shortId}`;
        mockGetCurrentBranch.mockReturnValue('feature/test');
        mockExecFileSync
          .mockReturnValueOnce(undefined as never) // git branch
          .mockImplementation(() => {
            throw new Error('Failed to verify branch');
          });

        expect(() => createSpecBranch(validUuid)).toThrow(
          `ブランチ作成に失敗しました: ${expectedBranch}`
        );
      });
    });

  });
});
