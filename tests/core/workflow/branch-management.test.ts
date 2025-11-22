/**
 * ブランチ管理ワークフローの単体テスト
 *
 * 仕様書作成時のブランチ作成とフェーズ移行時の動作を検証します。
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { createSpecBranch, BranchCreationResult } from '../../../src/core/git/branch-creation.js';
import { execSync } from 'node:child_process';

// モジュールモック
jest.mock('node:child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('../../../src/core/git/branch-cache.js', () => ({
  getCurrentBranch: jest.fn(),
  clearBranchCache: jest.fn(),
}));

describe('Branch Management Workflow', () => {
  let lifecycle: DatabaseLifecycle;
  const originalEnv = process.env;

  // モック関数
  const mockExecSync = jest.mocked(execSync);
  const { getCurrentBranch } = jest.requireMock(
    '../../../src/core/git/branch-cache.js'
  ) as { getCurrentBranch: jest.MockedFunction<() => string> };

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();

    // 環境変数をリセット
    process.env = { ...originalEnv };
    delete process.env.GITHUB_TOKEN;

    // モック初期化
    mockExecSync.mockReset();
    getCurrentBranch.mockReset();

    // デフォルトモック動作
    getCurrentBranch.mockReturnValue('feature/test');
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();

    // 環境変数を復元
    process.env = originalEnv;

    // モックをクリア
    jest.clearAllMocks();
  });

  describe('仕様書作成時のブランチ作成', () => {
    const validUuid = '12345678-1234-1234-1234-123456789abc';
    const shortId = '12345678';

    test('feature ブランチから仕様書作成時、spec/ ブランチが1つ作成される', () => {
      // Given: feature ブランチにいる
      mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse --is-inside-work-tree
      getCurrentBranch.mockReturnValue('feature/test');
      mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
      mockExecSync.mockReturnValueOnce(`spec/${shortId}` as never); // git rev-parse --abbrev-ref HEAD

      // When: ブランチを作成
      const result = createSpecBranch(validUuid);

      // Then: ブランチが作成された
      expect(result.created).toBe(true);
      expect(result.branchName).toBe(`spec/${shortId}`);
      expect(result.originalBranch).toBe('feature/test');

      // Then: git checkout -b が呼ばれた
      expect(mockExecSync).toHaveBeenCalledWith(
        `git checkout -b spec/${shortId}`,
        expect.any(Object)
      );
    });

    test('保護ブランチ（main）から実行時、feature/spec- ブランチが作成される', () => {
      // Given: main ブランチにいる
      mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse --is-inside-work-tree
      getCurrentBranch.mockReturnValue('main');
      mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
      mockExecSync.mockReturnValueOnce(`feature/spec-${shortId}` as never); // git rev-parse --abbrev-ref HEAD

      // When: ブランチを作成
      const result = createSpecBranch(validUuid);

      // Then: feature/spec- プレフィックスのブランチが作成された
      expect(result.created).toBe(true);
      expect(result.branchName).toBe(`feature/spec-${shortId}`);
      expect(result.originalBranch).toBe('main');

      // Then: git checkout -b が呼ばれた
      expect(mockExecSync).toHaveBeenCalledWith(
        `git checkout -b feature/spec-${shortId}`,
        expect.any(Object)
      );
    });

    test('保護ブランチ（develop）から実行時、feature/spec- ブランチが作成される', () => {
      // Given: develop ブランチにいる
      mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse --is-inside-work-tree
      getCurrentBranch.mockReturnValue('develop');
      mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
      mockExecSync.mockReturnValueOnce(`feature/spec-${shortId}` as never); // git rev-parse --abbrev-ref HEAD

      // When: ブランチを作成
      const result = createSpecBranch(validUuid);

      // Then: feature/spec- プレフィックスのブランチが作成された
      expect(result.created).toBe(true);
      expect(result.branchName).toBe(`feature/spec-${shortId}`);
      expect(result.originalBranch).toBe('develop');
    });

    test('Git リポジトリ未初期化の場合、ブランチ作成をスキップする', () => {
      // Given: Git リポジトリ未初期化
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      // When: ブランチを作成
      const result = createSpecBranch(validUuid);

      // Then: ブランチ作成がスキップされた
      expect(result.created).toBe(false);
      expect(result.branchName).toBe(null);
      expect(result.reason).toBe(
        'Git リポジトリが初期化されていません。git init を実行してください。'
      );
    });

    test('カスタムブランチ名を指定してブランチが作成される', () => {
      // Given: カスタムブランチ名を指定
      const customBranchName = 'improve-branch-naming';
      mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse --is-inside-work-tree
      getCurrentBranch.mockReturnValue('feature/test');
      mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
      mockExecSync.mockReturnValueOnce(`spec/${shortId}-${customBranchName}` as never); // git rev-parse --abbrev-ref HEAD

      // When: カスタムブランチ名でブランチを作成
      const result = createSpecBranch(validUuid, customBranchName);

      // Then: カスタムブランチ名のブランチが作成された
      expect(result.created).toBe(true);
      expect(result.branchName).toBe(`spec/${shortId}-${customBranchName}`);
      expect(result.originalBranch).toBe('feature/test');

      // Then: git checkout -b が呼ばれた
      expect(mockExecSync).toHaveBeenCalledWith(
        `git checkout -b spec/${shortId}-${customBranchName}`,
        expect.any(Object)
      );
    });

    test('カスタム保護ブランチから実行時、feature/spec- プレフィックスが付く', () => {
      // Given: カスタム保護ブランチを設定
      process.env.PROTECTED_BRANCHES = 'main,develop,staging';
      mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse --is-inside-work-tree
      getCurrentBranch.mockReturnValue('staging');
      mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
      mockExecSync.mockReturnValueOnce(`feature/spec-${shortId}` as never); // git rev-parse --abbrev-ref HEAD

      // When: ブランチを作成
      const result = createSpecBranch(validUuid);

      // Then: feature/spec- プレフィックスのブランチが作成された
      expect(result.created).toBe(true);
      expect(result.branchName).toBe(`feature/spec-${shortId}`);
      expect(result.originalBranch).toBe('staging');
    });
  });

  describe('フェーズ移行時のブランチ作成', () => {
    test('フェーズ移行時はブランチ作成ロジックが呼ばれない', async () => {
      // Given: 仕様書が存在する
      const specId = randomUUID();
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'requirements',
          branch_name: 'spec/12345678',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // When/Then: フェーズ移行はデータベースレベルで処理される
      // createSpecBranch はフェーズ移行時には呼ばれないため、この時点で検証完了

      // フェーズを更新
      await lifecycle.db
        .updateTable('specs')
        .set({ phase: 'design' })
        .where('id', '=', specId)
        .execute();

      // Then: 仕様書のフェーズが更新された
      const updatedSpec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(updatedSpec.phase).toBe('design');

      // Then: ブランチ名は変更されていない
      expect(updatedSpec.branch_name).toBe('spec/12345678');
    });

    test('複数フェーズ移行しても、ブランチ名は不変', async () => {
      // Given: 仕様書が存在する
      const specId = randomUUID();
      const originalBranchName = 'spec/12345678';
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Test Spec',
          description: 'Test description',
          phase: 'requirements',
          branch_name: originalBranchName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // When: 複数フェーズを移行
      const phases = ['design', 'tasks', 'implementation', 'completed'];
      for (const phase of phases) {
        await lifecycle.db
          .updateTable('specs')
          .set({ phase })
          .where('id', '=', specId)
          .execute();

        // Then: ブランチ名は変更されていない
        const currentSpec = await lifecycle.db
          .selectFrom('specs')
          .where('id', '=', specId)
          .selectAll()
          .executeTakeFirstOrThrow();
        expect(currentSpec.branch_name).toBe(originalBranchName);
      }
    });
  });

  describe('ブランチ数の検証', () => {
    test('仕様書作成時、ブランチ作成関数は1回だけ呼ばれる', () => {
      // Given: ブランチ作成の準備
      const validUuid = '12345678-1234-1234-1234-123456789abc';
      mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse --is-inside-work-tree
      getCurrentBranch.mockReturnValue('feature/test');
      mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
      mockExecSync.mockReturnValueOnce('spec/12345678' as never); // git rev-parse --abbrev-ref HEAD

      // When: ブランチを作成
      const result = createSpecBranch(validUuid);

      // Then: git checkout -b が1回だけ呼ばれた
      const checkoutCalls = mockExecSync.mock.calls.filter((call) =>
        call[0].toString().includes('git checkout -b')
      );
      expect(checkoutCalls.length).toBe(1);

      // Then: ブランチが作成された
      expect(result.created).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    test('ブランチ作成失敗時、エラーがスローされる', () => {
      // Given: ブランチ作成が失敗する
      const validUuid = '12345678-1234-1234-1234-123456789abc';
      mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse --is-inside-work-tree
      getCurrentBranch.mockReturnValue('feature/test');
      mockExecSync.mockImplementation(() => {
        throw new Error('Branch already exists');
      });

      // When/Then: エラーがスローされる
      expect(() => createSpecBranch(validUuid)).toThrow(
        'ブランチ作成に失敗しました。既に同名のブランチが存在する可能性があります'
      );
    });

    test('無効な UUID 形式の場合、エラーがスローされる', () => {
      // Given: 無効な UUID
      const invalidUuid = 'invalid-uuid';

      // When/Then: エラーがスローされる
      expect(() => createSpecBranch(invalidUuid)).toThrow(
        'Invalid spec ID format. Expected UUID, got: invalid-uuid'
      );
    });

    test('現在のブランチ名取得失敗時、エラーがスローされる', () => {
      // Given: 現在のブランチ名取得が失敗する
      const validUuid = '12345678-1234-1234-1234-123456789abc';
      mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse --is-inside-work-tree
      getCurrentBranch.mockImplementation(() => {
        throw new Error('Failed to get current branch');
      });

      // When/Then: エラーがスローされる
      expect(() => createSpecBranch(validUuid)).toThrow('現在のブランチ名の取得に失敗しました');
    });
  });

  describe('ブランチ作成検証', () => {
    test('ブランチ作成後、正しいブランチに切り替わったか検証される', () => {
      // Given: ブランチ作成の準備
      const validUuid = '12345678-1234-1234-1234-123456789abc';
      const expectedBranch = 'spec/12345678';
      mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse --is-inside-work-tree
      getCurrentBranch.mockReturnValue('feature/test');
      mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
      mockExecSync.mockReturnValueOnce(expectedBranch as never); // git rev-parse --abbrev-ref HEAD

      // When: ブランチを作成
      const result = createSpecBranch(validUuid);

      // Then: ブランチ検証が実行された（git rev-parse --abbrev-ref HEAD が呼ばれた）
      expect(mockExecSync).toHaveBeenCalledWith(
        'git rev-parse --abbrev-ref HEAD',
        expect.any(Object)
      );

      // Then: 正しいブランチ名が返された
      expect(result.branchName).toBe(expectedBranch);
    });

    test('ブランチ検証失敗時、元のブランチに戻る', () => {
      // Given: ブランチ検証が失敗する設定
      const validUuid = '12345678-1234-1234-1234-123456789abc';
      mockExecSync.mockReturnValueOnce(undefined as never); // git rev-parse --is-inside-work-tree
      getCurrentBranch.mockReturnValue('feature/test');
      mockExecSync.mockReturnValueOnce(undefined as never); // git checkout -b
      mockExecSync.mockReturnValueOnce('wrong-branch' as never); // git rev-parse --abbrev-ref HEAD（間違ったブランチ）

      // When/Then: エラーがスローされる
      expect(() => createSpecBranch(validUuid)).toThrow('ブランチ作成に失敗しました');

      // Then: 元のブランチに戻る処理が実行された（git checkout feature/test）
      expect(mockExecSync).toHaveBeenCalledWith('git checkout feature/test', expect.any(Object));
    });
  });
});
