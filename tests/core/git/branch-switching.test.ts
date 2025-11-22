/**
 * ブランチ切り替え機能のテスト
 *
 * テスト対象: src/core/git/branch-switching.ts
 * テスト要件: .cc-craft-kit/specs/f12b0d21-7e2f-488b-9da0-201935b6f1ff.md (行 70-77)
 */

import { execSync } from 'node:child_process';
import {
  switchBranch,
  BranchSwitchError,
} from '../../../src/core/git/branch-switching.js';
import { getCurrentBranch, clearBranchCache } from '../../../src/core/git/branch-cache.js';
import { checkGitStatus } from '../../../src/core/workflow/git-integration.js';

// Git 操作のモック化（必須: テスト実行時にブランチが変更されることを防止）
jest.mock('node:child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('../../../src/core/git/branch-cache.js', () => ({
  getCurrentBranch: jest.fn(),
  clearBranchCache: jest.fn(),
}));

jest.mock('../../../src/core/workflow/git-integration.js', () => ({
  checkGitStatus: jest.fn(),
}));

describe('branch-switching', () => {
  const mockExecSync = jest.mocked(execSync);
  const mockGetCurrentBranch = jest.mocked(getCurrentBranch);
  const mockClearBranchCache = jest.mocked(clearBranchCache);
  const mockCheckGitStatus = jest.mocked(checkGitStatus);

  beforeEach(() => {
    jest.clearAllMocks();

    // デフォルトのモック設定
    mockGetCurrentBranch.mockReturnValue('feature/current');
    mockCheckGitStatus.mockReturnValue({
      hasChanges: false,
      stagedFiles: [],
      unstagedFiles: [],
      untrackedFiles: [],
    });
    mockExecSync.mockReturnValue(Buffer.from('success'));
  });

  describe('switchBranch()', () => {
    describe('正常系: ブランチ切り替え成功', () => {
      test('should switch to target branch successfully', () => {
        const targetBranch = 'feature/spec-12345678';

        // ブランチ存在確認 (git rev-parse --verify)
        mockExecSync.mockReturnValueOnce(Buffer.from(''));

        // ブランチ切り替え (git checkout)
        mockExecSync.mockReturnValueOnce(Buffer.from(''));

        // ブランチ切り替え検証 (git branch --show-current) - encoding: 'utf-8' なので文字列を返す
        mockExecSync.mockReturnValueOnce(targetBranch as never);

        const result = switchBranch(targetBranch);

        expect(result.switched).toBe(true);
        expect(result.currentBranch).toBe('feature/current');
        expect(result.targetBranch).toBe(targetBranch);
        expect(result.previousBranch).toBe('feature/current');

        // Git コマンド実行確認
        expect(mockExecSync).toHaveBeenCalledWith(
          `git rev-parse --verify ${targetBranch}`,
          { stdio: 'pipe' }
        );
        expect(mockExecSync).toHaveBeenCalledWith(`git checkout ${targetBranch}`, { stdio: 'pipe' });
        expect(mockExecSync).toHaveBeenCalledWith('git branch --show-current', { encoding: 'utf-8' });

        // ブランチキャッシュクリア確認
        expect(mockClearBranchCache).toHaveBeenCalled();
      });

      test('should switch to branch with slash in name', () => {
        const targetBranch = 'feature/spec-12345678-auto-switch';

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git checkout
        mockExecSync.mockReturnValueOnce(targetBranch as never); // git branch --show-current

        const result = switchBranch(targetBranch);

        expect(result.switched).toBe(true);
        expect(result.targetBranch).toBe(targetBranch);
      });

      test('should switch to branch with underscore in name', () => {
        const targetBranch = 'feature/spec_12345678';

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git checkout
        mockExecSync.mockReturnValueOnce(targetBranch as never); // git branch --show-current

        const result = switchBranch(targetBranch);

        expect(result.switched).toBe(true);
        expect(result.targetBranch).toBe(targetBranch);
      });
    });

    describe('正常系: 未コミット変更がある場合の自動コミット', () => {
      test('should auto-commit before switching when there are uncommitted changes', () => {
        const targetBranch = 'feature/spec-12345678';

        // 未コミット変更あり
        mockCheckGitStatus.mockReturnValue({
          hasChanges: true,
          stagedFiles: ['src/test.ts'],
          unstagedFiles: ['src/test2.ts'],
          untrackedFiles: [],
        });

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git add .
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git commit
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git checkout
        mockExecSync.mockReturnValueOnce(targetBranch as never); // git branch --show-current

        const result = switchBranch(targetBranch);

        expect(result.switched).toBe(true);

        // 自動コミット確認
        expect(mockExecSync).toHaveBeenCalledWith('git add .', { stdio: 'pipe' });
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('git commit -m'),
          { stdio: 'pipe' }
        );
      });

      test('should include correct commit message with Claude Code signature', () => {
        const targetBranch = 'feature/spec-12345678';

        mockCheckGitStatus.mockReturnValue({
          hasChanges: true,
          stagedFiles: ['src/test.ts'],
          unstagedFiles: [],
          untrackedFiles: [],
        });

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git add .
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git commit
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git checkout
        mockExecSync.mockReturnValueOnce(targetBranch as never); // git branch --show-current

        switchBranch(targetBranch);

        const commitCall = mockExecSync.mock.calls.find((call) =>
          (call[0] as string).includes('git commit -m')
        );

        expect(commitCall).toBeDefined();
        const commitMessage = commitCall![0] as string;
        expect(commitMessage).toContain(`chore: auto-commit before switching to branch ${targetBranch}`);
        expect(commitMessage).toContain('🤖 Generated with [Claude Code]');
        expect(commitMessage).toContain('Co-Authored-By: Claude <noreply@anthropic.com>');
      });
    });

    describe('スキップケース: 同じブランチへの切り替え', () => {
      test('should skip switching when already on target branch', () => {
        const targetBranch = 'feature/current';

        // ブランチ存在確認のみ実行
        mockExecSync.mockReturnValueOnce(Buffer.from(''));

        const result = switchBranch(targetBranch);

        expect(result.switched).toBe(false);
        expect(result.currentBranch).toBe('feature/current');
        expect(result.targetBranch).toBe(targetBranch);
        expect(result.reason).toBe('Already on target branch');

        // ブランチ切り替えが実行されていないことを確認
        expect(mockExecSync).not.toHaveBeenCalledWith(
          expect.stringContaining('git checkout'),
          expect.any(Object)
        );
        expect(mockClearBranchCache).not.toHaveBeenCalled();
      });
    });

    describe('エラーケース: ブランチ名のバリデーション', () => {
      test('should reject invalid branch name with special characters', () => {
        const invalidBranch = 'feature; rm -rf /';

        expect(() => switchBranch(invalidBranch)).toThrow(BranchSwitchError);
        expect(() => switchBranch(invalidBranch)).toThrow('無効なブランチ名');
      });

      test('should reject branch name with directory traversal', () => {
        const invalidBranch = 'feature/../main';

        expect(() => switchBranch(invalidBranch)).toThrow(BranchSwitchError);
        expect(() => switchBranch(invalidBranch)).toThrow('無効なブランチ名');
      });

      test('should reject branch name with spaces', () => {
        const invalidBranch = 'feature test';

        expect(() => switchBranch(invalidBranch)).toThrow(BranchSwitchError);
        expect(() => switchBranch(invalidBranch)).toThrow('無効なブランチ名');
      });

      test('should reject branch name with parentheses', () => {
        const invalidBranch = 'feature(test)';

        expect(() => switchBranch(invalidBranch)).toThrow(BranchSwitchError);
        expect(() => switchBranch(invalidBranch)).toThrow('無効なブランチ名');
      });

      test('should reject branch name with reserved word HEAD', () => {
        const invalidBranch = 'HEAD';

        expect(() => switchBranch(invalidBranch)).toThrow(BranchSwitchError);
        expect(() => switchBranch(invalidBranch)).toThrow('予約語を含むブランチ名は使用できません');
      });

      test('should reject branch name with reserved word refs/heads/', () => {
        const invalidBranch = 'refs/heads/feature';

        expect(() => switchBranch(invalidBranch)).toThrow(BranchSwitchError);
        expect(() => switchBranch(invalidBranch)).toThrow('予約語を含むブランチ名は使用できません');
      });

      test('should reject branch name with reserved word refs/tags/', () => {
        const invalidBranch = 'refs/tags/v1.0.0';

        // refs/tags は予約語だが、/ を含むため先にバリデーションで弾かれる
        expect(() => switchBranch(invalidBranch)).toThrow(BranchSwitchError);
      });
    });

    describe('エラーケース: 保護ブランチチェック', () => {
      test('should reject switching to main branch', () => {
        expect(() => switchBranch('main')).toThrow(BranchSwitchError);
        expect(() => switchBranch('main')).toThrow('保護ブランチ main への切り替えは禁止されています');
      });

      test('should reject switching to develop branch', () => {
        expect(() => switchBranch('develop')).toThrow(BranchSwitchError);
        expect(() => switchBranch('develop')).toThrow('保護ブランチ develop への切り替えは禁止されています');
      });

      test('should respect PROTECTED_BRANCHES environment variable', () => {
        process.env.PROTECTED_BRANCHES = 'main,develop,staging';

        expect(() => switchBranch('staging')).toThrow(BranchSwitchError);
        expect(() => switchBranch('staging')).toThrow('保護ブランチ staging への切り替えは禁止されています');

        delete process.env.PROTECTED_BRANCHES;
      });
    });

    describe('エラーケース: ブランチが存在しない', () => {
      test('should throw error when target branch does not exist', () => {
        const targetBranch = 'nonexistent-branch';

        // git rev-parse --verify が失敗
        mockExecSync.mockImplementationOnce(() => {
          throw new Error('fatal: Needed a single revision');
        });

        expect(() => switchBranch(targetBranch)).toThrow(
          new BranchSwitchError(`ブランチ ${targetBranch} が見つかりません`)
        );
      });
    });

    describe('エラーケース: 自動コミット失敗', () => {
      test('should throw error when git add fails', () => {
        const targetBranch = 'feature/spec-12345678';

        mockCheckGitStatus.mockReturnValue({
          hasChanges: true,
          stagedFiles: [],
          unstagedFiles: ['src/test.ts'],
          untrackedFiles: [],
        });

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockImplementationOnce(() => {
          // git add . が失敗
          throw new Error('fatal: pathspec did not match any files');
        });

        expect(() => switchBranch(targetBranch)).toThrow(/自動コミットに失敗しました.*手動でコミットしてください/s);
      });

      test('should throw error when git commit fails', () => {
        const targetBranch = 'feature/spec-12345678';

        mockCheckGitStatus.mockReturnValue({
          hasChanges: true,
          stagedFiles: ['src/test.ts'],
          unstagedFiles: [],
          untrackedFiles: [],
        });

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git add .
        mockExecSync.mockImplementationOnce(() => {
          // git commit が失敗
          throw new Error('fatal: unable to write new index file');
        });

        expect(() => switchBranch(targetBranch)).toThrow(/自動コミットに失敗しました.*手動でコミットしてください/s);
      });

      test('should include error message in auto-commit failure', () => {
        const targetBranch = 'feature/spec-12345678';
        const errorMessage = 'pre-commit hook failed';

        mockCheckGitStatus.mockReturnValue({
          hasChanges: true,
          stagedFiles: ['src/test.ts'],
          unstagedFiles: [],
          untrackedFiles: [],
        });

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git add .
        mockExecSync.mockImplementationOnce(() => {
          throw new Error(errorMessage);
        });

        expect(() => switchBranch(targetBranch)).toThrow(errorMessage);
      });
    });

    describe('エラーケース: ブランチ切り替え失敗', () => {
      test('should throw error when git checkout fails', () => {
        const targetBranch = 'feature/spec-12345678';

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockImplementationOnce(() => {
          // git checkout が失敗
          throw new Error('error: pathspec did not match any file(s) known to git');
        });

        expect(() => switchBranch(targetBranch)).toThrow(/ブランチ切り替えに失敗しました.*手動で切り替えてください/s);
      });

      test('should include error message in checkout failure', () => {
        const targetBranch = 'feature/spec-12345678';
        const errorMessage = 'fatal: reference is not a tree';

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockImplementationOnce(() => {
          throw new Error(errorMessage);
        });

        expect(() => switchBranch(targetBranch)).toThrow(errorMessage);
      });
    });

    describe('エラーケース: ブランチ切り替え検証失敗', () => {
      test('should throw error when verification fails (different branch)', () => {
        const targetBranch = 'feature/spec-12345678';
        const actualBranch = 'feature/wrong-branch';

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git checkout
        mockExecSync.mockReturnValueOnce(actualBranch as never); // git branch --show-current

        expect(() => switchBranch(targetBranch)).toThrow(
          new BranchSwitchError(
            `ブランチ切り替え後の検証に失敗しました。期待: ${targetBranch}, 実際: ${actualBranch}`
          )
        );
      });

      test('should throw error when verification command fails', () => {
        const targetBranch = 'feature/spec-12345678';

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git checkout
        mockExecSync.mockImplementationOnce(() => {
          // git branch --show-current が失敗
          throw new Error('fatal: not a git repository');
        });

        expect(() => switchBranch(targetBranch)).toThrow('fatal: not a git repository');
      });
    });
  });

  describe('エッジケース', () => {
    describe('ブランチ名のエッジケース', () => {
      test('should accept branch name with numbers', () => {
        const targetBranch = 'feature/12345678';

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git checkout
        mockExecSync.mockReturnValueOnce(targetBranch as never); // git branch --show-current

        const result = switchBranch(targetBranch);

        expect(result.switched).toBe(true);
      });

      test('should accept branch name with multiple slashes', () => {
        const targetBranch = 'feature/sub/spec-12345678';

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git checkout
        mockExecSync.mockReturnValueOnce(targetBranch as never); // git branch --show-current

        const result = switchBranch(targetBranch);

        expect(result.switched).toBe(true);
      });

      test('should accept branch name with hyphens and underscores', () => {
        const targetBranch = 'feature/spec_12345678-test';

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git checkout
        mockExecSync.mockReturnValueOnce(targetBranch as never); // git branch --show-current

        const result = switchBranch(targetBranch);

        expect(result.switched).toBe(true);
      });
    });

    describe('環境変数のエッジケース', () => {
      test('should handle empty PROTECTED_BRANCHES environment variable', () => {
        process.env.PROTECTED_BRANCHES = '';
        const targetBranch = 'feature/spec-12345678';

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git checkout
        mockExecSync.mockReturnValueOnce(targetBranch as never); // git branch --show-current

        const result = switchBranch(targetBranch);

        expect(result.switched).toBe(true);

        delete process.env.PROTECTED_BRANCHES;
      });

      test('should handle whitespace in PROTECTED_BRANCHES environment variable', () => {
        process.env.PROTECTED_BRANCHES = 'main, develop, staging';

        expect(() => switchBranch('staging')).toThrow(BranchSwitchError);
        expect(() => switchBranch('staging')).toThrow('保護ブランチ staging への切り替えは禁止されています');

        delete process.env.PROTECTED_BRANCHES;
      });
    });

    describe('Git ステータスのエッジケース', () => {
      test('should handle checkGitStatus returning all empty arrays', () => {
        const targetBranch = 'feature/spec-12345678';

        mockCheckGitStatus.mockReturnValue({
          hasChanges: false,
          stagedFiles: [],
          unstagedFiles: [],
          untrackedFiles: [],
        });

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git checkout
        mockExecSync.mockReturnValueOnce(targetBranch as never); // git branch --show-current

        const result = switchBranch(targetBranch);

        expect(result.switched).toBe(true);

        // 自動コミットが実行されていないことを確認
        expect(mockExecSync).not.toHaveBeenCalledWith('git add .', expect.any(Object));
      });

      test('should handle checkGitStatus with only staged files', () => {
        const targetBranch = 'feature/spec-12345678';

        mockCheckGitStatus.mockReturnValue({
          hasChanges: true,
          stagedFiles: ['src/test.ts'],
          unstagedFiles: [],
          untrackedFiles: [],
        });

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git add .
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git commit
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git checkout
        mockExecSync.mockReturnValueOnce(targetBranch as never); // git branch --show-current

        const result = switchBranch(targetBranch);

        expect(result.switched).toBe(true);
        expect(mockExecSync).toHaveBeenCalledWith('git add .', { stdio: 'pipe' });
      });

      test('should handle checkGitStatus with only untracked files', () => {
        const targetBranch = 'feature/spec-12345678';

        mockCheckGitStatus.mockReturnValue({
          hasChanges: true,
          stagedFiles: [],
          unstagedFiles: [],
          untrackedFiles: ['src/new-file.ts'],
        });

        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git rev-parse
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git add .
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git commit
        mockExecSync.mockReturnValueOnce(Buffer.from('')); // git checkout
        mockExecSync.mockReturnValueOnce(targetBranch as never); // git branch --show-current

        const result = switchBranch(targetBranch);

        expect(result.switched).toBe(true);
        expect(mockExecSync).toHaveBeenCalledWith('git add .', { stdio: 'pipe' });
      });
    });
  });
});
