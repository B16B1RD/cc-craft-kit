/**
 * タスクリスト生成モジュール
 *
 * 受け入れ基準から実装タスクリストを生成する
 */

import type { AcceptanceCriterion } from '../spec/parser.js';

/**
 * 受け入れ基準からタスクリストを生成する
 *
 * @param criteria - 受け入れ基準の配列
 * @returns Markdown 形式のタスクリスト
 */
export function generateTaskList(criteria: AcceptanceCriterion[]): string {
  if (criteria.length === 0) {
    return '';
  }

  const lines: string[] = [];

  // カテゴリごとにグループ化
  const categoriesMap = new Map<string, AcceptanceCriterion[]>();
  for (const criterion of criteria) {
    const existing = categoriesMap.get(criterion.category) || [];
    existing.push(criterion);
    categoriesMap.set(criterion.category, existing);
  }

  // 優先順位: 必須要件 → 機能要件 → 非機能要件
  const categoryOrder = ['必須要件', '機能要件', '非機能要件'];

  for (const category of categoryOrder) {
    const items = categoriesMap.get(category);
    if (!items || items.length === 0) {
      continue;
    }

    lines.push(`### ${category}`);
    lines.push('');

    for (const item of items) {
      // チェックボックスは未チェック状態でタスク化
      lines.push(`- [ ] ${item.text}`);
    }

    lines.push('');
  }

  // カスタムカテゴリ（上記以外）を追加
  for (const [category, items] of categoriesMap.entries()) {
    if (categoryOrder.includes(category)) {
      continue;
    }

    lines.push(`### ${category}`);
    lines.push('');

    for (const item of items) {
      lines.push(`- [ ] ${item.text}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 受け入れ基準から詳細な実装タスクリストを生成する
 *
 * 各受け入れ基準を実装可能な単位に分解し、Phase ごとにグループ化する
 *
 * @param criteria - 受け入れ基準の配列
 * @returns Markdown 形式の詳細なタスクリスト
 */
export function generateDetailedTaskList(criteria: AcceptanceCriterion[]): string {
  if (criteria.length === 0) {
    return '';
  }

  const lines: string[] = [];

  // カテゴリごとにグループ化
  const categoriesMap = new Map<string, AcceptanceCriterion[]>();
  for (const criterion of criteria) {
    const existing = categoriesMap.get(criterion.category) || [];
    existing.push(criterion);
    categoriesMap.set(criterion.category, existing);
  }

  // Phase ベースのタスク分解
  const phases = [
    { name: '必須要件', items: categoriesMap.get('必須要件') || [] },
    { name: '機能要件', items: categoriesMap.get('機能要件') || [] },
    { name: '非機能要件', items: categoriesMap.get('非機能要件') || [] },
  ];

  for (const phase of phases) {
    if (phase.items.length === 0) {
      continue;
    }

    lines.push(`### ${phase.name}`);
    lines.push('');

    for (const item of phase.items) {
      lines.push(`- [ ] ${item.text}`);
    }

    lines.push('');
  }

  // カスタムカテゴリを追加
  for (const [category, items] of categoriesMap.entries()) {
    if (phases.some((p) => p.name === category)) {
      continue;
    }

    lines.push(`### ${category}`);
    lines.push('');

    for (const item of items) {
      lines.push(`- [ ] ${item.text}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
