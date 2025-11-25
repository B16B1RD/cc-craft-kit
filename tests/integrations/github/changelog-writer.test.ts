/**
 * 変更履歴の要約記録モジュールのテスト
 */
import {
  parseSections,
  generateDiffSummary,
  detectChanges,
  buildChangelogComment,
  formatChangeSummary,
  type ChangelogEntry,
  type ChangeType,
} from '../../../src/integrations/github/changelog-writer.js';

describe('changelog-writer', () => {
  describe('parseSections', () => {
    describe('基本的なセクション解析', () => {
      test('単一の見出しを解析できる', () => {
        const markdown = `# タイトル

コンテンツ`;

        const sections = parseSections(markdown);

        expect(sections.size).toBe(1);
        expect(sections.has('タイトル')).toBe(true);
        expect(sections.get('タイトル')).toContain('# タイトル');
        expect(sections.get('タイトル')).toContain('コンテンツ');
      });

      test('複数の見出しを解析できる', () => {
        const markdown = `# セクション1

コンテンツ1

# セクション2

コンテンツ2`;

        const sections = parseSections(markdown);

        expect(sections.size).toBe(2);
        expect(sections.has('セクション1')).toBe(true);
        expect(sections.has('セクション2')).toBe(true);
        expect(sections.get('セクション1')).toContain('コンテンツ1');
        expect(sections.get('セクション2')).toContain('コンテンツ2');
      });

      test('見出しレベル H1 から H6 まで解析できる', () => {
        const markdown = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;

        const sections = parseSections(markdown);

        expect(sections.size).toBe(6);
        expect(sections.has('H1')).toBe(true);
        expect(sections.has('H2')).toBe(true);
        expect(sections.has('H3')).toBe(true);
        expect(sections.has('H4')).toBe(true);
        expect(sections.has('H5')).toBe(true);
        expect(sections.has('H6')).toBe(true);
      });

      test('見出しの前後の空白を正しく処理する', () => {
        const markdown = `#   タイトル

コンテンツ`;

        const sections = parseSections(markdown);

        expect(sections.size).toBe(1);
        expect(sections.has('タイトル')).toBe(true); // trim されている
      });
    });

    describe('ネストされた見出し', () => {
      test('親子関係のある見出しを正しく解析する', () => {
        const markdown = `# 親見出し

親のコンテンツ

## 子見出し

子のコンテンツ`;

        const sections = parseSections(markdown);

        expect(sections.size).toBe(2);
        expect(sections.has('親見出し')).toBe(true);
        expect(sections.has('子見出し')).toBe(true);
        expect(sections.get('親見出し')).toContain('親のコンテンツ');
        // 親見出しのセクションには子見出しまで含まれる（実装の仕様）
        expect(sections.get('親見出し')).toContain('子見出し');
        expect(sections.get('子見出し')).toContain('子のコンテンツ');
      });

      test('複数レベルのネストを正しく処理する', () => {
        const markdown = `# レベル1

L1 コンテンツ

## レベル2

L2 コンテンツ

### レベル3

L3 コンテンツ

## レベル2-2

L2-2 コンテンツ`;

        const sections = parseSections(markdown);

        expect(sections.size).toBe(4);
        expect(sections.has('レベル1')).toBe(true);
        expect(sections.has('レベル2')).toBe(true);
        expect(sections.has('レベル3')).toBe(true);
        expect(sections.has('レベル2-2')).toBe(true);
      });

      test('同じレベルの見出しが続く場合に正しく区切る', () => {
        const markdown = `## セクションA

コンテンツA

## セクションB

コンテンツB`;

        const sections = parseSections(markdown);

        expect(sections.size).toBe(2);
        expect(sections.get('セクションA')).toContain('コンテンツA');
        expect(sections.get('セクションA')).not.toContain('コンテンツB');
        expect(sections.get('セクションB')).toContain('コンテンツB');
        expect(sections.get('セクションB')).not.toContain('コンテンツA');
      });
    });

    describe('エッジケース', () => {
      test('空の Markdown を解析する', () => {
        const sections = parseSections('');

        expect(sections.size).toBe(0);
      });

      test('見出しのみの Markdown を解析する', () => {
        const markdown = `# タイトル`;

        const sections = parseSections(markdown);

        expect(sections.size).toBe(1);
        expect(sections.get('タイトル')).toBe('# タイトル');
      });

      test('見出しがない Markdown を解析する', () => {
        const markdown = `これは見出しではありません

ただのテキストです`;

        const sections = parseSections(markdown);

        expect(sections.size).toBe(0);
      });

      test('無効な見出し（# の後に空白がない）は無視する', () => {
        const markdown = `#無効な見出し

# 有効な見出し`;

        const sections = parseSections(markdown);

        expect(sections.size).toBe(1);
        expect(sections.has('有効な見出し')).toBe(true);
        expect(sections.has('無効な見出し')).toBe(false);
      });
    });
  });

  describe('generateDiffSummary', () => {
    describe('チェックボックスの変更検出', () => {
      test('チェックボックスが追加された場合', () => {
        const oldContent = `- [x] 既存項目1
- [ ] 既存項目2`;
        const newContent = `- [x] 既存項目1
- [ ] 既存項目2
- [ ] 新規項目3
- [ ] 新規項目4`;

        const summary = generateDiffSummary(oldContent, newContent);

        expect(summary).toBe('2 件の項目を追加');
      });

      test('チェックボックスが削除された場合', () => {
        const oldContent = `- [x] 項目1
- [ ] 項目2
- [ ] 項目3`;
        const newContent = `- [x] 項目1`;

        const summary = generateDiffSummary(oldContent, newContent);

        expect(summary).toBe('2 件の項目を削除');
      });

      test('チェックボックスが完了された場合', () => {
        const oldContent = `- [ ] 項目1
- [ ] 項目2
- [ ] 項目3`;
        const newContent = `- [x] 項目1
- [x] 項目2
- [ ] 項目3`;

        const summary = generateDiffSummary(oldContent, newContent);

        expect(summary).toBe('2 件の項目を完了');
      });

      test('チェックボックスが未完了に変更された場合', () => {
        const oldContent = `- [x] 項目1
- [x] 項目2
- [x] 項目3`;
        const newContent = `- [ ] 項目1
- [x] 項目2
- [x] 項目3`;

        const summary = generateDiffSummary(oldContent, newContent);

        expect(summary).toBe('1 件の項目を未完了に変更');
      });

      test('大文字の X もチェック済みとして認識する', () => {
        const oldContent = `- [ ] 項目1
- [ ] 項目2`;
        const newContent = `- [X] 項目1
- [X] 項目2`;

        const summary = generateDiffSummary(oldContent, newContent);

        expect(summary).toBe('2 件の項目を完了');
      });
    });

    describe('行数の変更検出', () => {
      test('4行以上追加された場合', () => {
        const oldContent = `行1
行2`;
        const newContent = `行1
行2
行3
行4
行5
行6`;

        const summary = generateDiffSummary(oldContent, newContent);

        expect(summary).toBe('4 行を追加');
      });

      test('4行以上削除された場合', () => {
        const oldContent = `行1
行2
行3
行4
行5
行6`;
        const newContent = `行1
行2`;

        const summary = generateDiffSummary(oldContent, newContent);

        expect(summary).toBe('4 行を削除');
      });

      test('3行以下の変更は「内容を更新」となる', () => {
        const oldContent = `行1
行2`;
        const newContent = `行1
行2
行3
行4`;

        const summary = generateDiffSummary(oldContent, newContent);

        expect(summary).toBe('内容を更新');
      });

      test('空行はカウントしない', () => {
        const oldContent = `行1

行2

`;
        const newContent = `行1

行2

行3

行4

行5

行6`;

        const summary = generateDiffSummary(oldContent, newContent);

        expect(summary).toBe('4 行を追加'); // 空行を除いた差分
      });
    });

    describe('一般的な変更', () => {
      test('小さな変更は「内容を更新」となる', () => {
        const oldContent = `テキスト1`;
        const newContent = `テキスト2`;

        const summary = generateDiffSummary(oldContent, newContent);

        expect(summary).toBe('内容を更新');
      });

      test('変更なしの場合も「内容を更新」となる', () => {
        const oldContent = `同じ内容`;
        const newContent = `同じ内容`;

        const summary = generateDiffSummary(oldContent, newContent);

        expect(summary).toBe('内容を更新');
      });
    });

    describe('優先順位の確認', () => {
      test('チェックボックス追加/削除は行数変更より優先される', () => {
        const oldContent = `行1
行2`;
        const newContent = `行1
行2
- [ ] 新規項目1
- [ ] 新規項目2
行3
行4
行5`;

        const summary = generateDiffSummary(oldContent, newContent);

        expect(summary).toBe('2 件の項目を追加'); // 5行追加よりチェックボックスが優先
      });

      test('チェックボックス完了/未完了は追加/削除より優先される（数が同じ場合）', () => {
        const oldContent = `- [ ] 項目1
- [ ] 項目2`;
        const newContent = `- [x] 項目1
- [x] 項目2`;

        const summary = generateDiffSummary(oldContent, newContent);

        expect(summary).toBe('2 件の項目を完了'); // 数が同じなので完了状態の変更を検出
      });
    });
  });

  describe('detectChanges', () => {
    describe('追加されたセクション', () => {
      test('新しいセクションが追加された場合', () => {
        const oldContent = `# セクション1

コンテンツ1`;
        const newContent = `# セクション1

コンテンツ1

# セクション2

コンテンツ2`;

        const changes = detectChanges(oldContent, newContent);

        expect(changes).toHaveLength(1);
        expect(changes[0]).toEqual({
          type: 'added',
          section: 'セクション2',
          summary: '新規追加',
        });
      });

      test('複数のセクションが追加された場合', () => {
        const oldContent = `# セクション1

コンテンツ1`;
        const newContent = `# セクション1

コンテンツ1

# セクション2

コンテンツ2

# セクション3

コンテンツ3`;

        const changes = detectChanges(oldContent, newContent);

        expect(changes).toHaveLength(2);
        expect(changes.filter((c) => c.type === 'added')).toHaveLength(2);
        expect(changes.find((c) => c.section === 'セクション2')).toBeDefined();
        expect(changes.find((c) => c.section === 'セクション3')).toBeDefined();
      });
    });

    describe('削除されたセクション', () => {
      test('セクションが削除された場合', () => {
        const oldContent = `# セクション1

コンテンツ1

# セクション2

コンテンツ2`;
        const newContent = `# セクション1

コンテンツ1`;

        const changes = detectChanges(oldContent, newContent);

        expect(changes).toHaveLength(1);
        expect(changes[0]).toEqual({
          type: 'removed',
          section: 'セクション2',
          summary: '削除',
        });
      });

      test('複数のセクションが削除された場合', () => {
        const oldContent = `# セクション1

コンテンツ1

# セクション2

コンテンツ2

# セクション3

コンテンツ3`;
        const newContent = `# セクション2

コンテンツ2`;

        const changes = detectChanges(oldContent, newContent);

        expect(changes).toHaveLength(2);
        expect(changes.filter((c) => c.type === 'removed')).toHaveLength(2);
        expect(changes.find((c) => c.section === 'セクション1')).toBeDefined();
        expect(changes.find((c) => c.section === 'セクション3')).toBeDefined();
      });
    });

    describe('変更されたセクション', () => {
      test('セクションの内容が変更された場合', () => {
        const oldContent = `# セクション1

古いコンテンツ`;
        const newContent = `# セクション1

新しいコンテンツ`;

        const changes = detectChanges(oldContent, newContent);

        expect(changes).toHaveLength(1);
        expect(changes[0].type).toBe('modified');
        expect(changes[0].section).toBe('セクション1');
        expect(changes[0].summary).toBe('内容を更新');
      });

      test('チェックボックスの変更が検出される', () => {
        const oldContent = `# タスク

- [ ] 項目1
- [ ] 項目2`;
        const newContent = `# タスク

- [x] 項目1
- [x] 項目2`;

        const changes = detectChanges(oldContent, newContent);

        expect(changes).toHaveLength(1);
        expect(changes[0].type).toBe('modified');
        expect(changes[0].section).toBe('タスク');
        expect(changes[0].summary).toBe('2 件の項目を完了');
      });
    });

    describe('変更なしの場合', () => {
      test('同じ内容の場合は変更なし', () => {
        const content = `# セクション1

コンテンツ1

# セクション2

コンテンツ2`;

        const changes = detectChanges(content, content);

        expect(changes).toHaveLength(0);
      });

      test('空の Markdown 同士の比較', () => {
        const changes = detectChanges('', '');

        expect(changes).toHaveLength(0);
      });
    });

    describe('複合的な変更', () => {
      test('追加、削除、変更が混在する場合', () => {
        const oldContent = `# セクション1

古いコンテンツ1

# セクション2

コンテンツ2

# セクション3

コンテンツ3`;
        const newContent = `# セクション1

新しいコンテンツ1

# セクション2

コンテンツ2

# セクション4

コンテンツ4`;

        const changes = detectChanges(oldContent, newContent);

        expect(changes).toHaveLength(3);
        expect(changes.find((c) => c.type === 'modified' && c.section === 'セクション1')).toBeDefined();
        expect(changes.find((c) => c.type === 'added' && c.section === 'セクション4')).toBeDefined();
        expect(changes.find((c) => c.type === 'removed' && c.section === 'セクション3')).toBeDefined();
        // セクション2 は変更なしなので含まれない
        expect(changes.find((c) => c.section === 'セクション2')).toBeUndefined();
      });
    });
  });

  describe('buildChangelogComment', () => {
    describe('変更がある場合', () => {
      test('基本的なコメントを生成できる', () => {
        const changes: ChangelogEntry[] = [
          { type: 'added', section: 'セクション1', summary: '新規追加' },
          { type: 'modified', section: 'セクション2', summary: '内容を更新' },
          { type: 'removed', section: 'セクション3', summary: '削除' },
        ];

        const comment = buildChangelogComment(changes, 'spec-12345678');

        expect(comment).toContain('## 📝 仕様書更新');
        expect(comment).toContain('仕様書が更新されました。');
        expect(comment).toContain('### 変更内容');
        expect(comment).toContain('➕ **セクション1**: 新規追加');
        expect(comment).toContain('📝 **セクション2**: 内容を更新');
        expect(comment).toContain('➖ **セクション3**: 削除');
        expect(comment).toContain('**更新日時:**');
        expect(comment).toContain('**最新の仕様書:** [`.cc-craft-kit/specs/spec-12345678.md`]');
      });

      test('タイムスタンプが日本語形式で含まれる', () => {
        const changes: ChangelogEntry[] = [
          { type: 'added', section: 'テスト', summary: '新規追加' },
        ];

        const comment = buildChangelogComment(changes, 'spec-12345678');

        expect(comment).toMatch(/\*\*更新日時:\*\* \d{4}\/\d{2}\/\d{2} \d{2}:\d{2}/);
      });

      test('仕様書へのリンクが正しく生成される', () => {
        const changes: ChangelogEntry[] = [
          { type: 'added', section: 'テスト', summary: '新規追加' },
        ];

        const comment = buildChangelogComment(changes, 'spec-abcdefgh');

        expect(comment).toContain('[`.cc-craft-kit/specs/spec-abcdefgh.md`](../../.cc-craft-kit/specs/spec-abcdefgh.md)');
      });

      test('変更タイプごとに正しいアイコンが使用される', () => {
        const changes: ChangelogEntry[] = [
          { type: 'added', section: 'A', summary: '新規追加' },
          { type: 'modified', section: 'B', summary: '内容を更新' },
          { type: 'removed', section: 'C', summary: '削除' },
        ];

        const comment = buildChangelogComment(changes, 'spec-12345678');

        expect(comment).toContain('➕ **A**: 新規追加');
        expect(comment).toContain('📝 **B**: 内容を更新');
        expect(comment).toContain('➖ **C**: 削除');
      });
    });

    describe('コミットハッシュ付き', () => {
      test('コミットハッシュが含まれる場合、差分リンクが追加される', () => {
        const changes: ChangelogEntry[] = [
          { type: 'added', section: 'テスト', summary: '新規追加' },
        ];

        const comment = buildChangelogComment(changes, 'spec-12345678', 'abc123def456789');

        expect(comment).toContain('**差分:** [コミット abc123d](../../commit/abc123def456789)');
      });

      test('コミットハッシュが短い場合、7文字に切り詰められる', () => {
        const changes: ChangelogEntry[] = [
          { type: 'added', section: 'テスト', summary: '新規追加' },
        ];

        const comment = buildChangelogComment(changes, 'spec-12345678', '1234567890abcdef');

        expect(comment).toContain('[コミット 1234567]');
        expect(comment).toContain('(../../commit/1234567890abcdef)');
      });

      test('コミットハッシュがない場合、差分リンクは含まれない', () => {
        const changes: ChangelogEntry[] = [
          { type: 'added', section: 'テスト', summary: '新規追加' },
        ];

        const comment = buildChangelogComment(changes, 'spec-12345678');

        expect(comment).not.toContain('**差分:**');
      });
    });

    describe('変更がない場合', () => {
      test('空配列の場合は空文字を返す', () => {
        const comment = buildChangelogComment([], 'spec-12345678');

        expect(comment).toBe('');
      });

      test('空配列でコミットハッシュがある場合も空文字を返す', () => {
        const comment = buildChangelogComment([], 'spec-12345678', 'abc123');

        expect(comment).toBe('');
      });
    });

    describe('複数の変更が正しくフォーマットされる', () => {
      test('5件の変更が全て含まれる', () => {
        const changes: ChangelogEntry[] = [
          { type: 'added', section: 'セクション1', summary: '新規追加' },
          { type: 'added', section: 'セクション2', summary: '新規追加' },
          { type: 'modified', section: 'セクション3', summary: '2 件の項目を完了' },
          { type: 'modified', section: 'セクション4', summary: '内容を更新' },
          { type: 'removed', section: 'セクション5', summary: '削除' },
        ];

        const comment = buildChangelogComment(changes, 'spec-12345678');

        expect(comment).toContain('➕ **セクション1**: 新規追加');
        expect(comment).toContain('➕ **セクション2**: 新規追加');
        expect(comment).toContain('📝 **セクション3**: 2 件の項目を完了');
        expect(comment).toContain('📝 **セクション4**: 内容を更新');
        expect(comment).toContain('➖ **セクション5**: 削除');
      });
    });
  });

  describe('formatChangeSummary', () => {
    describe('追加のみ', () => {
      test('1件追加', () => {
        const changes: ChangelogEntry[] = [
          { type: 'added', section: 'A', summary: '新規追加' },
        ];

        const summary = formatChangeSummary(changes);

        expect(summary).toBe('1 件追加');
      });

      test('複数件追加', () => {
        const changes: ChangelogEntry[] = [
          { type: 'added', section: 'A', summary: '新規追加' },
          { type: 'added', section: 'B', summary: '新規追加' },
          { type: 'added', section: 'C', summary: '新規追加' },
        ];

        const summary = formatChangeSummary(changes);

        expect(summary).toBe('3 件追加');
      });
    });

    describe('削除のみ', () => {
      test('1件削除', () => {
        const changes: ChangelogEntry[] = [
          { type: 'removed', section: 'A', summary: '削除' },
        ];

        const summary = formatChangeSummary(changes);

        expect(summary).toBe('1 件削除');
      });

      test('複数件削除', () => {
        const changes: ChangelogEntry[] = [
          { type: 'removed', section: 'A', summary: '削除' },
          { type: 'removed', section: 'B', summary: '削除' },
        ];

        const summary = formatChangeSummary(changes);

        expect(summary).toBe('2 件削除');
      });
    });

    describe('変更のみ', () => {
      test('1件変更', () => {
        const changes: ChangelogEntry[] = [
          { type: 'modified', section: 'A', summary: '内容を更新' },
        ];

        const summary = formatChangeSummary(changes);

        expect(summary).toBe('1 件変更');
      });

      test('複数件変更', () => {
        const changes: ChangelogEntry[] = [
          { type: 'modified', section: 'A', summary: '内容を更新' },
          { type: 'modified', section: 'B', summary: '2 件の項目を完了' },
          { type: 'modified', section: 'C', summary: '5 行を追加' },
        ];

        const summary = formatChangeSummary(changes);

        expect(summary).toBe('3 件変更');
      });
    });

    describe('複合的な変更', () => {
      test('追加と削除', () => {
        const changes: ChangelogEntry[] = [
          { type: 'added', section: 'A', summary: '新規追加' },
          { type: 'added', section: 'B', summary: '新規追加' },
          { type: 'removed', section: 'C', summary: '削除' },
        ];

        const summary = formatChangeSummary(changes);

        expect(summary).toBe('2 件追加、1 件削除');
      });

      test('追加と変更', () => {
        const changes: ChangelogEntry[] = [
          { type: 'added', section: 'A', summary: '新規追加' },
          { type: 'modified', section: 'B', summary: '内容を更新' },
          { type: 'modified', section: 'C', summary: '内容を更新' },
        ];

        const summary = formatChangeSummary(changes);

        expect(summary).toBe('1 件追加、2 件変更');
      });

      test('削除と変更', () => {
        const changes: ChangelogEntry[] = [
          { type: 'removed', section: 'A', summary: '削除' },
          { type: 'modified', section: 'B', summary: '内容を更新' },
        ];

        const summary = formatChangeSummary(changes);

        expect(summary).toBe('1 件削除、1 件変更');
      });

      test('追加、削除、変更の全て', () => {
        const changes: ChangelogEntry[] = [
          { type: 'added', section: 'A', summary: '新規追加' },
          { type: 'added', section: 'B', summary: '新規追加' },
          { type: 'removed', section: 'C', summary: '削除' },
          { type: 'modified', section: 'D', summary: '内容を更新' },
          { type: 'modified', section: 'E', summary: '内容を更新' },
          { type: 'modified', section: 'F', summary: '内容を更新' },
        ];

        const summary = formatChangeSummary(changes);

        expect(summary).toBe('2 件追加、1 件削除、3 件変更');
      });
    });

    describe('変更なしの場合', () => {
      test('空配列の場合は「変更なし」', () => {
        const summary = formatChangeSummary([]);

        expect(summary).toBe('変更なし');
      });
    });

    describe('要約の順序', () => {
      test('追加、削除、変更の順で表示される', () => {
        const changes: ChangelogEntry[] = [
          { type: 'modified', section: 'A', summary: '内容を更新' },
          { type: 'removed', section: 'B', summary: '削除' },
          { type: 'added', section: 'C', summary: '新規追加' },
        ];

        const summary = formatChangeSummary(changes);

        // 順序を確認: 追加、削除、変更
        const parts = summary.split('、');
        expect(parts[0]).toBe('1 件追加');
        expect(parts[1]).toBe('1 件削除');
        expect(parts[2]).toBe('1 件変更');
      });
    });
  });
});
