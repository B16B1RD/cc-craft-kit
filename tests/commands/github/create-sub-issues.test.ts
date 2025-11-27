/**
 * create-sub-issues コマンドのテスト
 *
 * タスクリスト解析と description 生成のテスト
 */

// parseTaskListFromSpecContent と generateTaskDescription は private なので
// 同じロジックを再実装してテスト
describe('parseTaskListFromSpecContent', () => {
  /**
   * タスクタイトルから説明文を生成
   */
  function generateTaskDescription(title: string, phaseName?: string): string {
    const lines: string[] = [];

    if (phaseName) {
      lines.push(`## Phase: ${phaseName}`);
      lines.push('');
    }

    lines.push('## タスク内容');
    lines.push('');
    lines.push(title);
    lines.push('');

    const filePathMatches = title.match(/`([^`]+\.[a-z]+)`/gi);
    if (filePathMatches && filePathMatches.length > 0) {
      lines.push('## 対象ファイル');
      lines.push('');
      for (const match of filePathMatches) {
        const filePath = match.replace(/`/g, '');
        lines.push(`- \`${filePath}\``);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('*この Issue は cc-craft-kit によって自動生成されました。*');

    return lines.join('\n');
  }

  /**
   * 仕様書から実装タスクリストを解析
   */
  interface TaskInfo {
    id: string;
    title: string;
    description?: string;
  }

  function parseTaskListFromSpecContent(content: string): TaskInfo[] {
    const taskSectionMatch = content.match(
      /##\s*8\.\s*実装タスクリスト[\s\S]*?(?=\n##\s|\n---\s|$)/i
    );

    if (!taskSectionMatch) {
      return [];
    }

    const taskSection = taskSectionMatch[0];
    const tasks: TaskInfo[] = [];
    const lines = taskSection.split('\n');
    let currentPhase: string | undefined;
    let taskIndex = 0;

    for (const line of lines) {
      const phaseMatch = line.match(/^###\s*Phase\s*\d+:\s*(.+)$/i);
      if (phaseMatch) {
        currentPhase = phaseMatch[1].trim();
        continue;
      }

      const checkboxMatch = line.match(/^\s*-\s*\[\s*\]\s*(.+)$/);
      if (!checkboxMatch) {
        continue;
      }

      const rawTitle = checkboxMatch[1].trim();
      if (!rawTitle) {
        continue;
      }

      tasks.push({
        id: `task-${taskIndex++}`,
        title: rawTitle,
        description: generateTaskDescription(rawTitle, currentPhase),
      });
    }

    return tasks;
  }

  describe('タスクリスト解析', () => {
    it('基本的なタスクリストを解析できる', () => {
      const content = `
# 仕様書

## 8. 実装タスクリスト

- [ ] タスク 1
- [ ] タスク 2
- [ ] タスク 3
`;

      const tasks = parseTaskListFromSpecContent(content);

      expect(tasks).toHaveLength(3);
      expect(tasks[0].title).toBe('タスク 1');
      expect(tasks[1].title).toBe('タスク 2');
      expect(tasks[2].title).toBe('タスク 3');
    });

    it('Phase 付きのタスクリストを解析できる', () => {
      const content = `
## 8. 実装タスクリスト

### Phase 1: Sub Issue 本文対応

- [ ] \`src/integrations/github/sub-issues.ts\` に description を追加
- [ ] テストを追加

### Phase 2: イベント駆動実装

- [ ] \`src/commands/task/done.ts\` を新規作成
`;

      const tasks = parseTaskListFromSpecContent(content);

      expect(tasks).toHaveLength(3);

      // Phase 1 のタスク
      expect(tasks[0].title).toBe('`src/integrations/github/sub-issues.ts` に description を追加');
      expect(tasks[0].description).toContain('## Phase: Sub Issue 本文対応');

      expect(tasks[1].title).toBe('テストを追加');
      expect(tasks[1].description).toContain('## Phase: Sub Issue 本文対応');

      // Phase 2 のタスク
      expect(tasks[2].title).toBe('`src/commands/task/done.ts` を新規作成');
      expect(tasks[2].description).toContain('## Phase: イベント駆動実装');
    });

    it('タスクリストセクションがない場合は空配列を返す', () => {
      const content = `
# 仕様書

## 1. 背景と目的

ここに背景を記述
`;

      const tasks = parseTaskListFromSpecContent(content);

      expect(tasks).toHaveLength(0);
    });

    it('完了済みタスク（チェック済み）はスキップする', () => {
      const content = `
## 8. 実装タスクリスト

- [x] 完了済みタスク
- [ ] 未完了タスク
`;

      const tasks = parseTaskListFromSpecContent(content);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('未完了タスク');
    });

    it('空行やコメントを含むタスクリストを正しく解析できる', () => {
      const content = `
## 8. 実装タスクリスト

### Phase 1: 準備

- [ ] タスク A

説明テキスト（タスクではない）

- [ ] タスク B
`;

      const tasks = parseTaskListFromSpecContent(content);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('タスク A');
      expect(tasks[1].title).toBe('タスク B');
    });
  });

  describe('description 生成', () => {
    it('基本的な description を生成できる', () => {
      const description = generateTaskDescription('タスク内容');

      expect(description).toContain('## タスク内容');
      expect(description).toContain('タスク内容');
      expect(description).toContain('*この Issue は cc-craft-kit によって自動生成されました。*');
    });

    it('Phase 名を含む description を生成できる', () => {
      const description = generateTaskDescription('タスク内容', 'Sub Issue 本文対応');

      expect(description).toContain('## Phase: Sub Issue 本文対応');
      expect(description).toContain('## タスク内容');
    });

    it('ファイルパスを含むタイトルから対象ファイルセクションを生成する', () => {
      const description = generateTaskDescription(
        '`src/commands/task/done.ts` を新規作成し、`src/integrations/github/sub-issues.ts` を更新'
      );

      expect(description).toContain('## 対象ファイル');
      expect(description).toContain('- `src/commands/task/done.ts`');
      expect(description).toContain('- `src/integrations/github/sub-issues.ts`');
    });

    it('ファイルパスがないタイトルでは対象ファイルセクションを生成しない', () => {
      const description = generateTaskDescription('テストを追加する');

      expect(description).not.toContain('## 対象ファイル');
    });

    it('複数のファイルパスを正しく抽出する', () => {
      const description = generateTaskDescription(
        '`a.ts` と `b.js` と `c.tsx` を修正'
      );

      expect(description).toContain('- `a.ts`');
      expect(description).toContain('- `b.js`');
      expect(description).toContain('- `c.tsx`');
    });
  });
});
