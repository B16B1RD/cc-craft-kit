/**
 * 仕様書パーサーモジュール
 *
 * 仕様書ファイルから受け入れ基準セクションや実装タスクリストを抽出する
 */

import { readFileSync } from 'node:fs';

/**
 * 受け入れ基準の項目
 */
export interface AcceptanceCriterion {
  /** カテゴリ（必須要件、機能要件、非機能要件） */
  category: string;
  /** チェックボックスの状態 */
  checked: boolean;
  /** 項目テキスト */
  text: string;
}

/**
 * タスクリストの項目
 */
export interface TaskItem {
  /** チェックボックスの状態 */
  checked: boolean;
  /** タスクテキスト */
  text: string;
  /** インデントレベル（0: トップレベル、1: サブタスク） */
  indentLevel: number;
}

/**
 * 仕様書ファイルから受け入れ基準セクションを抽出する
 *
 * @param specFilePath - 仕様書ファイルのパス
 * @returns 受け入れ基準の配列
 */
export function parseAcceptanceCriteria(specFilePath: string): AcceptanceCriterion[] {
  const content = readFileSync(specFilePath, 'utf-8');
  const lines = content.split('\n');

  const criteria: AcceptanceCriterion[] = [];
  let inAcceptanceCriteriaSection = false;
  let currentCategory = '';

  for (const line of lines) {
    // 受け入れ基準セクションの開始
    if (line.trim() === '## 3. 受け入れ基準') {
      inAcceptanceCriteriaSection = true;
      continue;
    }

    // 次のセクション（## 4.）が始まったら終了
    if (inAcceptanceCriteriaSection && line.trim().startsWith('## 4.')) {
      break;
    }

    if (!inAcceptanceCriteriaSection) {
      continue;
    }

    // カテゴリ（### で始まる見出し）
    if (line.trim().startsWith('###')) {
      currentCategory = line.trim().replace(/^###\s+/, '');
      continue;
    }

    // チェックボックス（- [ ] または - [x]）
    const checkboxMatch = line.match(/^(\s*)- \[([ x])\] (.+)$/);
    if (checkboxMatch && currentCategory) {
      const checked = checkboxMatch[2] === 'x';
      const text = checkboxMatch[3];

      criteria.push({
        category: currentCategory,
        checked,
        text,
      });
    }
  }

  return criteria;
}

/**
 * 仕様書ファイルから実装タスクリストセクションを抽出する
 *
 * @param specFilePath - 仕様書ファイルのパス
 * @returns タスクリストの配列（セクションが存在しない場合は空配列）
 */
export function parseTaskList(specFilePath: string): TaskItem[] {
  const content = readFileSync(specFilePath, 'utf-8');
  const lines = content.split('\n');

  const tasks: TaskItem[] = [];
  let inTaskListSection = false;

  for (const line of lines) {
    // 実装タスクリストセクションの開始
    if (line.trim() === '## 8. 実装タスクリスト') {
      inTaskListSection = true;
      continue;
    }

    // 次のセクション（## で始まる）が始まったら終了
    if (
      inTaskListSection &&
      line.trim().startsWith('## ') &&
      line.trim() !== '## 8. 実装タスクリスト'
    ) {
      break;
    }

    if (!inTaskListSection) {
      continue;
    }

    // チェックボックス（- [ ] または - [x]）
    const checkboxMatch = line.match(/^(\s*)- \[([ x])\] (.+)$/);
    if (checkboxMatch) {
      const indentSpaces = checkboxMatch[1].length;
      const indentLevel = Math.floor(indentSpaces / 2); // 2スペースでインデント1レベル
      const checked = checkboxMatch[2] === 'x';
      const text = checkboxMatch[3];

      tasks.push({
        checked,
        text,
        indentLevel,
      });
    }
  }

  return tasks;
}

/**
 * 仕様書ファイルに実装タスクリストセクションが存在するかチェックする
 *
 * @param specFilePath - 仕様書ファイルのパス
 * @returns セクションが存在する場合は true
 */
export function hasTaskListSection(specFilePath: string): boolean {
  const content = readFileSync(specFilePath, 'utf-8');
  return content.includes('## 8. 実装タスクリスト');
}
