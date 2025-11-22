/**
 * E2E テスト: ブランチ作成機能
 *
 * ⚠️ FIXME: このテストは process.chdir() を使用しているため、
 * 本番環境のブランチに影響を与える可能性があります。
 * https://github.com/B16B1RD/cc-craft-kit/issues/XXX
 *
 * 一時的にスキップし、代わりに単体テストでカバーします。
 *
 * 仕様書作成 → フェーズ移行のフルフローで、ブランチが1つだけ作成されることを検証します。
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync } from 'node:fs';
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
  github_sync: {
    id: string;
    entity_type: string;
    entity_id: string;
    github_id: string;
    github_number: number;
    github_node_id: string | null;
    last_synced_at: string;
    sync_status: string;
    error_message: string | null;
  };
}

describe.skip('E2E: Branch Creation Workflow', () => {
  const testDir = join(process.cwd(), 'tests/e2e/.tmp-branch-creation');
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };

  // ヘルパー関数: 仕様書を作成
  const createSpecViaCLI = (name: string, description?: string) => {
    const cmd = description
      ? `npx tsx ${join(originalCwd, 'src/commands/spec/create.ts')} "${name}" "${description}"`
      : `npx tsx ${join(originalCwd, 'src/commands/spec/create.ts')} "${name}"`;

    try {
      execSync(cmd, {
        cwd: testDir,
        stdio: 'pipe',
        encoding: 'utf-8',
        env: { ...process.env },
      });
    } catch (error) {
      if (error instanceof Error && 'stderr' in error) {
        console.error('CLI Error:', (error as any).stderr);
      }
      throw error;
    }
  };

  // ヘルパー関数: フェーズを更新
  const updatePhaseViaCLI = (specId: string, phase: string) => {
    const cmd = `npx tsx ${join(originalCwd, 'src/commands/spec/phase.ts')} "${specId}" "${phase}"`;

    try {
      execSync(cmd, {
        cwd: testDir,
        stdio: 'pipe',
        encoding: 'utf-8',
        env: { ...process.env },
      });
    } catch (error) {
      if (error instanceof Error && 'stderr' in error) {
        console.error('CLI Error:', (error as any).stderr);
      }
      throw error;
    }
  };

  // ヘルパー関数: ブランチ一覧を取得
  const getAllBranches = (): string[] => {
    try {
      const branches = execSync('git branch', { encoding: 'utf-8', cwd: testDir });
      return branches
        .split('\n')
        .map((b) => b.trim().replace('* ', ''))
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  // ヘルパー関数: 現在のブランチを取得
  const getCurrentBranch = (): string => {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      cwd: testDir,
    }).trim();
  };

  // ヘルパー関数: 仕様書ファイルの一覧を取得
  const getSpecFiles = (): string[] => {
    const specsDir = join(testDir, '.cc-craft-kit', 'specs');
    if (!existsSync(specsDir)) {
      return [];
    }
    return readdirSync(specsDir).filter((file) => file.endsWith('.md'));
  };

  // ヘルパー関数: 仕様書ファイルからフェーズを読み取る
  const getPhaseFromSpecFile = (specId: string): string | null => {
    const specPath = join(testDir, '.cc-craft-kit', 'specs', `${specId}.md`);
    if (!existsSync(specPath)) {
      return null;
    }
    const content = readFileSync(specPath, 'utf-8');
    const match = content.match(/\*\*フェーズ:\*\* (\w+)/);
    return match ? match[1] : null;
  };

  beforeEach(async () => {
    // 環境変数をリセット
    process.env = { ...originalEnv };
    delete process.env.GITHUB_TOKEN;

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

      // github_sync テーブルを作成
      await db.schema
        .createTable('github_sync')
        .ifNotExists()
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('entity_type', 'text', (col) => col.notNull())
        .addColumn('entity_id', 'text', (col) => col.notNull())
        .addColumn('github_id', 'text', (col) => col.notNull())
        .addColumn('github_number', 'integer', (col) => col.notNull())
        .addColumn('github_node_id', 'text')
        .addColumn('last_synced_at', 'text', (col) => col.notNull())
        .addColumn('sync_status', 'text', (col) => col.notNull())
        .addColumn('error_message', 'text')
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
    process.env = originalEnv;
  });

  describe('仕様書作成時のブランチ作成', () => {
    it('feature ブランチから仕様書作成時、spec/ ブランチが1つだけ作成される', async () => {
      // Given: feature ブランチにいる
      execSync('git checkout -b feature/test', { stdio: 'ignore', cwd: testDir });

      // When: 仕様書を作成
      createSpecViaCLI('Test Spec', 'Test description');

      // Then: ブランチが1つだけ作成されている
      const branches = getAllBranches();
      const specBranches = branches.filter((b) => b.startsWith('spec/'));

      expect(specBranches.length).toBe(1);
      expect(specBranches[0]).toMatch(/^spec\/[0-9a-f]{8}$/);

      // Then: 現在のブランチが作成されたブランチ
      const currentBranch = getCurrentBranch();
      expect(currentBranch).toBe(specBranches[0]);

      // Then: 仕様書ファイルが作成されている
      const specFiles = getSpecFiles();
      expect(specFiles.length).toBe(1);
    });

    it('保護ブランチ（main）から仕様書作成時、feature/spec- ブランチが1つだけ作成される', async () => {
      // Given: main ブランチにいる
      execSync('git checkout -b main', { stdio: 'ignore', cwd: testDir });

      // When: 仕様書を作成
      createSpecViaCLI('Test Spec on Main', 'Test description');

      // Then: feature/spec- ブランチが1つだけ作成されている
      const branches = getAllBranches();
      const featureSpecBranches = branches.filter((b) => b.startsWith('feature/spec-'));

      expect(featureSpecBranches.length).toBe(1);
      expect(featureSpecBranches[0]).toMatch(/^feature\/spec-[0-9a-f]{8}$/);

      // Then: 現在のブランチが作成されたブランチ
      const currentBranch = getCurrentBranch();
      expect(currentBranch).toBe(featureSpecBranches[0]);
    });

    it('保護ブランチ（develop）から仕様書作成時、feature/spec- ブランチが1つだけ作成される', async () => {
      // Given: develop ブランチにいる
      execSync('git checkout -b develop', { stdio: 'ignore', cwd: testDir });

      // When: 仕様書を作成
      createSpecViaCLI('Test Spec on Develop', 'Test description');

      // Then: feature/spec- ブランチが1つだけ作成されている
      const branches = getAllBranches();
      const featureSpecBranches = branches.filter((b) => b.startsWith('feature/spec-'));

      expect(featureSpecBranches.length).toBe(1);
      expect(featureSpecBranches[0]).toMatch(/^feature\/spec-[0-9a-f]{8}$/);
    });
  });

  describe('フェーズ移行時のブランチ作成', () => {
    it('requirements → design への移行時、ブランチは追加作成されない', async () => {
      // Given: 仕様書を作成（feature ブランチ）
      execSync('git checkout -b feature/test', { stdio: 'ignore', cwd: testDir });
      createSpecViaCLI('Test Spec', 'Test description');

      // ブランチ数を確認（初期状態）
      const initialBranches = getAllBranches();
      const initialSpecBranches = initialBranches.filter((b) => b.startsWith('spec/'));
      expect(initialSpecBranches.length).toBe(1);

      // 仕様書 ID を取得
      const specFiles = getSpecFiles();
      const specId = specFiles[0].replace('.md', '').substring(0, 8);

      // When: フェーズを design に変更
      updatePhaseViaCLI(specId, 'design');

      // Then: ブランチは追加されていない
      const finalBranches = getAllBranches();
      const finalSpecBranches = finalBranches.filter((b) => b.startsWith('spec/'));
      expect(finalSpecBranches.length).toBe(1);
      expect(finalSpecBranches[0]).toBe(initialSpecBranches[0]);
    });

    it('tasks → implementation への移行時、ブランチは追加作成されない', async () => {
      // Given: 仕様書を作成（feature ブランチ）
      execSync('git checkout -b feature/test', { stdio: 'ignore', cwd: testDir });
      createSpecViaCLI('Test Spec', 'Test description');

      const specFiles = getSpecFiles();
      const specId = specFiles[0].replace('.md', '').substring(0, 8);

      // フェーズを tasks まで進める
      updatePhaseViaCLI(specId, 'design');
      updatePhaseViaCLI(specId, 'tasks');

      // ブランチ数を確認（tasks フェーズ）
      const initialBranches = getAllBranches();
      const initialSpecBranches = initialBranches.filter((b) => b.startsWith('spec/'));
      expect(initialSpecBranches.length).toBe(1);

      // When: フェーズを implementation に変更
      updatePhaseViaCLI(specId, 'implementation');

      // Then: ブランチは追加されていない
      const finalBranches = getAllBranches();
      const finalSpecBranches = finalBranches.filter((b) => b.startsWith('spec/'));
      expect(finalSpecBranches.length).toBe(1);
      expect(finalSpecBranches[0]).toBe(initialSpecBranches[0]);
    });
  });

  describe('フルフローのブランチ数検証', () => {
    it('仕様書作成 → 全フェーズ移行で、ブランチは1つのみ', async () => {
      // Given: feature ブランチにいる
      execSync('git checkout -b feature/full-flow', { stdio: 'ignore', cwd: testDir });

      // When: 仕様書を作成
      createSpecViaCLI('Full Flow Test', 'Test description');

      // Then: ブランチが1つ作成された
      const afterCreateBranches = getAllBranches();
      const afterCreateSpecBranches = afterCreateBranches.filter((b) => b.startsWith('spec/'));
      expect(afterCreateSpecBranches.length).toBe(1);

      // 仕様書 ID を取得
      const specFiles = getSpecFiles();
      const specId = specFiles[0].replace('.md', '').substring(0, 8);

      // When: 全フェーズを移行
      updatePhaseViaCLI(specId, 'design');
      const afterDesignBranches = getAllBranches();
      const afterDesignSpecBranches = afterDesignBranches.filter((b) => b.startsWith('spec/'));
      expect(afterDesignSpecBranches.length).toBe(1);

      updatePhaseViaCLI(specId, 'tasks');
      const afterTasksBranches = getAllBranches();
      const afterTasksSpecBranches = afterTasksBranches.filter((b) => b.startsWith('spec/'));
      expect(afterTasksSpecBranches.length).toBe(1);

      updatePhaseViaCLI(specId, 'implementation');
      const afterImplBranches = getAllBranches();
      const afterImplSpecBranches = afterImplBranches.filter((b) => b.startsWith('spec/'));
      expect(afterImplSpecBranches.length).toBe(1);

      updatePhaseViaCLI(specId, 'completed');
      const afterCompletedBranches = getAllBranches();
      const afterCompletedSpecBranches = afterCompletedBranches.filter((b) =>
        b.startsWith('spec/')
      );
      expect(afterCompletedSpecBranches.length).toBe(1);

      // Then: すべてのフェーズで同じブランチが使用されている
      expect(afterCreateSpecBranches[0]).toBe(afterDesignSpecBranches[0]);
      expect(afterDesignSpecBranches[0]).toBe(afterTasksSpecBranches[0]);
      expect(afterTasksSpecBranches[0]).toBe(afterImplSpecBranches[0]);
      expect(afterImplSpecBranches[0]).toBe(afterCompletedSpecBranches[0]);
    });

    it('複数仕様書を作成しても、それぞれ1つのブランチのみ作成', async () => {
      // Given: feature ブランチにいる
      execSync('git checkout -b feature/multi-spec', { stdio: 'ignore', cwd: testDir });

      // When: 1つ目の仕様書を作成
      createSpecViaCLI('First Spec', 'First description');
      const firstSpecFiles = getSpecFiles();
      expect(firstSpecFiles.length).toBe(1);

      const firstBranches = getAllBranches();
      const firstSpecBranches = firstBranches.filter((b) => b.startsWith('spec/'));
      expect(firstSpecBranches.length).toBe(1);

      // 1つ目のブランチに戻る
      execSync(`git checkout ${firstSpecBranches[0]}`, { stdio: 'ignore', cwd: testDir });

      // When: 2つ目の仕様書を作成
      createSpecViaCLI('Second Spec', 'Second description');
      const secondSpecFiles = getSpecFiles();
      expect(secondSpecFiles.length).toBe(2);

      // Then: ブランチは2つ（それぞれ1つずつ）
      const finalBranches = getAllBranches();
      const finalSpecBranches = finalBranches.filter((b) => b.startsWith('spec/'));
      expect(finalSpecBranches.length).toBe(2);

      // Then: 各ブランチは spec/<8文字の16進数> 形式
      finalSpecBranches.forEach((branch) => {
        expect(branch).toMatch(/^spec\/[0-9a-f]{8}$/);
      });
    });
  });

  describe('データベース整合性', () => {
    it('ブランチ作成後、現在のブランチが spec/ 形式である', async () => {
      // Given: feature ブランチにいる
      execSync('git checkout -b feature/db-test', { stdio: 'ignore', cwd: testDir });

      // When: 仕様書を作成
      createSpecViaCLI('DB Test Spec', 'Test description');

      // Then: 現在のブランチが spec/ 形式
      const currentBranch = getCurrentBranch();
      expect(currentBranch).toMatch(/^spec\/[0-9a-f]{8}$/);

      // Then: 仕様書ファイルが作成されている
      const specFiles = getSpecFiles();
      expect(specFiles.length).toBe(1);
    });

    it('フェーズ移行後も、現在のブランチは変更されない', async () => {
      // Given: 仕様書を作成
      execSync('git checkout -b feature/branch-name-test', { stdio: 'ignore', cwd: testDir });
      createSpecViaCLI('Branch Name Test', 'Test description');

      // 初期ブランチ名を取得
      const initialBranch = getCurrentBranch();
      expect(initialBranch).toMatch(/^spec\/[0-9a-f]{8}$/);

      // 仕様書 ID を取得
      const specFiles = getSpecFiles();
      const fullSpecId = specFiles[0].replace('.md', '');
      const specId = fullSpecId.substring(0, 8);

      // When: フェーズを移行
      updatePhaseViaCLI(specId, 'design');
      updatePhaseViaCLI(specId, 'tasks');
      updatePhaseViaCLI(specId, 'implementation');

      // Then: ブランチ名は変更されていない
      const finalBranch = getCurrentBranch();
      expect(finalBranch).toBe(initialBranch);

      // Then: フェーズが正しく更新されている（ファイルから確認）
      const phase = getPhaseFromSpecFile(fullSpecId);
      expect(phase).toBe('implementation');
    });
  });
});
