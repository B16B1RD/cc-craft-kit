/**
 * E2E テスト: 仕様書作成時のブランチ作成機能
 *
 * ⚠️ FIXME: このテストは process.chdir() を使用しているため、
 * 本番環境のブランチに影響を与える可能性があります。
 * https://github.com/B16B1RD/cc-craft-kit/issues/XXX
 *
 * 一時的にスキップし、代わりに単体テストでカバーします。
 *
 * このテストは以下のシナリオをカバーします：
 * 1. 保護ブランチ（main, develop）から仕様書作成 → ブランチ未作成
 * 2. 非保護ブランチ（feature/*）から仕様書作成 → ブランチ作成
 * 3. Git リポジトリ未初期化時の処理
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';

interface TestDatabase {
  specs: {
    id: string;
    name: string;
    description: string | null;
    phase: string;
    branch_name: string;
    created_at: string;
    updated_at: string;
  };
}

describe.skip('E2E: Spec Creation with Branch Management', () => {
  const testDir = join(process.cwd(), 'tests/e2e/.tmp-spec-create-branch');
  const originalCwd = process.cwd();
  const originalEnv = process.env.PROTECTED_BRANCHES;

  // ヘルパー関数: 仕様書を作成（CLI 経由）
  const createSpecViaCLI = (name: string, description?: string) => {
    const cmd = description
      ? `npx tsx ${join(originalCwd, 'src/commands/spec/create.ts')} "${name}" "${description}"`
      : `npx tsx ${join(originalCwd, 'src/commands/spec/create.ts')} "${name}"`;

    try {
      execSync(cmd, {
        cwd: testDir,
        stdio: 'pipe',
        encoding: 'utf-8',
        env: { ...process.env }, // 環境変数を継承
      });
    } catch (error) {
      // エラーが発生した場合は、詳細を出力
      if (error instanceof Error && 'stderr' in error) {
        console.error('CLI Error:', (error as any).stderr);
      }
      throw error;
    }
  };


  beforeEach(async () => {
    // 環境変数を初期値にリセット
    if (originalEnv) {
      process.env.PROTECTED_BRANCHES = originalEnv;
    } else {
      delete process.env.PROTECTED_BRANCHES;
    }

    // テスト用ディレクトリを作成
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    // Git リポジトリを初期化
    execSync('git init', { stdio: 'ignore', cwd: testDir });
    execSync('git config user.name "Test User"', { stdio: 'ignore', cwd: testDir });
    execSync('git config user.email "test@example.com"', { stdio: 'ignore', cwd: testDir });

    // 初期コミット作成
    execSync('echo "test" > README.md', { stdio: 'ignore', cwd: testDir });
    execSync('git add README.md', { stdio: 'ignore', cwd: testDir });
    execSync('git commit -m "Initial commit"', { stdio: 'ignore', cwd: testDir });

    // .cc-craft-kit ディレクトリを作成
    mkdirSync(join(testDir, '.cc-craft-kit', 'specs'), { recursive: true });

    // データベースを初期化
    const sqlite = new Database(join(testDir, '.cc-craft-kit', 'cc-craft-kit.db'));
    const db = new Kysely<TestDatabase>({
      dialect: new SqliteDialect({ database: sqlite }),
    });

    try {
      // specs テーブルを作成
      await db.schema
        .createTable('specs')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('phase', 'text', (col) => col.notNull())
        .addColumn('branch_name', 'text', (col) => col.notNull())
        .addColumn('created_at', 'text', (col) => col.notNull())
        .addColumn('updated_at', 'text', (col) => col.notNull())
        .execute();
    } finally {
      await db.destroy();
      sqlite.close();
    }
  });

  afterEach(() => {
    process.chdir(originalCwd);

    // テスト用ディレクトリを削除
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }

    // 環境変数を復元
    if (originalEnv) {
      process.env.PROTECTED_BRANCHES = originalEnv;
    } else {
      delete process.env.PROTECTED_BRANCHES;
    }
  });

  describe('保護ブランチでの動作', () => {
    it('main ブランチから仕様書作成時、ブランチを作成しない', async () => {
      // Given: main ブランチにいる
      execSync('git checkout -b main', { stdio: 'ignore', cwd: testDir });

      // When: 仕様書を作成
      createSpecViaCLI('Test Spec on Main', 'Test description');

      // Then: ブランチが作成されていない
      const branches = execSync('git branch', { encoding: 'utf-8', cwd: testDir });
      const branchList = branches.split('\n').map((b) => b.trim().replace('* ', ''));

      // spec/* パターンのブランチが存在しないことを確認
      const specBranches = branchList.filter((b) => b.startsWith('spec/'));
      expect(specBranches.length).toBe(0);
    });

    it('develop ブランチから仕様書作成時、ブランチを作成しない', async () => {
      // Given: develop ブランチにいる
      execSync('git checkout -b develop', { stdio: 'ignore', cwd: testDir });

      // When: 仕様書を作成
      createSpecViaCLI('Test Spec on Develop', 'Test description');

      // Then: ブランチが作成されていない
      const branches = execSync('git branch', { encoding: 'utf-8', cwd: testDir });
      const branchList = branches.split('\n').map((b) => b.trim().replace('* ', ''));

      // spec/* パターンのブランチが存在しないことを確認
      const specBranches = branchList.filter((b) => b.startsWith('spec/'));
      expect(specBranches.length).toBe(0);
    });

    it('カスタム保護ブランチから仕様書作成時、ブランチを作成しない', async () => {
      // Given: カスタム保護ブランチを設定
      process.env.PROTECTED_BRANCHES = 'main,develop,staging';
      execSync('git checkout -b staging', { stdio: 'ignore', cwd: testDir });

      // When: 仕様書を作成
      createSpecViaCLI('Test Spec on Staging', 'Test description');

      // Then: ブランチが作成されていない
      const branches = execSync('git branch', { encoding: 'utf-8', cwd: testDir });
      const branchList = branches.split('\n').map((b) => b.trim().replace('* ', ''));

      // spec/* パターンのブランチが存在しないことを確認
      const specBranches = branchList.filter((b) => b.startsWith('spec/'));
      expect(specBranches.length).toBe(0);
    });
  });

  describe('非保護ブランチでの動作', () => {
    it('feature ブランチから仕様書作成時、ブランチを作成する', async () => {
      // Given: feature ブランチにいる
      execSync('git checkout -b feature/test', { stdio: 'ignore', cwd: testDir });

      // When: 仕様書を作成
      createSpecViaCLI('Test Spec on Feature', 'Test description');

      // Then: spec/* パターンのブランチが作成されている
      const branches = execSync('git branch', { encoding: 'utf-8', cwd: testDir });
      const branchList = branches.split('\n').map((b) => b.trim().replace('* ', ''));

      const specBranches = branchList.filter((b) => b.startsWith('spec/'));
      expect(specBranches.length).toBe(1);
      expect(specBranches[0]).toMatch(/^spec\/[0-9a-f]{8}$/);

      // 現在のブランチが作成されたブランチであることを確認
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf-8',
        cwd: testDir,
      }).trim();
      expect(currentBranch).toMatch(/^spec\/[0-9a-f]{8}$/);
    });

    it('fix ブランチから仕様書作成時、ブランチを作成する', async () => {
      // Given: fix ブランチにいる
      execSync('git checkout -b fix/bug-123', { stdio: 'ignore', cwd: testDir });

      // When: 仕様書を作成
      createSpecViaCLI('Test Spec on Fix', 'Test description');

      // Then: spec/* パターンのブランチが作成されている
      const branches = execSync('git branch', { encoding: 'utf-8', cwd: testDir });
      const branchList = branches.split('\n').map((b) => b.trim().replace('* ', ''));

      const specBranches = branchList.filter((b) => b.startsWith('spec/'));
      expect(specBranches.length).toBe(1);
    });
  });

  describe('データベース整合性', () => {
    it('ブランチ作成後、仕様書ファイルが作成される', async () => {
      // Given: feature ブランチにいる
      execSync('git checkout -b feature/test-db', { stdio: 'ignore', cwd: testDir });

      // When: 仕様書を作成
      createSpecViaCLI('Test Spec for DB', 'Test description');

      // Then: 仕様書ファイルが作成されている
      const specsDir = join(testDir, '.cc-craft-kit', 'specs');
      const specFiles = execSync('ls -1', { cwd: specsDir, encoding: 'utf-8' }).split('\n').filter(Boolean);

      expect(specFiles.length).toBe(1);
      expect(specFiles[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.md$/);
    });

    it('保護ブランチで作成した場合、仕様書ファイルが作成される', async () => {
      // Given: main ブランチにいる
      execSync('git checkout -b main', { stdio: 'ignore', cwd: testDir });

      // When: 仕様書を作成
      createSpecViaCLI('Test Spec on Main DB', 'Test description');

      // Then: 仕様書ファイルが作成されている
      const specsDir = join(testDir, '.cc-craft-kit', 'specs');
      const specFiles = execSync('ls -1', { cwd: specsDir, encoding: 'utf-8' }).split('\n').filter(Boolean);

      expect(specFiles.length).toBe(1);
      expect(specFiles[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.md$/);
    });
  });

  describe('エラーハンドリング', () => {
    it('Git リポジトリ未初期化の場合、エラーにならず仕様書を作成', async () => {
      // Given: Git リポジトリを削除
      rmSync(join(testDir, '.git'), { recursive: true, force: true });

      // When: 仕様書を作成（エラーにならないことを確認）
      expect(() => {
        createSpecViaCLI('Test Spec without Git', 'Test description');
      }).not.toThrow();

      // Then: 仕様書ファイルが作成されている
      const specsDir = join(testDir, '.cc-craft-kit', 'specs');
      const specFiles = execSync('ls -1', { cwd: specsDir, encoding: 'utf-8' }).split('\n').filter(Boolean);

      expect(specFiles.length).toBe(1);
      expect(specFiles[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.md$/);
    });
  });

  describe('ブランチ名の生成', () => {
    it('仕様書 ID の先頭 8 文字を使用してブランチ名を生成', async () => {
      // Given: feature ブランチにいる
      execSync('git checkout -b feature/test-branch-name', { stdio: 'ignore', cwd: testDir });

      // When: 仕様書を作成
      createSpecViaCLI('Test Branch Name Generation', 'Test description');

      // Then: ブランチ名が spec/<8文字の16進数> 形式
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf-8',
        cwd: testDir,
      }).trim();

      expect(currentBranch).toMatch(/^spec\/[0-9a-f]{8}$/);

      // 仕様書ファイルが作成されている
      const specsDir = join(testDir, '.cc-craft-kit', 'specs');
      const specFiles = execSync('ls -1', { cwd: specsDir, encoding: 'utf-8' }).split('\n').filter(Boolean);

      expect(specFiles.length).toBe(1);

      // ブランチ名が仕様書 ID の先頭 8 文字と一致
      const specId = specFiles[0].replace('.md', '');
      const expectedBranchName = `spec/${specId.substring(0, 8)}`;
      expect(currentBranch).toBe(expectedBranchName);
    });
  });
});
