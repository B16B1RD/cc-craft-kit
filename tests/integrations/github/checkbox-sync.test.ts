/**
 * チェックボックス双方向同期テスト
 */
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { randomUUID } from 'crypto';
import * as fs from 'node:fs';
import {
  parseCheckboxes,
  generateCheckboxHash,
  detectCheckboxChanges,
  applyCheckboxChanges,
  CheckboxSyncService,
  CheckboxItem,
  CheckboxChange,
  formatCheckboxChangeSummary,
} from '../../../src/integrations/github/checkbox-sync.js';

// ファイルシステム操作をモック化
jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
const mockWriteFileSync = fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>;

describe('parseCheckboxes', () => {
  test('基本的なチェックボックスを正しく抽出する', () => {
    const markdown = `
# テストセクション
- [ ] 未完了タスク1
- [x] 完了タスク1
- [ ] 未完了タスク2
`;

    const checkboxes = parseCheckboxes(markdown);

    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0]).toEqual({
      line: 3,
      text: '未完了タスク1',
      checked: false,
      section: 'テストセクション',
    });
    expect(checkboxes[1]).toEqual({
      line: 4,
      text: '完了タスク1',
      checked: true,
      section: 'テストセクション',
    });
    expect(checkboxes[2]).toEqual({
      line: 5,
      text: '未完了タスク2',
      checked: false,
      section: 'テストセクション',
    });
  });

  test('チェック済み（小文字x）を正しく判定する', () => {
    const markdown = `
- [x] 小文字xのチェック
- [X] 大文字Xのチェック
`;

    const checkboxes = parseCheckboxes(markdown);

    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(true);
  });

  test('未チェック（スペース）を正しく判定する', () => {
    const markdown = `
- [ ] 未チェック1
- [ ] 未チェック2
`;

    const checkboxes = parseCheckboxes(markdown);

    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(false);
  });

  test('複数のセクション見出しを正しく追跡する', () => {
    const markdown = `
# セクション1
- [ ] タスク1-1

## セクション2
- [ ] タスク2-1

### セクション3
- [x] タスク3-1
`;

    const checkboxes = parseCheckboxes(markdown);

    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0].section).toBe('セクション1');
    expect(checkboxes[1].section).toBe('セクション2');
    expect(checkboxes[2].section).toBe('セクション3');
  });

  test('インデントされたチェックボックスを正しく抽出する', () => {
    const markdown = `
# リスト
- [ ] レベル1
  - [ ] レベル2
    - [x] レベル3
`;

    const checkboxes = parseCheckboxes(markdown);

    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0].text).toBe('レベル1');
    expect(checkboxes[1].text).toBe('レベル2');
    expect(checkboxes[2].text).toBe('レベル3');
    expect(checkboxes[2].checked).toBe(true);
  });

  test('空の Markdown ではチェックボックスを返さない', () => {
    const markdown = '';

    const checkboxes = parseCheckboxes(markdown);

    expect(checkboxes).toHaveLength(0);
  });

  test('チェックボックスがない Markdown ではチェックボックスを返さない', () => {
    const markdown = `
# 通常のテキスト
これは段落です。

- 通常のリスト項目
- もう一つのリスト項目
`;

    const checkboxes = parseCheckboxes(markdown);

    expect(checkboxes).toHaveLength(0);
  });

  test('セクションなしのチェックボックスは空文字列のセクションを持つ', () => {
    const markdown = `
- [ ] セクションなしタスク
`;

    const checkboxes = parseCheckboxes(markdown);

    expect(checkboxes).toHaveLength(1);
    expect(checkboxes[0].section).toBe('');
  });

  test('特殊文字を含むチェックボックステキストを正しく抽出する', () => {
    const markdown = `
- [ ] タスク with "quotes"
- [x] タスク with [brackets]
- [ ] タスク with **bold**
`;

    const checkboxes = parseCheckboxes(markdown);

    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0].text).toBe('タスク with "quotes"');
    expect(checkboxes[1].text).toBe('タスク with [brackets]');
    expect(checkboxes[2].text).toBe('タスク with **bold**');
  });
});

describe('generateCheckboxHash', () => {
  test('同じチェックボックスリストで同じハッシュを生成する', () => {
    const checkboxes: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: false, section: 'セクション' },
      { line: 2, text: 'タスク2', checked: true, section: 'セクション' },
    ];

    const hash1 = generateCheckboxHash(checkboxes);
    const hash2 = generateCheckboxHash(checkboxes);

    expect(hash1).toBe(hash2);
  });

  test('異なるチェックボックスリストで異なるハッシュを生成する', () => {
    const checkboxes1: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: false, section: 'セクション' },
    ];
    const checkboxes2: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: true, section: 'セクション' },
    ];

    const hash1 = generateCheckboxHash(checkboxes1);
    const hash2 = generateCheckboxHash(checkboxes2);

    expect(hash1).not.toBe(hash2);
  });

  test('空のリストで一貫したハッシュを生成する', () => {
    const hash1 = generateCheckboxHash([]);
    const hash2 = generateCheckboxHash([]);

    expect(hash1).toBe(hash2);
  });

  test('順序が異なる場合は異なるハッシュを生成する', () => {
    const checkboxes1: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: false, section: 'セクション' },
      { line: 2, text: 'タスク2', checked: true, section: 'セクション' },
    ];
    const checkboxes2: CheckboxItem[] = [
      { line: 1, text: 'タスク2', checked: true, section: 'セクション' },
      { line: 2, text: 'タスク1', checked: false, section: 'セクション' },
    ];

    const hash1 = generateCheckboxHash(checkboxes1);
    const hash2 = generateCheckboxHash(checkboxes2);

    expect(hash1).not.toBe(hash2);
  });

  test('行番号の違いは無視される（テキストと状態のみがハッシュに影響）', () => {
    const checkboxes1: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: false, section: 'セクション' },
    ];
    const checkboxes2: CheckboxItem[] = [
      { line: 999, text: 'タスク1', checked: false, section: 'セクション' },
    ];

    const hash1 = generateCheckboxHash(checkboxes1);
    const hash2 = generateCheckboxHash(checkboxes2);

    expect(hash1).toBe(hash2);
  });
});

describe('detectCheckboxChanges', () => {
  test('チェック状態の変更を正しく検出する', () => {
    const source: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: true, section: 'セクション' },
      { line: 2, text: 'タスク2', checked: false, section: 'セクション' },
    ];
    const target: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: false, section: 'セクション' },
      { line: 2, text: 'タスク2', checked: false, section: 'セクション' },
    ];

    const changes = detectCheckboxChanges(source, target);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      text: 'タスク1',
      section: 'セクション',
      oldValue: false,
      newValue: true,
    });
  });

  test('変更がない場合は空配列を返す', () => {
    const source: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: false, section: 'セクション' },
      { line: 2, text: 'タスク2', checked: true, section: 'セクション' },
    ];
    const target: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: false, section: 'セクション' },
      { line: 2, text: 'タスク2', checked: true, section: 'セクション' },
    ];

    const changes = detectCheckboxChanges(source, target);

    expect(changes).toHaveLength(0);
  });

  test('複数の変更を正しく検出する', () => {
    const source: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: true, section: 'セクション' },
      { line: 2, text: 'タスク2', checked: true, section: 'セクション' },
      { line: 3, text: 'タスク3', checked: false, section: 'セクション' },
    ];
    const target: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: false, section: 'セクション' },
      { line: 2, text: 'タスク2', checked: false, section: 'セクション' },
      { line: 3, text: 'タスク3', checked: false, section: 'セクション' },
    ];

    const changes = detectCheckboxChanges(source, target);

    expect(changes).toHaveLength(2);
    expect(changes[0].text).toBe('タスク1');
    expect(changes[0].newValue).toBe(true);
    expect(changes[1].text).toBe('タスク2');
    expect(changes[1].newValue).toBe(true);
  });

  test('ターゲットにない項目は無視される', () => {
    const source: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: true, section: 'セクション' },
      { line: 2, text: 'タスク2', checked: true, section: 'セクション' },
    ];
    const target: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: false, section: 'セクション' },
    ];

    const changes = detectCheckboxChanges(source, target);

    expect(changes).toHaveLength(1);
    expect(changes[0].text).toBe('タスク1');
  });

  test('空のソースリストの場合は変更なし', () => {
    const source: CheckboxItem[] = [];
    const target: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: false, section: 'セクション' },
    ];

    const changes = detectCheckboxChanges(source, target);

    expect(changes).toHaveLength(0);
  });

  test('空のターゲットリストの場合は変更なし', () => {
    const source: CheckboxItem[] = [
      { line: 1, text: 'タスク1', checked: true, section: 'セクション' },
    ];
    const target: CheckboxItem[] = [];

    const changes = detectCheckboxChanges(source, target);

    expect(changes).toHaveLength(0);
  });
});

describe('applyCheckboxChanges', () => {
  test('単一のチェックボックス変更を正しく適用する', () => {
    const markdown = `
# セクション
- [ ] タスク1
- [ ] タスク2
`;

    const changes: CheckboxChange[] = [
      {
        text: 'タスク1',
        section: 'セクション',
        oldValue: false,
        newValue: true,
      },
    ];

    const result = applyCheckboxChanges(markdown, changes);

    expect(result).toContain('- [x] タスク1');
    expect(result).toContain('- [ ] タスク2');
  });

  test('複数のチェックボックス変更を正しく適用する', () => {
    const markdown = `
# セクション
- [ ] タスク1
- [ ] タスク2
- [x] タスク3
`;

    const changes: CheckboxChange[] = [
      {
        text: 'タスク1',
        section: 'セクション',
        oldValue: false,
        newValue: true,
      },
      {
        text: 'タスク3',
        section: 'セクション',
        oldValue: true,
        newValue: false,
      },
    ];

    const result = applyCheckboxChanges(markdown, changes);

    expect(result).toContain('- [x] タスク1');
    expect(result).toContain('- [ ] タスク2');
    expect(result).toContain('- [ ] タスク3');
  });

  test('変更がない場合は元の Markdown をそのまま返す', () => {
    const markdown = `
# セクション
- [ ] タスク1
- [x] タスク2
`;

    const changes: CheckboxChange[] = [];

    const result = applyCheckboxChanges(markdown, changes);

    expect(result).toBe(markdown);
  });

  test('チェックボックスのインデントを保持する', () => {
    const markdown = `
# セクション
- [ ] レベル1
  - [ ] レベル2
    - [ ] レベル3
`;

    const changes: CheckboxChange[] = [
      {
        text: 'レベル2',
        section: 'セクション',
        oldValue: false,
        newValue: true,
      },
    ];

    const result = applyCheckboxChanges(markdown, changes);

    expect(result).toContain('  - [x] レベル2');
  });

  test('チェックボックスのテキストにスペースが含まれる場合も正しく処理する', () => {
    const markdown = `
# セクション
- [ ] タスク with spaces
`;

    const changes: CheckboxChange[] = [
      {
        text: 'タスク with spaces',
        section: 'セクション',
        oldValue: false,
        newValue: true,
      },
    ];

    const result = applyCheckboxChanges(markdown, changes);

    expect(result).toContain('- [x] タスク with spaces');
  });

  test('変更対象外のチェックボックスは変更されない', () => {
    const markdown = `
# セクション
- [ ] タスク1
- [x] タスク2
- [ ] タスク3
`;

    const changes: CheckboxChange[] = [
      {
        text: 'タスク1',
        section: 'セクション',
        oldValue: false,
        newValue: true,
      },
    ];

    const result = applyCheckboxChanges(markdown, changes);

    expect(result).toContain('- [x] タスク1');
    expect(result).toContain('- [x] タスク2'); // 元々チェック済み
    expect(result).toContain('- [ ] タスク3'); // 変更対象外
  });

  test('存在しないチェックボックスへの変更は無視される', () => {
    const markdown = `
# セクション
- [ ] タスク1
`;

    const changes: CheckboxChange[] = [
      {
        text: '存在しないタスク',
        section: 'セクション',
        oldValue: false,
        newValue: true,
      },
    ];

    const result = applyCheckboxChanges(markdown, changes);

    expect(result).toBe(markdown);
  });
});

describe('formatCheckboxChangeSummary', () => {
  test('変更なしの場合は「変更なし」を返す', () => {
    const changes: CheckboxChange[] = [];

    const summary = formatCheckboxChangeSummary(changes);

    expect(summary).toBe('変更なし');
  });

  test('完了変更のみの場合は「X 件完了」を返す', () => {
    const changes: CheckboxChange[] = [
      {
        text: 'タスク1',
        section: 'セクション',
        oldValue: false,
        newValue: true,
      },
      {
        text: 'タスク2',
        section: 'セクション',
        oldValue: false,
        newValue: true,
      },
    ];

    const summary = formatCheckboxChangeSummary(changes);

    expect(summary).toBe('2 件完了');
  });

  test('未完了変更のみの場合は「X 件未完了に変更」を返す', () => {
    const changes: CheckboxChange[] = [
      {
        text: 'タスク1',
        section: 'セクション',
        oldValue: true,
        newValue: false,
      },
    ];

    const summary = formatCheckboxChangeSummary(changes);

    expect(summary).toBe('1 件未完了に変更');
  });

  test('完了と未完了の混在の場合は両方を含む', () => {
    const changes: CheckboxChange[] = [
      {
        text: 'タスク1',
        section: 'セクション',
        oldValue: false,
        newValue: true,
      },
      {
        text: 'タスク2',
        section: 'セクション',
        oldValue: true,
        newValue: false,
      },
      {
        text: 'タスク3',
        section: 'セクション',
        oldValue: false,
        newValue: true,
      },
    ];

    const summary = formatCheckboxChangeSummary(changes);

    expect(summary).toBe('2 件完了、1 件未完了に変更');
  });
});

describe('CheckboxSyncService', () => {
  let lifecycle: DatabaseLifecycle;
  let syncService: CheckboxSyncService;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
    syncService = new CheckboxSyncService(lifecycle.db);

    // ファイルシステムモックをリセット
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  describe('syncToSpec', () => {
    test('Issue から仕様書へチェックボックス状態を同期する', async () => {
      const specId = randomUUID();
      const specPath = '/tmp/test-spec.md';

      const specContent = `
# テスト仕様書
- [ ] タスク1
- [ ] タスク2
`;

      const issueBody = `
# テスト仕様書
- [x] タスク1
- [ ] タスク2
`;

      mockReadFileSync.mockReturnValue(specContent);

      // 仕様書レコードを作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: null,
          phase: 'requirements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコードを作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: specId,
          github_id: '123',
          github_number: 123,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      const result = await syncService.syncToSpec(specId, specPath, issueBody);

      expect(result.success).toBe(true);
      expect(result.direction).toBe('to_spec');
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].text).toBe('タスク1');
      expect(result.changes[0].oldValue).toBe(false);
      expect(result.changes[0].newValue).toBe(true);
      expect(result.message).toBe('1 件のチェックボックスを仕様書に反映しました');

      // ファイルが書き込まれたことを確認
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        specPath,
        expect.stringContaining('- [x] タスク1'),
        'utf-8'
      );
    });

    test('変更がない場合はファイルを更新しない', async () => {
      const specId = randomUUID();
      const specPath = '/tmp/test-spec.md';

      const specContent = `
# テスト仕様書
- [x] タスク1
- [ ] タスク2
`;

      const issueBody = `
# テスト仕様書
- [x] タスク1
- [ ] タスク2
`;

      mockReadFileSync.mockReturnValue(specContent);

      const result = await syncService.syncToSpec(specId, specPath, issueBody);

      expect(result.success).toBe(true);
      expect(result.direction).toBe('to_spec');
      expect(result.changes).toHaveLength(0);
      expect(result.message).toBe('チェックボックスに変更はありません');

      // ファイルが書き込まれていないことを確認
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    test('ファイル読み込みエラーの場合は失敗を返す', async () => {
      const specId = randomUUID();
      const specPath = '/tmp/nonexistent.md';

      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const result = await syncService.syncToSpec(specId, specPath, '');

      expect(result.success).toBe(false);
      expect(result.direction).toBe('to_spec');
      expect(result.changes).toHaveLength(0);
      expect(result.message).toContain('ENOENT');
    });

    test('ファイル書き込みエラーの場合は失敗を返す', async () => {
      const specId = randomUUID();
      const specPath = '/tmp/test-spec.md';

      const specContent = `
# テスト仕様書
- [ ] タスク1
`;

      const issueBody = `
# テスト仕様書
- [x] タスク1
`;

      mockReadFileSync.mockReturnValue(specContent);
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = await syncService.syncToSpec(specId, specPath, issueBody);

      expect(result.success).toBe(false);
      expect(result.direction).toBe('to_spec');
      expect(result.message).toContain('EACCES');
    });
  });

  describe('syncToIssue', () => {
    test('仕様書から Issue へ同期する（ステータス更新のみ）', async () => {
      const specId = randomUUID();
      const specPath = '/tmp/test-spec.md';

      const specContent = `
# テスト仕様書
- [x] タスク1
- [ ] タスク2
`;

      mockReadFileSync.mockReturnValue(specContent);

      // 仕様書レコードを作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: null,
          phase: 'requirements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコードを作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: specId,
          github_id: '123',
          github_number: 123,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      const result = await syncService.syncToIssue(specId, specPath);

      expect(result.success).toBe(true);
      expect(result.direction).toBe('to_issue');
      expect(result.changes).toHaveLength(0);
      expect(result.message).toBe('Issue 本文は仕様書の更新時に自動同期されます');

      // last_synced_at が更新されたことを確認
      const syncRecord = await lifecycle.db
        .selectFrom('github_sync')
        .where('entity_id', '=', specId)
        .where('entity_type', '=', 'spec')
        .selectAll()
        .executeTakeFirst();

      expect(syncRecord?.sync_status).toBe('success');
      expect(syncRecord?.last_synced_at).toBeTruthy();
    });

    test('ファイル読み込みエラーの場合は失敗を返す', async () => {
      const specId = randomUUID();
      const specPath = '/tmp/nonexistent.md';

      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const result = await syncService.syncToIssue(specId, specPath);

      expect(result.success).toBe(false);
      expect(result.direction).toBe('to_issue');
      expect(result.message).toContain('ENOENT');
    });
  });
});
