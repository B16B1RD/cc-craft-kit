/**
 * Git統合のテスト
 *
 * TDD実践: git-integration.ts のカバレッジを 0% → 80% に向上させる
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { execSync, spawnSync, SpawnSyncReturns } from 'node:child_process';
import { checkGitStatus, hasUncommittedChanges, getCommitTargets } from '../../../src/core/workflow/git-integration.js';

// node:child_process モジュールをモック化
jest.mock('node:child_process');
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

describe('Git Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkGitStatus', () => {
    describe('正常系: 未コミット変更がある場合', () => {
      it('ステージング済み、未ステージング、未追跡ファイルを正しく検出する', () => {
        // Arrange - Git リポジトリが初期化されている
        mockExecSync.mockReturnValue(Buffer.from('.git'));

        // git status --porcelain の結果をモック
        mockSpawnSync.mockReturnValue({
          status: 0,
          stdout: 'M  src/file1.ts\n M src/file2.ts\n?? src/file3.ts\n',
          stderr: '',
          pid: 12345,
          output: [null, Buffer.from('M  src/file1.ts\n M src/file2.ts\n?? src/file3.ts\n'), Buffer.from('')],
          signal: null,
        } as SpawnSyncReturns<Buffer>);

        // Act
        const result = checkGitStatus();

        // Assert
        expect(result.hasChanges).toBe(true);
        expect(result.stagedFiles).toEqual(['src/file1.ts']);
        expect(result.unstagedFiles).toEqual(['src/file2.ts']);
        expect(result.untrackedFiles).toEqual(['src/file3.ts']);
      });

      it('ステージング済みファイルのみがある場合、正しく分類する', () => {
        // Arrange
        mockExecSync.mockReturnValue(Buffer.from('.git'));
        mockSpawnSync.mockReturnValue({
          status: 0,
          stdout: 'M  src/file1.ts\nA  src/file2.ts\n',
          stderr: '',
          pid: 12345,
          output: [null, Buffer.from('M  src/file1.ts\nA  src/file2.ts\n'), Buffer.from('')],
          signal: null,
        } as SpawnSyncReturns<Buffer>);

        // Act
        const result = checkGitStatus();

        // Assert
        expect(result.hasChanges).toBe(true);
        expect(result.stagedFiles).toEqual(['src/file1.ts', 'src/file2.ts']);
        expect(result.unstagedFiles).toEqual([]);
        expect(result.untrackedFiles).toEqual([]);
      });

      it('未追跡ファイルのみがある場合、正しく検出する', () => {
        // Arrange
        mockExecSync.mockReturnValue(Buffer.from('.git'));
        mockSpawnSync.mockReturnValue({
          status: 0,
          stdout: '?? newfile.ts\n',
          stderr: '',
          pid: 12345,
          output: [null, Buffer.from('?? newfile.ts\n'), Buffer.from('')],
          signal: null,
        } as SpawnSyncReturns<Buffer>);

        // Act
        const result = checkGitStatus();

        // Assert
        expect(result.hasChanges).toBe(true);
        expect(result.stagedFiles).toEqual([]);
        expect(result.unstagedFiles).toEqual([]);
        expect(result.untrackedFiles).toEqual(['newfile.ts']);
      });

      it('混在した変更がある場合、正しく分類する', () => {
        // Arrange
        mockExecSync.mockReturnValue(Buffer.from('.git'));
        mockSpawnSync.mockReturnValue({
          status: 0,
          stdout: 'MM src/file1.ts\nA  src/file2.ts\n M src/file3.ts\n?? src/file4.ts\n',
          stderr: '',
          pid: 12345,
          output: [null, Buffer.from('MM src/file1.ts\nA  src/file2.ts\n M src/file3.ts\n?? src/file4.ts\n'), Buffer.from('')],
          signal: null,
        } as SpawnSyncReturns<Buffer>);

        // Act
        const result = checkGitStatus();

        // Assert
        expect(result.hasChanges).toBe(true);
        expect(result.stagedFiles).toEqual(['src/file1.ts', 'src/file2.ts']);
        expect(result.unstagedFiles).toEqual(['src/file1.ts', 'src/file3.ts']);
        expect(result.untrackedFiles).toEqual(['src/file4.ts']);
      });
    });

    describe('正常系: 未コミット変更がない場合', () => {
      it('hasChanges が false になる', () => {
        // Arrange - Git リポジトリが初期化されている
        mockExecSync.mockReturnValue(Buffer.from('.git'));

        // git status --porcelain の結果をモック（空）
        mockSpawnSync.mockReturnValue({
          status: 0,
          stdout: '',
          stderr: '',
          pid: 12345,
          output: [null, Buffer.from(''), Buffer.from('')],
          signal: null,
        } as SpawnSyncReturns<Buffer>);

        // Act
        const result = checkGitStatus();

        // Assert
        expect(result.hasChanges).toBe(false);
        expect(result.stagedFiles).toEqual([]);
        expect(result.unstagedFiles).toEqual([]);
        expect(result.untrackedFiles).toEqual([]);
      });
    });

    describe('異常系: Git リポジトリが初期化されていない場合', () => {
      it('空のステータスを返す', () => {
        // Arrange - git rev-parse --git-dir が失敗する（Git 未初期化）
        mockExecSync.mockImplementation(() => {
          throw new Error('fatal: not a git repository');
        });

        // Act
        const result = checkGitStatus();

        // Assert
        expect(result.hasChanges).toBe(false);
        expect(result.stagedFiles).toEqual([]);
        expect(result.unstagedFiles).toEqual([]);
        expect(result.untrackedFiles).toEqual([]);
      });
    });

    describe('異常系: git status コマンド実行エラー', () => {
      it('git status が失敗した場合、エラーをスローする', () => {
        // Arrange - Git リポジトリは初期化されているが、git status が失敗
        mockExecSync.mockReturnValue(Buffer.from('.git'));
        mockSpawnSync.mockReturnValue({
          status: 128,
          stdout: '',
          stderr: 'fatal: git status failed',
          pid: 12345,
          output: [null, Buffer.from(''), Buffer.from('fatal: git status failed')],
          signal: null,
        } as SpawnSyncReturns<Buffer>);

        // Act & Assert
        expect(() => checkGitStatus()).toThrow('Failed to check git status: git status failed: fatal: git status failed');
      });

      it('spawnSync が例外をスローした場合、エラーメッセージを含むエラーをスローする', () => {
        // Arrange - Git リポジトリは初期化されているが、spawnSync が例外をスロー
        mockExecSync.mockReturnValue(Buffer.from('.git'));
        mockSpawnSync.mockImplementation(() => {
          throw new Error('spawn error');
        });

        // Act & Assert
        expect(() => checkGitStatus()).toThrow('Failed to check git status: spawn error');
      });
    });
  });

  describe('hasUncommittedChanges', () => {
    describe('正常系: 未コミット変更がある場合', () => {
      it('true を返す', () => {
        // Arrange
        mockExecSync.mockReturnValue(Buffer.from('.git'));
        mockSpawnSync.mockReturnValue({
          status: 0,
          stdout: 'M  src/file1.ts\n',
          stderr: '',
          pid: 12345,
          output: [null, Buffer.from('M  src/file1.ts\n'), Buffer.from('')],
          signal: null,
        } as SpawnSyncReturns<Buffer>);

        // Act
        const result = hasUncommittedChanges();

        // Assert
        expect(result).toBe(true);
      });

      it('ステージング済みファイルがある場合、true を返す', () => {
        // Arrange
        mockExecSync.mockReturnValue(Buffer.from('.git'));
        mockSpawnSync.mockReturnValue({
          status: 0,
          stdout: 'M  file1.ts\nA  file2.ts\n',
          stderr: '',
          pid: 12345,
          output: [null, Buffer.from('M  file1.ts\nA  file2.ts\n'), Buffer.from('')],
          signal: null,
        } as SpawnSyncReturns<Buffer>);

        // Act
        const result = hasUncommittedChanges();

        // Assert
        expect(result).toBe(true);
      });

      it('未追跡ファイルがある場合、true を返す', () => {
        // Arrange
        mockExecSync.mockReturnValue(Buffer.from('.git'));
        mockSpawnSync.mockReturnValue({
          status: 0,
          stdout: '?? newfile.ts\n',
          stderr: '',
          pid: 12345,
          output: [null, Buffer.from('?? newfile.ts\n'), Buffer.from('')],
          signal: null,
        } as SpawnSyncReturns<Buffer>);

        // Act
        const result = hasUncommittedChanges();

        // Assert
        expect(result).toBe(true);
      });
    });

    describe('正常系: 未コミット変更がない場合', () => {
      it('false を返す', () => {
        // Arrange
        mockExecSync.mockReturnValue(Buffer.from('.git'));
        mockSpawnSync.mockReturnValue({
          status: 0,
          stdout: '',
          stderr: '',
          pid: 12345,
          output: [null, Buffer.from(''), Buffer.from('')],
          signal: null,
        } as SpawnSyncReturns<Buffer>);

        // Act
        const result = hasUncommittedChanges();

        // Assert
        expect(result).toBe(false);
      });
    });

    describe('異常系: Git コマンド実行エラー時', () => {
      it('Git リポジトリが初期化されていない場合、false を返す', () => {
        // Arrange
        mockExecSync.mockImplementation(() => {
          throw new Error('Not a git repository');
        });

        // Act
        const result = hasUncommittedChanges();

        // Assert
        expect(result).toBe(false);
      });

      it('checkGitStatus が例外をスローした場合、false を返す', () => {
        // Arrange - checkGitStatus が例外をスロー
        mockExecSync.mockReturnValue(Buffer.from('.git'));
        mockSpawnSync.mockReturnValue({
          status: 128,
          stdout: '',
          stderr: 'fatal: git error',
          pid: 12345,
          output: [null, Buffer.from(''), Buffer.from('fatal: git error')],
          signal: null,
        } as SpawnSyncReturns<Buffer>);

        // Act
        const result = hasUncommittedChanges();

        // Assert: エラーが発生しても false を返す（例外を握りつぶす）
        expect(result).toBe(false);
      });

      it('spawnSync が例外をスローした場合、false を返す', () => {
        // Arrange
        mockExecSync.mockReturnValue(Buffer.from('.git'));
        mockSpawnSync.mockImplementation(() => {
          throw new Error('Git command failed');
        });

        // Act
        const result = hasUncommittedChanges();

        // Assert: エラーが発生しても false を返す
        expect(result).toBe(false);
      });
    });
  });

  describe('getCommitTargets', () => {
    describe('正常系: 有効な spec-id の場合', () => {
      it('全変更ファイルを返す', () => {
        // Arrange
        const specId = '8c798516-e1bf-43b1-9e70-3eb6ce54631b';

        // Act
        const result = getCommitTargets(specId);

        // Assert
        expect(result).toEqual(['.']);
      });

      it('UUID が大文字でも正しく処理する', () => {
        // Arrange
        const specId = '8C798516-E1BF-43B1-9E70-3EB6CE54631B';

        // Act
        const result = getCommitTargets(specId);

        // Assert
        expect(result).toEqual(['.']);
      });

      it('UUID が混在大文字小文字でも正しく処理する', () => {
        // Arrange
        const specId = '8c798516-E1bF-43B1-9e70-3Eb6Ce54631B';

        // Act
        const result = getCommitTargets(specId);

        // Assert
        expect(result).toEqual(['.']);
      });
    });

    describe('異常系: 無効な spec-id の場合', () => {
      it('UUID 形式でない場合、エラーをスローする', () => {
        // Arrange
        const invalidSpecId = 'invalid-id';

        // Act & Assert
        expect(() => getCommitTargets(invalidSpecId)).toThrow('Invalid spec ID format: invalid-id');
      });

      it('短い UUID の場合、エラーをスローする', () => {
        // Arrange
        const shortSpecId = '8c798516';

        // Act & Assert
        expect(() => getCommitTargets(shortSpecId)).toThrow(`Invalid spec ID format: ${shortSpecId}`);
      });

      it('空文字列の場合、エラーをスローする', () => {
        // Arrange
        const emptySpecId = '';

        // Act & Assert
        expect(() => getCommitTargets(emptySpecId)).toThrow('Invalid spec ID format: ');
      });

      it('ハイフンが不正な位置にある場合、エラーをスローする', () => {
        // Arrange
        const malformedSpecId = '8c798516-e1bf43b1-9e70-3eb6ce54631b';

        // Act & Assert
        expect(() => getCommitTargets(malformedSpecId)).toThrow(`Invalid spec ID format: ${malformedSpecId}`);
      });
    });
  });
});
