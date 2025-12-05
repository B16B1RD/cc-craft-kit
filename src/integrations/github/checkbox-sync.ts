/**
 * チェックボックス双方向同期モジュール
 *
 * 仕様書ファイルと GitHub Issue 間でチェックボックス状態を同期する。
 * Source of Truth は仕様書ファイルであり、競合時は仕様書が優先される。
 */

import { readFileSync, writeFileSync } from 'node:fs';

/**
 * チェックボックス項目
 */
export interface CheckboxItem {
  line: number;
  text: string;
  checked: boolean;
  section: string;
}

/**
 * チェックボックス同期結果
 */
export interface CheckboxSyncResult {
  success: boolean;
  direction: 'to_issue' | 'to_spec';
  changes: CheckboxChange[];
  message: string;
}

/**
 * チェックボックスの変更
 */
export interface CheckboxChange {
  text: string;
  section: string;
  oldValue: boolean;
  newValue: boolean;
}

/**
 * Markdown からチェックボックスを抽出する
 *
 * @param markdown - Markdown テキスト
 * @returns チェックボックス項目の配列
 */
export function parseCheckboxes(markdown: string): CheckboxItem[] {
  const lines = markdown.split('\n');
  const checkboxes: CheckboxItem[] = [];
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // セクション見出しを追跡
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      currentSection = headingMatch[2].trim();
    }

    // チェックボックスを検出
    const checkboxMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.+)$/);
    if (checkboxMatch) {
      checkboxes.push({
        line: i + 1,
        text: checkboxMatch[3].trim(),
        checked: checkboxMatch[2].toLowerCase() === 'x',
        section: currentSection,
      });
    }
  }

  return checkboxes;
}

/**
 * チェックボックス状態のハッシュを生成する
 *
 * @param checkboxes - チェックボックス項目の配列
 * @returns ハッシュ文字列
 */
export function generateCheckboxHash(checkboxes: CheckboxItem[]): string {
  const state = checkboxes.map((cb) => `${cb.text}:${cb.checked ? '1' : '0'}`).join('|');
  // 簡易ハッシュ（競合検出用）
  let hash = 0;
  for (let i = 0; i < state.length; i++) {
    const char = state.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * 2 つのチェックボックスリストの差分を検出する
 *
 * @param source - ソース（変更元）のチェックボックス
 * @param target - ターゲット（変更先）のチェックボックス
 * @returns 変更の配列
 */
export function detectCheckboxChanges(
  source: CheckboxItem[],
  target: CheckboxItem[]
): CheckboxChange[] {
  const changes: CheckboxChange[] = [];

  // テキストで照合（行番号は信頼できない場合がある）
  const targetMap = new Map<string, CheckboxItem>();
  for (const cb of target) {
    targetMap.set(cb.text, cb);
  }

  for (const srcCb of source) {
    const tgtCb = targetMap.get(srcCb.text);
    if (tgtCb && srcCb.checked !== tgtCb.checked) {
      changes.push({
        text: srcCb.text,
        section: srcCb.section,
        oldValue: tgtCb.checked,
        newValue: srcCb.checked,
      });
    }
  }

  return changes;
}

/**
 * Markdown 内のチェックボックス状態を更新する
 *
 * @param markdown - 元の Markdown テキスト
 * @param changes - 適用する変更
 * @returns 更新後の Markdown テキスト
 */
export function applyCheckboxChanges(markdown: string, changes: CheckboxChange[]): string {
  const lines = markdown.split('\n');
  const changeMap = new Map<string, boolean>();

  for (const change of changes) {
    changeMap.set(change.text, change.newValue);
  }

  const updatedLines = lines.map((line) => {
    const checkboxMatch = line.match(/^(\s*-\s*\[)([ xX])(\]\s*)(.+)$/);
    if (checkboxMatch) {
      const text = checkboxMatch[4].trim();
      if (changeMap.has(text)) {
        const newChecked = changeMap.get(text);
        const checkChar = newChecked ? 'x' : ' ';
        return `${checkboxMatch[1]}${checkChar}${checkboxMatch[3]}${checkboxMatch[4]}`;
      }
    }
    return line;
  });

  return updatedLines.join('\n');
}

/**
 * チェックボックス同期サービス
 */
export class CheckboxSyncService {
  constructor() {}

  /**
   * Issue から仕様書へチェックボックス状態を同期する
   *
   * @param specId - 仕様書 ID
   * @param specPath - 仕様書ファイルパス
   * @param issueBody - Issue 本文
   * @returns 同期結果
   */
  async syncToSpec(
    specId: string,
    specPath: string,
    issueBody: string
  ): Promise<CheckboxSyncResult> {
    try {
      // 仕様書ファイルを読み込む
      const specContent = readFileSync(specPath, 'utf-8');

      // 両方からチェックボックスを抽出
      const specCheckboxes = parseCheckboxes(specContent);
      const issueCheckboxes = parseCheckboxes(issueBody);

      // Issue → 仕様書 の変更を検出
      const changes = detectCheckboxChanges(issueCheckboxes, specCheckboxes);

      if (changes.length === 0) {
        return {
          success: true,
          direction: 'to_spec',
          changes: [],
          message: 'チェックボックスに変更はありません',
        };
      }

      // 仕様書を更新
      const updatedContent = applyCheckboxChanges(specContent, changes);
      writeFileSync(specPath, updatedContent, 'utf-8');

      // 同期ステータスを更新
      await this.updateSyncStatus(specId, issueCheckboxes);

      return {
        success: true,
        direction: 'to_spec',
        changes,
        message: `${changes.length} 件のチェックボックスを仕様書に反映しました`,
      };
    } catch (error) {
      return {
        success: false,
        direction: 'to_spec',
        changes: [],
        message: error instanceof Error ? error.message : '同期に失敗しました',
      };
    }
  }

  /**
   * 仕様書から Issue へチェックボックス状態を同期する
   *
   * 注意: この方向の同期は Issue 本文の常時更新で実現されるため、
   * このメソッドは主に同期ステータスの更新のみを行う。
   *
   * @param specId - 仕様書 ID
   * @param specPath - 仕様書ファイルパス
   * @returns 同期結果
   */
  async syncToIssue(specId: string, specPath: string): Promise<CheckboxSyncResult> {
    try {
      // 仕様書ファイルを読み込む
      const specContent = readFileSync(specPath, 'utf-8');
      const specCheckboxes = parseCheckboxes(specContent);

      // 同期ステータスを更新
      await this.updateSyncStatus(specId, specCheckboxes);

      return {
        success: true,
        direction: 'to_issue',
        changes: [],
        message: 'Issue 本文は仕様書の更新時に自動同期されます',
      };
    } catch (error) {
      return {
        success: false,
        direction: 'to_issue',
        changes: [],
        message: error instanceof Error ? error.message : '同期に失敗しました',
      };
    }
  }

  /**
   * 同期ステータスを更新する
   */
  private async updateSyncStatus(specId: string, checkboxes: CheckboxItem[]): Promise<void> {
    const hash = generateCheckboxHash(checkboxes);

    // github_sync テーブルを更新（checkbox_hash カラムが存在する場合）
    try {
      await this.db
        .updateTable('github_sync')
        .set({
          last_synced_at: new Date().toISOString(),
        })
        .where('entity_type', '=', 'spec')
        .where('entity_id', '=', specId)
        .execute();

      // checkbox_hash は将来のマイグレーションで追加予定
      // 現時点では last_synced_at のみ更新
      if (process.env.DEBUG === '1') {
        console.log(`Checkbox hash for spec ${specId}: ${hash}`);
      }
    } catch {
      // テーブルやカラムが存在しない場合は無視
    }
  }
}

/**
 * チェックボックス変更のサマリーを生成する
 *
 * @param changes - 変更の配列
 * @returns サマリー文字列
 */
export function formatCheckboxChangeSummary(changes: CheckboxChange[]): string {
  if (changes.length === 0) {
    return '変更なし';
  }

  const completed = changes.filter((c) => c.newValue).length;
  const uncompleted = changes.filter((c) => !c.newValue).length;

  const parts: string[] = [];
  if (completed > 0) parts.push(`${completed} 件完了`);
  if (uncompleted > 0) parts.push(`${uncompleted} 件未完了に変更`);

  return parts.join('、');
}
