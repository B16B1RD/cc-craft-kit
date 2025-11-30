/**
 * 変更履歴の要約記録モジュール
 *
 * 仕様書の変更をセクション単位で検出し、GitHub Issue コメントとして要約を記録する。
 */

/**
 * 変更エントリの種別
 */
export type ChangeType = 'added' | 'removed' | 'modified';

/**
 * 変更履歴エントリ
 */
export interface ChangelogEntry {
  type: ChangeType;
  section: string;
  summary: string;
}

/**
 * セクション情報
 */
interface Section {
  name: string;
  level: number;
  content: string;
  startLine: number;
  endLine: number;
}

/**
 * Markdown からセクションを解析する
 *
 * @param markdown - Markdown テキスト
 * @returns セクション名とコンテンツの Map
 */
export function parseSections(markdown: string): Map<string, string> {
  const lines = markdown.split('\n');
  const sections = new Map<string, string>();
  const sectionStack: Section[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const name = headingMatch[2].trim();

      // 現在のセクションを閉じる
      while (sectionStack.length > 0) {
        const current = sectionStack[sectionStack.length - 1];
        if (current.level >= level) {
          current.endLine = i - 1;
          const content = lines.slice(current.startLine, current.endLine + 1).join('\n');
          sections.set(current.name, content.trim());
          sectionStack.pop();
        } else {
          break;
        }
      }

      // 新しいセクションを開始
      sectionStack.push({
        name,
        level,
        content: '',
        startLine: i,
        endLine: lines.length - 1,
      });
    }
  }

  // 残りのセクションを閉じる
  while (sectionStack.length > 0) {
    const current = sectionStack.pop()!;
    const content = lines.slice(current.startLine, current.endLine + 1).join('\n');
    sections.set(current.name, content.trim());
  }

  return sections;
}

/**
 * 2 つのセクション間の差分要約を生成する
 *
 * @param oldContent - 変更前のコンテンツ
 * @param newContent - 変更後のコンテンツ
 * @returns 差分の要約文
 */
export function generateDiffSummary(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n').filter((l) => l.trim());
  const newLines = newContent.split('\n').filter((l) => l.trim());

  // チェックボックスの変更を検出
  const oldCheckboxes = oldLines.filter((l) => l.match(/^\s*-\s*\[[ xX]\]/));
  const newCheckboxes = newLines.filter((l) => l.match(/^\s*-\s*\[[ xX]\]/));

  const oldChecked = oldCheckboxes.filter((l) => l.match(/^\s*-\s*\[[xX]\]/)).length;
  const newChecked = newCheckboxes.filter((l) => l.match(/^\s*-\s*\[[xX]\]/)).length;

  if (oldCheckboxes.length !== newCheckboxes.length) {
    const diff = newCheckboxes.length - oldCheckboxes.length;
    if (diff > 0) {
      return `${diff} 件の項目を追加`;
    } else {
      return `${Math.abs(diff)} 件の項目を削除`;
    }
  }

  if (oldChecked !== newChecked) {
    const diff = newChecked - oldChecked;
    if (diff > 0) {
      return `${diff} 件の項目を完了`;
    } else {
      return `${Math.abs(diff)} 件の項目を未完了に変更`;
    }
  }

  // 行数の変更を検出
  const lineDiff = newLines.length - oldLines.length;
  if (Math.abs(lineDiff) > 3) {
    if (lineDiff > 0) {
      return `${lineDiff} 行を追加`;
    } else {
      return `${Math.abs(lineDiff)} 行を削除`;
    }
  }

  // 一般的な変更
  return '内容を更新';
}

/**
 * 2 つの Markdown コンテンツ間の変更を検出する
 *
 * @param oldContent - 変更前の Markdown
 * @param newContent - 変更後の Markdown
 * @returns 変更履歴エントリの配列
 */
export function detectChanges(oldContent: string, newContent: string): ChangelogEntry[] {
  const oldSections = parseSections(oldContent);
  const newSections = parseSections(newContent);
  const changes: ChangelogEntry[] = [];

  // 追加・変更されたセクションを検出
  for (const [name, content] of newSections) {
    if (!oldSections.has(name)) {
      changes.push({
        type: 'added',
        section: name,
        summary: '新規追加',
      });
    } else if (oldSections.get(name) !== content) {
      changes.push({
        type: 'modified',
        section: name,
        summary: generateDiffSummary(oldSections.get(name)!, content),
      });
    }
  }

  // 削除されたセクションを検出
  for (const [name] of oldSections) {
    if (!newSections.has(name)) {
      changes.push({
        type: 'removed',
        section: name,
        summary: '削除',
      });
    }
  }

  return changes;
}

/**
 * 変更履歴コメントを生成する
 *
 * @param changes - 変更履歴エントリの配列
 * @param specId - 仕様書 ID
 * @param commitHash - コミットハッシュ（オプション）
 * @returns GitHub Issue コメント用の Markdown
 */
export function buildChangelogComment(
  changes: ChangelogEntry[],
  specId: string,
  commitHash?: string
): string {
  if (changes.length === 0) {
    return '';
  }

  const timestamp = new Date().toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const changeIcons: Record<ChangeType, string> = {
    added: '➕',
    removed: '➖',
    modified: '📝',
  };

  const changeLines = changes.map((change) => {
    const icon = changeIcons[change.type];
    return `- ${icon} **${change.section}**: ${change.summary}`;
  });

  let comment = `## 📝 仕様書更新

仕様書が更新されました。

### 変更内容
${changeLines.join('\n')}

**更新日時:** ${timestamp}`;

  if (commitHash) {
    comment += `\n**差分:** [コミット ${commitHash.substring(0, 7)}](../../commit/${commitHash})`;
  }

  comment += `\n**最新の仕様書:** [\`.cc-craft-kit/specs/${specId}.md\`](../../.cc-craft-kit/specs/${specId}.md)`;

  return comment;
}

/**
 * 変更履歴の要約を表示用に整形する
 *
 * @param changes - 変更履歴エントリの配列
 * @returns 表示用の要約文
 */
export function formatChangeSummary(changes: ChangelogEntry[]): string {
  if (changes.length === 0) {
    return '変更なし';
  }

  const added = changes.filter((c) => c.type === 'added').length;
  const removed = changes.filter((c) => c.type === 'removed').length;
  const modified = changes.filter((c) => c.type === 'modified').length;

  const parts: string[] = [];
  if (added > 0) parts.push(`${added} 件追加`);
  if (removed > 0) parts.push(`${removed} 件削除`);
  if (modified > 0) parts.push(`${modified} 件変更`);

  return parts.join('、');
}
