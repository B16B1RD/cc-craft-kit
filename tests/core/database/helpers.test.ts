/**
 * データベースヘルパー関数のテスト
 */

import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import type { Database as DatabaseSchema } from '../../../src/core/database/schema.js';
import { getSpecWithGitHubInfo, getSpecsWithGitHubInfo } from '../../../src/core/database/helpers.js';

describe('database-helpers', () => {
  let db: Kysely<DatabaseSchema>;

  beforeEach(async () => {
    // インメモリデータベースを作成
    db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: new Database(':memory:'),
      }),
    });

    // テーブル作成
    await db.schema
      .createTable('specs')
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('description', 'text')
      .addColumn('phase', 'text', (col) => col.notNull())
      .addColumn('branch_name', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .execute();

    await db.schema
      .createTable('github_sync')
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('entity_type', 'text', (col) => col.notNull())
      .addColumn('entity_id', 'text', (col) => col.notNull())
      .addColumn('github_id', 'integer')
      .addColumn('github_number', 'integer')
      .addColumn('github_node_id', 'text')
      .addColumn('sync_status', 'text', (col) => col.notNull())
      .addColumn('last_synced_at', 'text')
      .addColumn('created_at', 'text', (col) => col.notNull())
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .addColumn('pr_number', 'integer')
      .addColumn('pr_url', 'text')
      .addColumn('pr_merged_at', 'text')
      .execute();

    // テストデータ投入
    const now = new Date().toISOString();

    await db
      .insertInto('specs')
      .values([
        {
          id: 'spec-1',
          name: 'Spec on develop',
          description: 'Test spec 1',
          phase: 'requirements',
          branch_name: 'develop',
          created_at: now,
          updated_at: now,
        },
        {
          id: 'spec-2',
          name: 'Spec on main',
          description: 'Test spec 2',
          phase: 'design',
          branch_name: 'main',
          created_at: now,
          updated_at: now,
        },
        {
          id: 'spec-3',
          name: 'Spec on feature branch',
          description: 'Test spec 3',
          phase: 'implementation',
          branch_name: 'feature/test-branch',
          created_at: now,
          updated_at: now,
        },
        {
          id: 'spec-4',
          name: 'Another spec on feature branch',
          description: 'Test spec 4',
          phase: 'completed',
          branch_name: 'feature/another-branch',
          created_at: now,
          updated_at: now,
        },
      ])
      .execute();

    // GitHub 同期情報
    await db
      .insertInto('github_sync')
      .values([
        {
          entity_type: 'spec',
          entity_id: 'spec-1',
          github_id: 100,
          github_number: 1,
          github_node_id: 'node-1',
          sync_status: 'success',
          last_synced_at: now,
          created_at: now,
          updated_at: now,
        },
      ])
      .execute();
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('getSpecWithGitHubInfo', () => {
    test('should return spec with GitHub info', async () => {
      const spec = await getSpecWithGitHubInfo(db, 'spec-1');

      expect(spec).toBeDefined();
      expect(spec?.id).toBe('spec-1');
      expect(spec?.name).toBe('Spec on develop');
      expect(spec?.branch_name).toBe('develop');
      expect(spec?.github_issue_number).toBe(1);
      expect(spec?.github_node_id).toBe('node-1');
      expect(spec?.github_sync_status).toBe('success');
    });

    test('should return spec without GitHub info', async () => {
      const spec = await getSpecWithGitHubInfo(db, 'spec-2');

      expect(spec).toBeDefined();
      expect(spec?.id).toBe('spec-2');
      expect(spec?.name).toBe('Spec on main');
      expect(spec?.branch_name).toBe('main');
      expect(spec?.github_issue_number).toBeNull();
      expect(spec?.github_node_id).toBeNull();
      expect(spec?.github_sync_status).toBeNull();
    });

    test('should return undefined for non-existent spec', async () => {
      const spec = await getSpecWithGitHubInfo(db, 'non-existent');

      expect(spec).toBeUndefined();
    });

    test('should support partial ID matching (prefix search)', async () => {
      const spec = await getSpecWithGitHubInfo(db, 'spec-3');

      expect(spec).toBeDefined();
      expect(spec?.id).toBe('spec-3');
    });
  });

  describe('getSpecsWithGitHubInfo', () => {
    test('should return all specs when no filters applied', async () => {
      const specs = await getSpecsWithGitHubInfo(db);

      expect(specs).toHaveLength(4);
    });

    test('should filter by phase', async () => {
      const specs = await getSpecsWithGitHubInfo(db, { phase: 'requirements' });

      expect(specs).toHaveLength(1);
      expect(specs[0].id).toBe('spec-1');
    });

    test('should filter by branch name (current branch only)', async () => {
      const specs = await getSpecsWithGitHubInfo(db, {
        branchName: 'feature/test-branch',
      });

      // feature/test-branch, main, develop のいずれかで作成された仕様書が返る
      expect(specs).toHaveLength(3);
      const ids = specs.map((s) => s.id).sort();
      expect(ids).toEqual(['spec-1', 'spec-2', 'spec-3']);
    });

    test('should return main and develop specs for any branch', async () => {
      const specs = await getSpecsWithGitHubInfo(db, {
        branchName: 'feature/another-branch',
      });

      // feature/another-branch, main, develop のいずれかで作成された仕様書が返る
      expect(specs).toHaveLength(3);
      const ids = specs.map((s) => s.id).sort();
      expect(ids).toEqual(['spec-1', 'spec-2', 'spec-4']);
    });

    test('should return only main and develop specs when on main', async () => {
      const specs = await getSpecsWithGitHubInfo(db, {
        branchName: 'main',
      });

      expect(specs).toHaveLength(2);
      const ids = specs.map((s) => s.id).sort();
      expect(ids).toEqual(['spec-1', 'spec-2']);
    });

    test('should return only main and develop specs when on develop', async () => {
      const specs = await getSpecsWithGitHubInfo(db, {
        branchName: 'develop',
      });

      expect(specs).toHaveLength(2);
      const ids = specs.map((s) => s.id).sort();
      expect(ids).toEqual(['spec-1', 'spec-2']);
    });

    test('should combine phase and branch filters', async () => {
      const specs = await getSpecsWithGitHubInfo(db, {
        phase: 'implementation',
        branchName: 'feature/test-branch',
      });

      expect(specs).toHaveLength(1);
      expect(specs[0].id).toBe('spec-3');
    });

    test('should limit results', async () => {
      const specs = await getSpecsWithGitHubInfo(db, { limit: 2 });

      expect(specs).toHaveLength(2);
    });

    test('should include GitHub sync info', async () => {
      const specs = await getSpecsWithGitHubInfo(db);

      const spec1 = specs.find((s) => s.id === 'spec-1');
      expect(spec1?.github_issue_number).toBe(1);
      expect(spec1?.github_sync_status).toBe('success');
    });
  });

  describe('branch filtering logic', () => {
    test('should return specs from current branch, main, and develop', async () => {
      const specs = await getSpecsWithGitHubInfo(db, {
        branchName: 'feature/test-branch',
      });

      const branchNames = specs.map((s) => s.branch_name).sort();
      expect(branchNames).toEqual(['develop', 'feature/test-branch', 'main']);
    });

    test('should not return specs from other feature branches', async () => {
      const specs = await getSpecsWithGitHubInfo(db, {
        branchName: 'feature/test-branch',
      });

      const hasOtherFeatureBranch = specs.some((s) => s.branch_name === 'feature/another-branch');
      expect(hasOtherFeatureBranch).toBe(false);
    });

    test('should always include main and develop branches', async () => {
      const specs = await getSpecsWithGitHubInfo(db, {
        branchName: 'feature/non-existent',
      });

      // main と develop のみが返る
      expect(specs).toHaveLength(2);
      const branchNames = specs.map((s) => s.branch_name).sort();
      expect(branchNames).toEqual(['develop', 'main']);
    });
  });
});
