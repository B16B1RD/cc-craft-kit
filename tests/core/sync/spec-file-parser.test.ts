/**
 * SpecFileParser テスト
 */
import { SpecFileParser, SpecParseError } from '../../../src/core/sync/spec-file-parser.js';
import { readFile } from 'fs/promises';

// fs/promises のモック
jest.mock('fs/promises');
const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>;

describe('SpecFileParser', () => {
  let parser: SpecFileParser;

  beforeEach(() => {
    parser = new SpecFileParser();
    jest.clearAllMocks();
  });

  describe('parseFile', () => {
    describe('正常系', () => {
      it('有効な仕様書ファイルを正しくパースできる', async () => {
        const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
        const content = `# テスト仕様書

**フェーズ:** design
**作成日時:** 2025/11/19 10:47:58
**更新日時:** 2025/11/19 15:30:00

## 概要
テストの概要
`;

        mockedReadFile.mockResolvedValue(content);

        const result = await parser.parseFile(filePath);

        expect(result).toEqual({
          id: '12345678-1234-4abc-8def-123456789012',
          name: 'テスト仕様書',
          phase: 'design',
          created_at: '2025-11-19T10:47:58',
          updated_at: '2025-11-19T15:30:00',
        });
      });

      it('すべてのフェーズを正しく認識できる', async () => {
        const phases = ['requirements', 'design', 'tasks', 'implementation', 'completed'];

        for (const phase of phases) {
          const filePath = `/path/to/12345678-1234-4abc-8def-123456789012.md`;
          const content = `# フェーズテスト\n\n**フェーズ:** ${phase}\n**作成日時:** 2025/11/19 10:00:00\n**更新日時:** 2025/11/19 10:00:00`;

          mockedReadFile.mockResolvedValue(content);

          const result = await parser.parseFile(filePath);
          expect(result.phase).toBe(phase);
        }
      });

      it('大文字のフェーズ名を小文字に変換する', async () => {
        const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
        const content = `# テスト\n\n**フェーズ:** DESIGN\n**作成日時:** 2025/11/19 10:00:00\n**更新日時:** 2025/11/19 10:00:00`;

        mockedReadFile.mockResolvedValue(content);

        const result = await parser.parseFile(filePath);
        expect(result.phase).toBe('design');
      });
    });

    describe('エラーケース', () => {
      it('ファイル読み込みエラーをSpecParseErrorに変換する', async () => {
        const filePath = '/path/to/invalid.md';
        const error = new Error('File not found');

        mockedReadFile.mockRejectedValue(error);

        await expect(parser.parseFile(filePath)).rejects.toThrow(SpecParseError);
        await expect(parser.parseFile(filePath)).rejects.toMatchObject({
          message: expect.stringContaining('Failed to read spec file'),
          filePath: filePath,
          cause: error,
        });
      });

      it('無効なUUID形式でSpecParseErrorをスローする', async () => {
        const filePath = '/path/to/invalid-uuid.md';
        const content = '# テスト';

        mockedReadFile.mockResolvedValue(content);

        await expect(parser.parseFile(filePath)).rejects.toThrow(SpecParseError);
        // parseFileはエラーをラップするので、ファイルパスのみチェック
        try {
          await parser.parseFile(filePath);
        } catch (error) {
          expect(error).toBeInstanceOf(SpecParseError);
          expect((error as SpecParseError).filePath).toBe(filePath);
        }
      });
    });
  });

  describe('parseContent', () => {
    describe('正常系', () => {
      it('完全な仕様書コンテンツをパースできる', () => {
        const filePath = '/path/to/abcdef12-3456-4789-abcd-ef1234567890.md';
        const content = `# 完全な仕様書

**フェーズ:** tasks
**作成日時:** 2025/11/19 08:30:15
**更新日時:** 2025/11/19 16:45:30

## 詳細
詳細な説明
`;

        const result = parser.parseContent(filePath, content);

        expect(result).toEqual({
          id: 'abcdef12-3456-4789-abcd-ef1234567890',
          name: '完全な仕様書',
          phase: 'tasks',
          created_at: '2025-11-19T08:30:15',
          updated_at: '2025-11-19T16:45:30',
        });
      });
    });
  });

  describe('extractId (private)', () => {
    it('有効なUUID v4を抽出できる', () => {
      const validUUIDs = [
        '12345678-1234-4abc-89ab-123456789012',
        'abcdef01-2345-4678-9abc-def012345678',
        'ffffffff-ffff-4fff-8fff-ffffffffffff',
      ];

      for (const uuid of validUUIDs) {
        const filePath = `/path/to/${uuid}.md`;
        const content = '# テスト\n\n**フェーズ:** requirements\n**作成日時:** 2025/11/19 10:00:00\n**更新日時:** 2025/11/19 10:00:00';
        const result = parser.parseContent(filePath, content);
        expect(result.id).toBe(uuid);
      }
    });

    it('無効なUUIDでエラーをスローする', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '12345678-1234-3abc-89ab-123456789012', // v3 UUID (4が3になっている)
        '12345678-1234-4abc-69ab-123456789012', // 無効な variant (8,9,a,b 以外)
        '12345678123445678901234567890123', // ハイフンなし
        '',
      ];

      for (const invalidUuid of invalidUUIDs) {
        const filePath = `/path/to/${invalidUuid}.md`;
        const content = '# テスト';
        expect(() => parser.parseContent(filePath, content)).toThrow(SpecParseError);
      }
    });
  });

  describe('extractTitle (private)', () => {
    it('先頭の#から始まる行をタイトルとして抽出する', () => {
      const content = '# メインタイトル\n\n本文';
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);
      expect(result.name).toBe('メインタイトル');
    });

    it('複数の#がある場合、最初の#をタイトルとする', () => {
      const content = '# 最初のタイトル\n\n## セクション\n\n# 2番目のタイトル';
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);
      expect(result.name).toBe('最初のタイトル');
    });

    it('#の後のスペースが複数ある場合も正しく処理する', () => {
      const content = '#    スペース多めタイトル   ';
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);
      expect(result.name).toBe('スペース多めタイトル');
    });

    it('タイトルがない場合はUntitledを返す', () => {
      const content = 'タイトルなし\n\n本文のみ';
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);
      expect(result.name).toBe('Untitled');
    });

    it('空のコンテンツの場合はUntitledを返す', () => {
      const content = '';
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);
      expect(result.name).toBe('Untitled');
    });
  });

  describe('extractPhase (private)', () => {
    it('有効なフェーズを抽出できる', () => {
      const testCases = [
        { phase: 'requirements', expected: 'requirements' },
        { phase: 'design', expected: 'design' },
        { phase: 'tasks', expected: 'tasks' },
        { phase: 'implementation', expected: 'implementation' },
        { phase: 'completed', expected: 'completed' },
      ];

      for (const { phase, expected } of testCases) {
        const content = `# テスト\n\n**フェーズ:** ${phase}`;
        const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
        const result = parser.parseContent(filePath, content);
        expect(result.phase).toBe(expected);
      }
    });

    it('フェーズが存在しない場合はデフォルト値を返す', () => {
      const content = '# テスト\n\n本文のみ';
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);
      expect(result.phase).toBe('requirements');
    });

    it('無効なフェーズの場合はデフォルト値を返す', () => {
      const content = '# テスト\n\n**フェーズ:** invalid_phase';
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);
      expect(result.phase).toBe('requirements');
    });
  });

  describe('extractCreatedAt (private)', () => {
    it('作成日時を正しく抽出してISO 8601形式に変換する', () => {
      const content = '# テスト\n\n**作成日時:** 2025/11/19 10:47:58';
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);
      expect(result.created_at).toBe('2025-11-19T10:47:58');
    });

    it('作成日時が存在しない場合は現在時刻を返す', () => {
      const content = '# テスト\n\n本文のみ';
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const beforeParse = new Date().toISOString();
      const result = parser.parseContent(filePath, content);
      const afterParse = new Date().toISOString();

      // 結果が現在時刻の範囲内にあることを確認
      expect(result.created_at >= beforeParse).toBe(true);
      expect(result.created_at <= afterParse).toBe(true);
    });

    it('異なる日時形式を正しく変換する', () => {
      const testCases = [
        { input: '2025/01/01 00:00:00', expected: '2025-01-01T00:00:00' },
        { input: '2025/12/31 23:59:59', expected: '2025-12-31T23:59:59' },
        { input: '2025/06/15 12:30:45', expected: '2025-06-15T12:30:45' },
      ];

      for (const { input, expected } of testCases) {
        const content = `# テスト\n\n**作成日時:** ${input}`;
        const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
        const result = parser.parseContent(filePath, content);
        expect(result.created_at).toBe(expected);
      }
    });
  });

  describe('extractUpdatedAt (private)', () => {
    it('更新日時を正しく抽出してISO 8601形式に変換する', () => {
      const content = '# テスト\n\n**更新日時:** 2025/11/19 15:30:45';
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);
      expect(result.updated_at).toBe('2025-11-19T15:30:45');
    });

    it('更新日時が存在しない場合は現在時刻を返す', () => {
      const content = '# テスト\n\n本文のみ';
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const beforeParse = new Date().toISOString();
      const result = parser.parseContent(filePath, content);
      const afterParse = new Date().toISOString();

      // 結果が現在時刻の範囲内にあることを確認
      expect(result.updated_at >= beforeParse).toBe(true);
      expect(result.updated_at <= afterParse).toBe(true);
    });
  });

  describe('convertToISO8601 (private)', () => {
    it('YYYY/MM/DD HH:MM:SS形式をISO 8601形式に変換する', () => {
      const testCases = [
        { input: '2025/11/19 10:47:58', expected: '2025-11-19T10:47:58' },
        { input: '2025/01/01 00:00:00', expected: '2025-01-01T00:00:00' },
        { input: '2025/12/31 23:59:59', expected: '2025-12-31T23:59:59' },
      ];

      for (const { input, expected } of testCases) {
        const content = `# テスト\n\n**作成日時:** ${input}\n**更新日時:** ${input}`;
        const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
        const result = parser.parseContent(filePath, content);
        expect(result.created_at).toBe(expected);
        expect(result.updated_at).toBe(expected);
      }
    });
  });

  describe('エッジケース', () => {
    it('空のファイルを処理できる', () => {
      const content = '';
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);

      expect(result.id).toBe('12345678-1234-4abc-8def-123456789012');
      expect(result.name).toBe('Untitled');
      expect(result.phase).toBe('requirements');
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('改行のみのファイルを処理できる', () => {
      const content = '\n\n\n';
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);

      expect(result.name).toBe('Untitled');
      expect(result.phase).toBe('requirements');
    });

    it('非常に長いタイトルを処理できる', () => {
      const longTitle = 'A'.repeat(1000);
      const content = `# ${longTitle}\n\n**フェーズ:** design`;
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);

      expect(result.name).toBe(longTitle);
    });

    it('特殊文字を含むタイトルを処理できる', () => {
      const specialTitle = '日本語タイトル & <特殊文字> "クォート" \'シングル\'';
      const content = `# ${specialTitle}\n\n**フェーズ:** design`;
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);

      expect(result.name).toBe(specialTitle);
    });

    it('複数の空白行を含むコンテンツを処理できる', () => {
      const content = `


# タイトル


**フェーズ:** implementation


**作成日時:** 2025/11/19 10:00:00


**更新日時:** 2025/11/19 10:00:00


`;
      const filePath = '/path/to/12345678-1234-4abc-8def-123456789012.md';
      const result = parser.parseContent(filePath, content);

      expect(result.name).toBe('タイトル');
      expect(result.phase).toBe('implementation');
    });
  });
});
