/**
 * 仕様書ファイル更新モジュール
 *
 * 仕様書ファイルにタスクセクションを追加する
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fsyncFileAndDirectory } from '../utils/fsync.js';
import { hasTaskListSection } from './parser.js';

/**
 * 仕様書ファイルの末尾にタスクセクションを追加する
 *
 * @param specFilePath - 仕様書ファイルのパス
 * @param taskListMarkdown - Markdown 形式のタスクリスト
 * @throws セクションが既に存在する場合はエラー
 */
export function addTaskListSection(specFilePath: string, taskListMarkdown: string): void {
  // 既にセクションが存在する場合はエラー
  if (hasTaskListSection(specFilePath)) {
    throw new Error('Task list section already exists in the spec file');
  }

  const content = readFileSync(specFilePath, 'utf-8');

  // 末尾にタスクセクションを追加
  const updatedContent = `${content.trimEnd()}\n\n---\n\n## 8. 実装タスクリスト\n\n${taskListMarkdown.trimEnd()}\n`;

  // ファイルに書き込む
  writeFileSync(specFilePath, updatedContent, 'utf-8');

  // ディスクへ確実に書き込む
  fsyncFileAndDirectory(specFilePath);
}

/**
 * 仕様書ファイルのタスクセクションを更新する
 *
 * @param specFilePath - 仕様書ファイルのパス
 * @param taskListMarkdown - Markdown 形式のタスクリスト
 * @throws セクションが存在しない場合はエラー
 */
export function updateTaskListSection(specFilePath: string, taskListMarkdown: string): void {
  // セクションが存在しない場合はエラー
  if (!hasTaskListSection(specFilePath)) {
    throw new Error('Task list section does not exist in the spec file');
  }

  const content = readFileSync(specFilePath, 'utf-8');
  const lines = content.split('\n');

  const newLines: string[] = [];
  let inTaskListSection = false;
  let sectionFound = false;

  for (const line of lines) {
    // 実装タスクリストセクションの開始
    if (line.trim() === '## 8. 実装タスクリスト') {
      inTaskListSection = true;
      sectionFound = true;
      newLines.push(line);
      newLines.push('');
      newLines.push(taskListMarkdown.trimEnd());
      newLines.push('');
      continue;
    }

    // 次のセクション（## で始まる）が始まったら終了
    if (
      inTaskListSection &&
      line.trim().startsWith('## ') &&
      line.trim() !== '## 8. 実装タスクリスト'
    ) {
      inTaskListSection = false;
      newLines.push(line);
      continue;
    }

    // セクション内の既存コンテンツはスキップ
    if (inTaskListSection) {
      continue;
    }

    newLines.push(line);
  }

  if (!sectionFound) {
    throw new Error('Task list section not found');
  }

  // ファイルに書き込む
  const updatedContent = newLines.join('\n');
  writeFileSync(specFilePath, updatedContent, 'utf-8');

  // ディスクへ確実に書き込む
  fsyncFileAndDirectory(specFilePath);
}
