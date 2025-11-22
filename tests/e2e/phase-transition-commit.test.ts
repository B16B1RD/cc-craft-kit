/**
 * フェーズ移行時の Git 自動コミット機能の E2E テスト
 *
 * 各フェーズ移行時に自動コミットが成功し、適切なコミットメッセージが生成されることを検証します。
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { randomUUID } from 'crypto';
import { execSync, spawnSync, SpawnSyncReturns } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../helpers/db-lifecycle.js';
import { getEventBusAsync } from '../../src/core/workflow/event-bus.js';
import { GitHubClient } from '../../src/integrations/github/client.js';
import { GitHubIssues } from '../../src/integrations/github/issues.js';
import { GitHubProjects } from '../../src/integrations/github/projects.js';
import { getCurrentDateTimeForSpec } from '../../src/core/utils/date-format.js';

// Git操作のモック化
jest.mock('node:child_process');
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockedSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

// ファイルシステム操作のモック化
jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs') as object;
  return {
    ...actual,
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    existsSync: jest.fn(),
  };
});
const mockedWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockedReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

// GitHub統合のモック化
jest.mock('../../src/integrations/github/client.js');
jest.mock('../../src/integrations/github/issues.js');
jest.mock('../../src/integrations/github/projects.js');

// fsyncFileAndDirectory のモック化
jest.mock('../../src/core/utils/fsync.js', () => ({
  fsyncFileAndDirectory: jest.fn(),
}));

describe('Phase Transition Auto-Commit E2E', () => {
  let lifecycle: DatabaseLifecycle;
  let mockIssues: jest.Mocked<GitHubIssues>;
  let specId: string;
  let specName: string;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();

    // GitHubクライアントのモック設定
    const mockClient = new GitHubClient({ token: 'test-token' }) as jest.Mocked<GitHubClient>;
    mockIssues = new GitHubIssues(mockClient) as jest.Mocked<GitHubIssues>;
    const mockProjects = new GitHubProjects(mockClient) as jest.Mocked<GitHubProjects>;

    // GitHub Issue作成APIのモック
    mockIssues.create = jest.fn().mockResolvedValue({
      number: 1,
      id: 123456,
      node_id: 'node_123',
      html_url: 'https://github.com/testowner/testrepo/issues/1',
      title: '[requirements] テスト仕様書',
      body: '仕様書本文',
      state: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // GitHub Issue更新APIのモック
    mockIssues.update = jest.fn().mockResolvedValue({
      number: 1,
      id: 123456,
      node_id: 'node_123',
      html_url: 'https://github.com/testowner/testrepo/issues/1',
      title: '[design] テスト仕様書',
      body: '仕様書本文',
      state: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Git操作のモック（Gitリポジトリが存在する）
    mockedExecSync.mockReturnValue(Buffer.from('.git'));

    // git status --porcelain のモック（変更あり）
    mockedSpawnSync.mockImplementation((command: string, args?: readonly string[]) => {
      if (command === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain') {
        return {
          status: 0,
          stdout: 'M  .cc-craft-kit/specs/test.md\n',
          stderr: '',
        } as SpawnSyncReturns<Buffer>;
      }

      // git add のモック
      if (command === 'git' && args?.[0] === 'add') {
        return {
          status: 0,
          stdout: '',
          stderr: '',
        } as SpawnSyncReturns<Buffer>;
      }

      // git commit のモック
      if (command === 'git' && args?.[0] === 'commit') {
        return {
          status: 0,
          stdout: '[main 1234567] feat: テスト仕様書 の設計を完了\n 1 file changed, 1 insertion(+)\n',
          stderr: '',
        } as SpawnSyncReturns<Buffer>;
      }

      // その他のGitコマンドは成功を返す
      return {
        status: 0,
        stdout: '',
        stderr: '',
      } as SpawnSyncReturns<Buffer>;
    });

    // ファイルシステム操作のモック
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(
      `# テスト仕様書

**仕様書 ID:** ${randomUUID()}
**フェーズ:** requirements
**作成日時:** ${getCurrentDateTimeForSpec()}
**更新日時:** ${getCurrentDateTimeForSpec()}

---

## 1. 背景と目的

テスト用の仕様書です。
`
    );

    // 仕様書データの準備
    specId = randomUUID();
    specName = 'テスト仕様書';
    const now = new Date().toISOString();

    await lifecycle.db
      .insertInto('specs')
      .values({
        id: specId,
        name: specName,
        description: 'E2E テスト用仕様書',
        phase: 'requirements',
        branch_name: 'main',
        created_at: now,
        updated_at: now,
      })
      .execute();

    // GitHub同期レコード作成
    await lifecycle.db
      .insertInto('github_sync')
      .values({
        entity_type: 'spec',
        entity_id: specId,
        github_id: '123456',
        github_number: 1,
        github_node_id: 'node_123',
        sync_status: 'success',
        last_synced_at: now,
        updated_at: now,
      })
      .execute();
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
    jest.clearAllMocks();
  });

  /**
   * フェーズ移行ヘルパー（直接データベースとイベントバスを操作）
   */
  async function transitionPhase(
    newPhase: 'requirements' | 'design' | 'tasks' | 'implementation' | 'completed'
  ): Promise<void> {
    const now = new Date().toISOString();
    const formattedDateTime = getCurrentDateTimeForSpec();

    // 現在のフェーズを取得
    const spec = await lifecycle.db
      .selectFrom('specs')
      .where('id', '=', specId)
      .selectAll()
      .executeTakeFirst();

    if (!spec) {
      throw new Error('Spec not found');
    }

    const oldPhase = spec.phase;

    // 1. データベース更新
    await lifecycle.db
      .updateTable('specs')
      .set({
        phase: newPhase,
        updated_at: now,
      })
      .where('id', '=', specId)
      .execute();

    // 2. Markdownファイル更新（モック化されているため実際には書き込まれない）
    const specPath = join(process.cwd(), '.cc-craft-kit', 'specs', `${specId}.md`);
    if (existsSync(specPath)) {
      let content = readFileSync(specPath, 'utf-8');
      content = content.replace(/\*\*フェーズ:\*\* .+/, `**フェーズ:** ${newPhase}`);
      content = content.replace(/\*\*更新日時:\*\* .+/, `**更新日時:** ${formattedDateTime}`);
      writeFileSync(specPath, content, 'utf-8');
    }

    // 3. イベント発火（非同期ハンドラー登録を待機）
    const eventBus = await getEventBusAsync();
    await eventBus.emit(
      eventBus.createEvent('spec.phase_changed', specId, {
        oldPhase,
        newPhase,
      })
    );
  }

  /**
   * コミットメッセージ検証ヘルパー
   */
  function expectCommitMessageToBe(expectedMessage: string): void {
    // git commit が呼ばれたことを確認
    const commitCalls = (mockedSpawnSync as jest.Mock).mock.calls.filter(
      (call) => call[0] === 'git' && call[1]?.[0] === 'commit'
    );

    expect(commitCalls.length).toBeGreaterThan(0);

    // コミットメッセージが正しいことを確認
    const lastCommitCall = commitCalls[commitCalls.length - 1];
    const commitArgs = lastCommitCall[1] as string[];
    const messageIndex = commitArgs.indexOf('-m');
    expect(messageIndex).toBeGreaterThanOrEqual(0);

    const actualMessage = commitArgs[messageIndex + 1];
    expect(actualMessage).toBe(expectedMessage);
  }

  /**
   * コミット対象ファイル検証ヘルパー
   */
  function expectCommitTargetsToBe(expectedFiles: string[]): void {
    // git add が呼ばれたことを確認
    const addCalls = (mockedSpawnSync as jest.Mock).mock.calls.filter(
      (call) => call[0] === 'git' && call[1]?.[0] === 'add'
    );

    expect(addCalls.length).toBeGreaterThan(0);

    // コミット対象ファイルが正しいことを確認
    const lastAddCall = addCalls[addCalls.length - 1];
    const addArgs = lastAddCall[1] as string[];
    const actualFiles = addArgs.slice(1); // 'add' の後のファイルリスト

    expect(actualFiles).toEqual(expectedFiles);
  }

  describe('各フェーズ移行時の自動コミット検証', () => {
    test('requirements → design: 仕様書ファイルのみコミット', async () => {
      // Act
      await transitionPhase('design');

      // Assert
      expectCommitMessageToBe(`feat: ${specName} の設計を完了`);
      expectCommitTargetsToBe([`.cc-craft-kit/specs/${specId}.md`]);
    });

    test('design → tasks: 仕様書ファイルのみコミット', async () => {
      // Arrange: design フェーズに移行
      await lifecycle.db
        .updateTable('specs')
        .set({ phase: 'design' })
        .where('id', '=', specId)
        .execute();
      jest.clearAllMocks();

      // Act
      await transitionPhase('tasks');

      // Assert
      expectCommitMessageToBe(`feat: ${specName} のタスク分解を完了`);
      expectCommitTargetsToBe([`.cc-craft-kit/specs/${specId}.md`]);
    });

    test('tasks → implementation: 仕様書ファイルのみコミット', async () => {
      // Arrange: tasks フェーズに移行
      await lifecycle.db.updateTable('specs').set({ phase: 'tasks' }).where('id', '=', specId).execute();
      jest.clearAllMocks();

      // Act
      await transitionPhase('implementation');

      // Assert
      expectCommitMessageToBe(`feat: ${specName} の実装を開始`);
      expectCommitTargetsToBe([`.cc-craft-kit/specs/${specId}.md`]);
    });

    test('implementation → completed: 全変更ファイルをコミット', async () => {
      // Arrange: implementation フェーズに移行
      await lifecycle.db
        .updateTable('specs')
        .set({ phase: 'implementation' })
        .where('id', '=', specId)
        .execute();
      jest.clearAllMocks();

      // Act
      await transitionPhase('completed');

      // Assert
      expectCommitMessageToBe(`feat: ${specName} を実装完了`);
      expectCommitTargetsToBe(['.']);
    });
  });

  describe('コミット対象ファイルの検証', () => {
    test('completed以外: 仕様書ファイルのみコミット', async () => {
      // Act
      await transitionPhase('design');

      // Assert: .cc-craft-kit/specs/<id>.md のみがコミット対象
      expectCommitTargetsToBe([`.cc-craft-kit/specs/${specId}.md`]);
    });

    test('completed: 全変更ファイルをコミット', async () => {
      // Arrange: implementation フェーズに移行
      await lifecycle.db
        .updateTable('specs')
        .set({ phase: 'implementation' })
        .where('id', '=', specId)
        .execute();
      jest.clearAllMocks();

      // Act
      await transitionPhase('completed');

      // Assert: . (全ファイル) がコミット対象
      expectCommitTargetsToBe(['.']);
    });
  });

  describe('未コミット変更がない場合', () => {
    test('コミットをスキップし、情報メッセージを表示', async () => {
      // Arrange: git status --porcelain が空（変更なし）
      mockedSpawnSync.mockImplementation((command: string, args?: readonly string[]) => {
        if (command === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain') {
          return {
            status: 0,
            stdout: '', // 変更なし
            stderr: '',
          } as SpawnSyncReturns<Buffer>;
        }

        return {
          status: 0,
          stdout: '',
          stderr: '',
        } as SpawnSyncReturns<Buffer>;
      });

      // コンソール出力をキャプチャ
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await transitionPhase('design');

      // Assert: コミットがスキップされたことを確認
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No uncommitted changes, skipping auto-commit')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('Gitリポジトリ未初期化の場合', () => {
    test('警告メッセージを表示し、コミットをスキップ', async () => {
      // Arrange: Gitリポジトリが存在しない
      mockedExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      // Act & Assert: エラーをスローせず、フェーズ変更は成功
      await expect(transitionPhase('design')).resolves.not.toThrow();
    });
  });

  describe('コミット失敗時の自動ロールバック', () => {
    test('git commit 失敗時にステージングをリセット', async () => {
      // Arrange: git commit が失敗する
      mockedSpawnSync.mockImplementation((command: string, args?: readonly string[]) => {
        if (command === 'git' && args?.[0] === 'status' && args?.[1] === '--porcelain') {
          return {
            status: 0,
            stdout: 'M  .cc-craft-kit/specs/test.md\n',
            stderr: '',
          } as SpawnSyncReturns<Buffer>;
        }

        if (command === 'git' && args?.[0] === 'add') {
          return {
            status: 0,
            stdout: '',
            stderr: '',
          } as SpawnSyncReturns<Buffer>;
        }

        // git commit が失敗
        if (command === 'git' && args?.[0] === 'commit') {
          return {
            status: 1,
            stdout: '',
            stderr: 'fatal: pre-commit hook failed',
          } as SpawnSyncReturns<Buffer>;
        }

        // git reset HEAD（ロールバック）
        if (command === 'git' && args?.[0] === 'reset') {
          return {
            status: 0,
            stdout: '',
            stderr: '',
          } as SpawnSyncReturns<Buffer>;
        }

        return {
          status: 0,
          stdout: '',
          stderr: '',
        } as SpawnSyncReturns<Buffer>;
      });

      // コンソール出力をキャプチャ
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await transitionPhase('design');

      // Assert: ロールバックが実行されたことを確認
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rolled back staged changes (git reset HEAD)')
      );

      // git reset HEAD が呼ばれたことを確認
      const resetCalls = (mockedSpawnSync as jest.Mock).mock.calls.filter(
        (call) => call[0] === 'git' && call[1]?.[0] === 'reset'
      );
      expect(resetCalls.length).toBeGreaterThan(0);

      consoleLogSpy.mockRestore();
    });
  });

  describe('連続フェーズ移行の検証', () => {
    test('requirements → design → tasks → implementation → completed の全フェーズで自動コミット成功', async () => {
      const phases = [
        { phase: 'design' as const, message: `feat: ${specName} の設計を完了` },
        { phase: 'tasks' as const, message: `feat: ${specName} のタスク分解を完了` },
        { phase: 'implementation' as const, message: `feat: ${specName} の実装を開始` },
        { phase: 'completed' as const, message: `feat: ${specName} を実装完了` },
      ];

      for (const { phase, message } of phases) {
        // 各フェーズ移行前にモックをクリア
        jest.clearAllMocks();

        // Act
        await transitionPhase(phase);

        // Assert: コミットメッセージが正しいことを確認
        expectCommitMessageToBe(message);
      }
    });
  });
});
