/**
 * ブランチ作成機能のテスト
 */

import { execSync } from 'node:child_process';
import { createSpecBranch } from '../../../src/core/git/branch-creation.js';
import { getCurrentBranch, clearBranchCache } from '../../../src/core/git/branch-cache.js';

// execSync と getCurrentBranch をモック化
jest.mock('node:child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('../../../src/core/git/branch-cache.js', () => ({
  getCurrentBranch: jest.fn(),
  clearBranchCache: jest.fn(),
}));

describe('branch-creation', () => {
  const mockExecSync = jest.mocked(execSync);
  const mockGetCurrentBranch = jest.mocked(getCurrentBranch);

  beforeEach(() => {
    jest.clearAllMocks();
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
        mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse
        mockGetCurrentBranch.mockReturnValue('main');
        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse --abbrev-ref HEAD

        const result = createSpecBranch(validUuid);

        expect(result).toBeDefined();
        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });
    });

    describe('Git リポジトリチェック', () => {
      test('should return not created when not in git repository', () => {
        mockExecSync.mockImplementation(() => {
          throw new Error('Not a git repository');
        });

        const result = createSpecBranch(validUuid);

        expect(result.created).toBe(false);
        expect(result.reason).toBe('Git リポジトリが初期化されていません。git init を実行してください。');
      });
    });

    describe('保護ブランチチェック', () => {
      beforeEach(() => {
        mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse
      });

      test('should create feature/spec-<id> branch from develop branch', () => {
        const expectedBranch = `feature/spec-${shortId}`;
        mockGetCurrentBranch.mockReturnValue('develop');
        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse --abbrev-ref HEAD

        const result = createSpecBranch(validUuid);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe('develop');
        expect(mockExecSync).toHaveBeenCalledWith(
          `git checkout -b ${expectedBranch}`,
          expect.any(Object)
        );
      });

      test('should create feature/spec-<id> branch from main branch', () => {
        const expectedBranch = `feature/spec-${shortId}`;
        mockGetCurrentBranch.mockReturnValue('main');
        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse --abbrev-ref HEAD

        const result = createSpecBranch(validUuid);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe('main');
        expect(mockExecSync).toHaveBeenCalledWith(
          `git checkout -b ${expectedBranch}`,
          expect.any(Object)
        );
      });

      test('should create feature/spec-<id>-<name> branch from develop with custom name', () => {
        const customName = 'auto-branch-creation';
        const expectedBranch = `feature/spec-${shortId}-${customName}`;
        mockGetCurrentBranch.mockReturnValue('develop');
        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe('develop');
        expect(mockExecSync).toHaveBeenCalledWith(
          `git checkout -b ${expectedBranch}`,
          expect.any(Object)
        );
      });

      test('should create feature/spec-<id>-<name> branch from main with custom name', () => {
        const customName = 'improve-ux';
        const expectedBranch = `feature/spec-${shortId}-${customName}`;
        mockGetCurrentBranch.mockReturnValue('main');
        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe('main');
        expect(mockExecSync).toHaveBeenCalledWith(
          `git checkout -b ${expectedBranch}`,
          expect.any(Object)
        );
      });

      test('should sanitize custom branch name in protected branch mode', () => {
        const customName = 'Improve@UX#Feature!';
        const expectedBranch = `feature/spec-${shortId}-improve-ux-feature`;
        mockGetCurrentBranch.mockReturnValue('develop');
        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });
    });

    describe('通常ブランチからのブランチ作成', () => {
      beforeEach(() => {
        mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse
        mockGetCurrentBranch.mockReturnValue('feature/test');
      });

      test('should create spec/<id> branch from feature branch', () => {
        const expectedBranch = `spec/${shortId}`;
        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse

        const result = createSpecBranch(validUuid);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe('feature/test');
        expect(mockExecSync).toHaveBeenCalledWith(
          `git checkout -b ${expectedBranch}`,
          expect.any(Object)
        );
      });

      test('should create spec/<id>-<name> branch from feature branch with custom name', () => {
        const customName = 'improve-perf';
        const expectedBranch = `spec/${shortId}-${customName}`;
        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe('feature/test');
        expect(mockExecSync).toHaveBeenCalledWith(
          `git checkout -b ${expectedBranch}`,
          expect.any(Object)
        );
      });
    });

    describe('カスタムブランチ名なし(デフォルト)', () => {
      beforeEach(() => {
        mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse
        mockGetCurrentBranch.mockReturnValue('feature/test');
      });

      test('should create branch with default name format', () => {
        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(`spec/${shortId}` as never); // git rev-parse

        const result = createSpecBranch(validUuid);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(`spec/${shortId}`);
        expect(mockExecSync).toHaveBeenCalledWith(
          `git checkout -b spec/${shortId}`,
          expect.any(Object)
        );
      });
    });

    describe('カスタムブランチ名あり', () => {
      beforeEach(() => {
        mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse
        mockGetCurrentBranch.mockReturnValue('feature/test');
      });

      test('should create branch with custom name', () => {
        const customName = 'improve-branch-naming';
        const expectedBranch = `spec/${shortId}-${customName}`;

        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(mockExecSync).toHaveBeenCalledWith(
          `git checkout -b ${expectedBranch}`,
          expect.any(Object)
        );
      });

      test('should sanitize custom branch name to lowercase', () => {
        const customName = 'Improve-Branch-Naming';
        const expectedBranch = `spec/${shortId}-improve-branch-naming`;

        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });

      test('should replace special characters with hyphens', () => {
        const customName = 'Improve@Branch#Naming!';
        const expectedBranch = `spec/${shortId}-improve-branch-naming`;

        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });

      test('should merge consecutive hyphens', () => {
        const customName = 'fix--bug';
        const expectedBranch = `spec/${shortId}-fix-bug`;

        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });

      test('should remove leading and trailing hyphens', () => {
        const customName = '-test-';
        const expectedBranch = `spec/${shortId}-test`;

        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });

      test('should keep alphanumeric characters, hyphens, and underscores', () => {
        const customName = 'test_123-branch';
        const expectedBranch = `spec/${shortId}-test_123-branch`;

        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse

        const result = createSpecBranch(validUuid, customName);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
      });
    });

    describe('ブランチ作成検証', () => {
      beforeEach(() => {
        mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse
        mockGetCurrentBranch.mockReturnValue('feature/test');
      });

      test('should throw error if created branch name does not match expected', () => {
        const expectedBranch = `spec/${shortId}`;
        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce('wrong-branch' as never); // git rev-parse

        expect(() => createSpecBranch(validUuid)).toThrow(
          `ブランチ作成に失敗しました。期待: ${expectedBranch}, 実際: wrong-branch`
        );
      });
    });

    describe('ブランチ作成後の状態', () => {
      beforeEach(() => {
        mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse
        mockGetCurrentBranch.mockReturnValue('feature/test');
      });

      test('should stay on the newly created branch', () => {
        const expectedBranch = `spec/${shortId}`;
        const originalBranch = 'feature/test';

        mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
        mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse --abbrev-ref HEAD

        const result = createSpecBranch(validUuid);

        expect(result.created).toBe(true);
        expect(result.branchName).toBe(expectedBranch);
        expect(result.originalBranch).toBe(originalBranch);

        // 元のブランチに戻るコマンドが実行されていないことを確認
        expect(mockExecSync).not.toHaveBeenCalledWith(
          `git checkout ${originalBranch}`,
          expect.any(Object)
        );
      });
    });

    describe('エラーハンドリング', () => {
      beforeEach(() => {
        mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse
      });

      test('should throw error when getCurrentBranch fails', () => {
        mockGetCurrentBranch.mockImplementation(() => {
          throw new Error('Failed to get current branch');
        });

        expect(() => createSpecBranch(validUuid)).toThrow(
          '現在のブランチ名の取得に失敗しました: Failed to get current branch'
        );
      });

      test('should throw error when git checkout fails', () => {
        const expectedBranch = `spec/${shortId}`;
        mockGetCurrentBranch.mockReturnValue('feature/test');
        mockExecSync.mockImplementation((cmd: string) => {
          if (cmd === 'git rev-parse --is-inside-work-tree') {
            return undefined as never;
          }
          if (cmd.startsWith('git checkout -b')) {
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
        mockExecSync
          .mockReturnValueOnce(undefined as never) // git checkout -b
          .mockImplementation(() => {
            throw new Error('Failed to verify branch');
          });

        expect(() => createSpecBranch(validUuid)).toThrow(
          'ブランチ作成の検証に失敗しました: Failed to verify branch'
        );
      });
    });
  });
});
