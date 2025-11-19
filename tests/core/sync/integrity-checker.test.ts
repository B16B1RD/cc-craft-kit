/**
 * IntegrityChecker テスト
 */
import { IntegrityChecker } from '../../../src/core/sync/integrity-checker.js';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { readdir } from 'fs/promises';
import { NewSpec } from '../../../src/core/database/schema.js';

// fs/promises のモック
jest.mock('fs/promises');
const mockedReaddir = readdir as jest.MockedFunction<typeof readdir>;

// SpecFileParser のモック
jest.mock('../../../src/core/sync/spec-file-parser.js', () => ({
  SpecFileParser: jest.fn().mockImplementation(() => ({
    parseFile: jest.fn(),
  })),
  SpecParseError: class SpecParseError extends Error {
    constructor(message: string, public filePath: string, public cause?: Error) {
      super(message);
      this.name = 'SpecParseError';
    }
  },
}));

import { SpecFileParser } from '../../../src/core/sync/spec-file-parser.js';

describe('IntegrityChecker', () => {
  let lifecycle: DatabaseLifecycle;
  let checker: IntegrityChecker;
  let mockParser: jest.Mocked<InstanceType<typeof SpecFileParser>>;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
    checker = new IntegrityChecker(lifecycle.db);

    // モックパーサーインスタンスを取得
    mockParser = (checker as any).parser;
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  describe('check', () => {
    describe('完全に同期されている場合', () => {
      it('すべてのファイルとDBが一致している場合、syncedに含まれる', async () => {
        const specsDir = '/path/to/specs';

        // データベースにレコードを挿入
        const spec1: NewSpec = {
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Spec 1',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_project_item_id: null,
          github_milestone_id: null,
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        };

        await lifecycle.db.insertInto('specs').values(spec1).execute();

        // ファイルシステムをモック
        mockedReaddir.mockResolvedValue(['12345678-1234-4abc-8def-123456789012.md'] as any);

        mockParser.parseFile.mockResolvedValue({
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Spec 1',
          phase: 'requirements',
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        });

        const report = await checker.check(specsDir);

        expect(report.filesOnly).toEqual([]);
        expect(report.dbOnly).toEqual([]);
        expect(report.mismatch).toEqual([]);
        expect(report.synced).toEqual(['12345678-1234-4abc-8def-123456789012']);
        expect(report.totalFiles).toBe(1);
        expect(report.totalDbRecords).toBe(1);
        expect(report.syncRate).toBe(100);
      });

      it('複数のファイルとDBが一致している場合', async () => {
        const specsDir = '/path/to/specs';

        // 複数のレコードを挿入
        const specs: NewSpec[] = [
          {
            id: '12345678-1234-4abc-8def-123456789012',
            name: 'Spec 1',
            description: null,
            phase: 'requirements',
            github_issue_id: null,
            github_project_id: null,
            github_project_item_id: null,
            github_milestone_id: null,
            created_at: '2025-11-19T10:00:00',
            updated_at: '2025-11-19T10:00:00',
          },
          {
            id: 'abcdef01-2345-4678-9abc-def012345678',
            name: 'Spec 2',
            description: null,
            phase: 'design',
            github_issue_id: null,
            github_project_id: null,
            github_project_item_id: null,
            github_milestone_id: null,
            created_at: '2025-11-19T11:00:00',
            updated_at: '2025-11-19T11:00:00',
          },
        ];

        for (const spec of specs) {
          await lifecycle.db.insertInto('specs').values(spec).execute();
        }

        // ファイルシステムをモック
        mockedReaddir.mockResolvedValue([
          '12345678-1234-4abc-8def-123456789012.md',
          'abcdef01-2345-4678-9abc-def012345678.md',
        ] as any);

        mockParser.parseFile
          .mockResolvedValueOnce({
            id: '12345678-1234-4abc-8def-123456789012',
            name: 'Spec 1',
            phase: 'requirements',
            created_at: '2025-11-19T10:00:00',
            updated_at: '2025-11-19T10:00:00',
          })
          .mockResolvedValueOnce({
            id: 'abcdef01-2345-4678-9abc-def012345678',
            name: 'Spec 2',
            phase: 'design',
            created_at: '2025-11-19T11:00:00',
            updated_at: '2025-11-19T11:00:00',
          });

        const report = await checker.check(specsDir);

        expect(report.synced).toHaveLength(2);
        expect(report.syncRate).toBe(100);
      });
    });

    describe('ファイルのみ存在する場合', () => {
      it('DBに登録されていないファイルをfilesOnlyに含める', async () => {
        const specsDir = '/path/to/specs';

        // ファイルは存在するがDBにはない
        mockedReaddir.mockResolvedValue(['12345678-1234-4abc-8def-123456789012.md'] as any);

        const report = await checker.check(specsDir);

        expect(report.filesOnly).toEqual(['12345678-1234-4abc-8def-123456789012']);
        expect(report.dbOnly).toEqual([]);
        expect(report.synced).toEqual([]);
        expect(report.totalFiles).toBe(1);
        expect(report.totalDbRecords).toBe(0);
        expect(report.syncRate).toBe(0);
      });

      it('複数の未登録ファイルを検出する', async () => {
        const specsDir = '/path/to/specs';

        mockedReaddir.mockResolvedValue([
          '12345678-1234-4abc-8def-123456789012.md',
          'abcdef01-2345-4678-9abc-def012345678.md',
          'fedcba98-7654-4321-9876-543210fedcba.md',
        ] as any);

        const report = await checker.check(specsDir);

        expect(report.filesOnly).toHaveLength(3);
        expect(report.syncRate).toBe(0);
      });
    });

    describe('DBのみ存在する場合', () => {
      it('ファイルが削除されたレコードをdbOnlyに含める', async () => {
        const specsDir = '/path/to/specs';

        // DBにはレコードがあるがファイルがない
        const spec: NewSpec = {
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Deleted File',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_project_item_id: null,
          github_milestone_id: null,
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        };

        await lifecycle.db.insertInto('specs').values(spec).execute();

        mockedReaddir.mockResolvedValue([]);

        const report = await checker.check(specsDir);

        expect(report.filesOnly).toEqual([]);
        expect(report.dbOnly).toEqual(['12345678-1234-4abc-8def-123456789012']);
        expect(report.synced).toEqual([]);
        expect(report.totalFiles).toBe(0);
        expect(report.totalDbRecords).toBe(1);
        expect(report.syncRate).toBe(0);
      });

      it('複数の削除ファイルを検出する', async () => {
        const specsDir = '/path/to/specs';

        const specs: NewSpec[] = [
          {
            id: '12345678-1234-4abc-8def-123456789012',
            name: 'Deleted 1',
            description: null,
            phase: 'requirements',
            github_issue_id: null,
            github_project_id: null,
            github_project_item_id: null,
            github_milestone_id: null,
            created_at: '2025-11-19T10:00:00',
            updated_at: '2025-11-19T10:00:00',
          },
          {
            id: 'abcdef01-2345-4678-9abc-def012345678',
            name: 'Deleted 2',
            description: null,
            phase: 'design',
            github_issue_id: null,
            github_project_id: null,
            github_project_item_id: null,
            github_milestone_id: null,
            created_at: '2025-11-19T11:00:00',
            updated_at: '2025-11-19T11:00:00',
          },
        ];

        for (const spec of specs) {
          await lifecycle.db.insertInto('specs').values(spec).execute();
        }

        mockedReaddir.mockResolvedValue([]);

        const report = await checker.check(specsDir);

        expect(report.dbOnly).toHaveLength(2);
      });
    });

    describe('メタデータの不一致', () => {
      it('名前が異なる場合、mismatchに含める', async () => {
        const specsDir = '/path/to/specs';

        const spec: NewSpec = {
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Old Name',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_project_item_id: null,
          github_milestone_id: null,
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        };

        await lifecycle.db.insertInto('specs').values(spec).execute();

        mockedReaddir.mockResolvedValue(['12345678-1234-4abc-8def-123456789012.md'] as any);

        mockParser.parseFile.mockResolvedValue({
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'New Name',
          phase: 'requirements',
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        });

        const report = await checker.check(specsDir);

        expect(report.mismatch).toHaveLength(1);
        expect(report.mismatch[0].id).toBe('12345678-1234-4abc-8def-123456789012');
        expect(report.mismatch[0].differences).toEqual([
          'Name mismatch: file="New Name" db="Old Name"',
        ]);
        expect(report.synced).toEqual([]);
      });

      it('フェーズが異なる場合、mismatchに含める', async () => {
        const specsDir = '/path/to/specs';

        const spec: NewSpec = {
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Test Spec',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_project_item_id: null,
          github_milestone_id: null,
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        };

        await lifecycle.db.insertInto('specs').values(spec).execute();

        mockedReaddir.mockResolvedValue(['12345678-1234-4abc-8def-123456789012.md'] as any);

        mockParser.parseFile.mockResolvedValue({
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Test Spec',
          phase: 'design',
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        });

        const report = await checker.check(specsDir);

        expect(report.mismatch).toHaveLength(1);
        expect(report.mismatch[0].differences).toEqual([
          'Phase mismatch: file="design" db="requirements"',
        ]);
      });

      it('更新日時が異なる場合、mismatchに含める', async () => {
        const specsDir = '/path/to/specs';

        const spec: NewSpec = {
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Test Spec',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_project_item_id: null,
          github_milestone_id: null,
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        };

        await lifecycle.db.insertInto('specs').values(spec).execute();

        mockedReaddir.mockResolvedValue(['12345678-1234-4abc-8def-123456789012.md'] as any);

        mockParser.parseFile.mockResolvedValue({
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Test Spec',
          phase: 'requirements',
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T15:30:00', // 異なる更新日時
        });

        const report = await checker.check(specsDir);

        expect(report.mismatch).toHaveLength(1);
        expect(report.mismatch[0].differences).toContainEqual(
          expect.stringContaining('Updated time mismatch')
        );
      });

      it('複数の差分がある場合、すべてをリストアップする', async () => {
        const specsDir = '/path/to/specs';

        const spec: NewSpec = {
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Old Name',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_project_item_id: null,
          github_milestone_id: null,
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        };

        await lifecycle.db.insertInto('specs').values(spec).execute();

        mockedReaddir.mockResolvedValue(['12345678-1234-4abc-8def-123456789012.md'] as any);

        mockParser.parseFile.mockResolvedValue({
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'New Name',
          phase: 'design',
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T15:30:00',
        });

        const report = await checker.check(specsDir);

        expect(report.mismatch).toHaveLength(1);
        expect(report.mismatch[0].differences).toHaveLength(3);
        expect(report.mismatch[0].differences).toContainEqual(
          expect.stringContaining('Name mismatch')
        );
        expect(report.mismatch[0].differences).toContainEqual(
          expect.stringContaining('Phase mismatch')
        );
        expect(report.mismatch[0].differences).toContainEqual(
          expect.stringContaining('Updated time mismatch')
        );
      });
    });

    describe('パースエラーの処理', () => {
      it('パースエラーが発生した場合、mismatchに含める', async () => {
        const specsDir = '/path/to/specs';

        const spec: NewSpec = {
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Test Spec',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_project_item_id: null,
          github_milestone_id: null,
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        };

        await lifecycle.db.insertInto('specs').values(spec).execute();

        mockedReaddir.mockResolvedValue(['12345678-1234-4abc-8def-123456789012.md'] as any);

        mockParser.parseFile.mockRejectedValue(new Error('Parse error'));

        const report = await checker.check(specsDir);

        expect(report.mismatch).toHaveLength(1);
        expect(report.mismatch[0].id).toBe('12345678-1234-4abc-8def-123456789012');
        expect(report.mismatch[0].differences).toEqual(['Parse error: Parse error']);
      });
    });

    describe('同期率の計算', () => {
      it('すべて同期されている場合、100%を返す', async () => {
        const specsDir = '/path/to/specs';

        const spec: NewSpec = {
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Test',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_project_item_id: null,
          github_milestone_id: null,
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        };

        await lifecycle.db.insertInto('specs').values(spec).execute();

        mockedReaddir.mockResolvedValue(['12345678-1234-4abc-8def-123456789012.md'] as any);

        mockParser.parseFile.mockResolvedValue({
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Test',
          phase: 'requirements',
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        });

        const report = await checker.check(specsDir);
        expect(report.syncRate).toBe(100);
      });

      it('半分だけ同期されている場合、50%を返す', async () => {
        const specsDir = '/path/to/specs';

        const spec1: NewSpec = {
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Synced',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_project_item_id: null,
          github_milestone_id: null,
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        };

        await lifecycle.db.insertInto('specs').values(spec1).execute();

        mockedReaddir.mockResolvedValue([
          '12345678-1234-4abc-8def-123456789012.md',
          'abcdef01-2345-4678-9abc-def012345678.md', // DBにない
        ] as any);

        mockParser.parseFile
          .mockResolvedValueOnce({
            id: '12345678-1234-4abc-8def-123456789012',
            name: 'Synced',
            phase: 'requirements',
            created_at: '2025-11-19T10:00:00',
            updated_at: '2025-11-19T10:00:00',
          })
          .mockResolvedValueOnce({
            id: 'abcdef01-2345-4678-9abc-def012345678',
            name: 'Not in DB',
            phase: 'design',
            created_at: '2025-11-19T11:00:00',
            updated_at: '2025-11-19T11:00:00',
          });

        const report = await checker.check(specsDir);

        // 2ファイル中1ファイルが同期済み = 50%
        expect(report.syncRate).toBe(50);
      });

      it('ファイルがない場合、0%を返す', async () => {
        const specsDir = '/path/to/specs';
        mockedReaddir.mockResolvedValue([]);

        const report = await checker.check(specsDir);
        expect(report.syncRate).toBe(0);
      });
    });

    describe('混合ケース', () => {
      it('filesOnly、dbOnly、mismatch、syncedが混在する場合を正しく処理する', async () => {
        const specsDir = '/path/to/specs';

        // DB内のデータ
        const specs: NewSpec[] = [
          {
            id: '11111111-1111-4111-8111-111111111111', // ファイルと完全一致
            name: 'Synced',
            description: null,
            phase: 'requirements',
            github_issue_id: null,
            github_project_id: null,
            github_project_item_id: null,
            github_milestone_id: null,
            created_at: '2025-11-19T10:00:00',
            updated_at: '2025-11-19T10:00:00',
          },
          {
            id: '22222222-2222-4222-8222-222222222222', // ファイルと名前が異なる
            name: 'Old Name',
            description: null,
            phase: 'design',
            github_issue_id: null,
            github_project_id: null,
            github_project_item_id: null,
            github_milestone_id: null,
            created_at: '2025-11-19T11:00:00',
            updated_at: '2025-11-19T11:00:00',
          },
          {
            id: '33333333-3333-4333-8333-333333333333', // ファイルがない
            name: 'Deleted',
            description: null,
            phase: 'tasks',
            github_issue_id: null,
            github_project_id: null,
            github_project_item_id: null,
            github_milestone_id: null,
            created_at: '2025-11-19T12:00:00',
            updated_at: '2025-11-19T12:00:00',
          },
        ];

        for (const spec of specs) {
          await lifecycle.db.insertInto('specs').values(spec).execute();
        }

        // ファイルシステムのデータ
        mockedReaddir.mockResolvedValue([
          '11111111-1111-4111-8111-111111111111.md', // DB と一致
          '22222222-2222-4222-8222-222222222222.md', // DB と名前が異なる
          '44444444-4444-4444-8444-444444444444.md', // DB にない
        ] as any);

        mockParser.parseFile
          .mockResolvedValueOnce({
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Synced',
            phase: 'requirements',
            created_at: '2025-11-19T10:00:00',
            updated_at: '2025-11-19T10:00:00',
          })
          .mockResolvedValueOnce({
            id: '22222222-2222-4222-8222-222222222222',
            name: 'New Name',
            phase: 'design',
            created_at: '2025-11-19T11:00:00',
            updated_at: '2025-11-19T11:00:00',
          })
          .mockResolvedValueOnce({
            id: '44444444-4444-4444-8444-444444444444',
            name: 'Not in DB',
            phase: 'implementation',
            created_at: '2025-11-19T13:00:00',
            updated_at: '2025-11-19T13:00:00',
          });

        const report = await checker.check(specsDir);

        expect(report.synced).toEqual(['11111111-1111-4111-8111-111111111111']);
        expect(report.mismatch).toHaveLength(1);
        expect(report.mismatch[0].id).toBe('22222222-2222-4222-8222-222222222222');
        expect(report.filesOnly).toEqual(['44444444-4444-4444-8444-444444444444']);
        expect(report.dbOnly).toEqual(['33333333-3333-4333-8333-333333333333']);
        expect(report.totalFiles).toBe(3);
        expect(report.totalDbRecords).toBe(3);

        // 3ファイル中1ファイルが同期済み = 33% (小数点切り捨て)
        expect(report.syncRate).toBe(33);
      });
    });

    describe('エッジケース', () => {
      it('空のディレクトリと空のDBを処理できる', async () => {
        const specsDir = '/path/to/empty';
        mockedReaddir.mockResolvedValue([]);

        const report = await checker.check(specsDir);

        expect(report.filesOnly).toEqual([]);
        expect(report.dbOnly).toEqual([]);
        expect(report.mismatch).toEqual([]);
        expect(report.synced).toEqual([]);
        expect(report.totalFiles).toBe(0);
        expect(report.totalDbRecords).toBe(0);
        expect(report.syncRate).toBe(0);
      });

      it('.md以外のファイルは無視される', async () => {
        const specsDir = '/path/to/specs';

        mockedReaddir.mockResolvedValue([
          '12345678-1234-4abc-8def-123456789012.md',
          'readme.txt',
          'image.png',
          '.gitignore',
        ] as any);

        const report = await checker.check(specsDir);

        // .mdファイルのみカウントされる
        expect(report.totalFiles).toBe(1);
      });

      it('大量のファイルとレコードを処理できる', async () => {
        const specsDir = '/path/to/specs';
        const count = 100;

        // 大量のDBレコード
        const specs: NewSpec[] = Array.from({ length: count }, (_, i) => ({
          id: `${i.toString().padStart(8, '0')}-0000-4000-8000-000000000000`,
          name: `Spec ${i.toString().padStart(8, '0')}-0000-4000-8000-000000000000`,
          description: null,
          phase: 'requirements' as const,
          github_issue_id: null,
          github_project_id: null,
          github_project_item_id: null,
          github_milestone_id: null,
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        }));

        for (const spec of specs) {
          await lifecycle.db.insertInto('specs').values(spec).execute();
        }

        // 大量のファイル
        const files = specs.map((s) => `${s.id}.md`);
        mockedReaddir.mockResolvedValue(files as any);

        mockParser.parseFile.mockImplementation((path) => {
          const id = path.split('/').pop()?.replace('.md', '') || '';
          return Promise.resolve({
            id,
            name: `Spec ${id}`,
            phase: 'requirements',
            created_at: '2025-11-19T10:00:00',
            updated_at: '2025-11-19T10:00:00',
          });
        });

        const report = await checker.check(specsDir);

        expect(report.synced).toHaveLength(count);
        expect(report.syncRate).toBe(100);
      });

      it('ミリ秒の差は無視される（秒単位での比較）', async () => {
        const specsDir = '/path/to/specs';

        const spec: NewSpec = {
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Test',
          description: null,
          phase: 'requirements',
          github_issue_id: null,
          github_project_id: null,
          github_project_item_id: null,
          github_milestone_id: null,
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
          created_at: '2025-11-19T10:00:00',
          updated_at: '2025-11-19T10:00:00',
        };

        await lifecycle.db.insertInto('specs').values(spec).execute();

        mockedReaddir.mockResolvedValue(['12345678-1234-4abc-8def-123456789012.md'] as any);

        mockParser.parseFile.mockResolvedValue({
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'Test',
          phase: 'requirements',
          created_at: '2025-11-19T10:00:00', // ミリ秒なし
          updated_at: '2025-11-19T10:00:00', // ミリ秒なし
        });

        const report = await checker.check(specsDir);

        // ミリ秒の差は無視され、同期済みとして扱われる
        expect(report.synced).toEqual(['12345678-1234-4abc-8def-123456789012']);
        expect(report.mismatch).toEqual([]);
      });
    });
  });
});
