import { readFile } from 'fs/promises';
import { randomUUID } from 'crypto';

/**
 * タスク情報
 */
export interface TaskInfo {
  id: string; // タスク ID (UUID)
  title: string; // タスクタイトル
  description?: string; // タスク説明（詳細）
}

/**
 * 仕様書内容から「8. 実装タスクリスト」を解析
 *
 * 対応フォーマット:
 * - [ ] タスク内容（シンプルな形式）
 * - [ ] **タスク X**: タスク内容（番号付き形式）
 * - [ ] `ファイル名` の変更内容（バッククォート形式）
 *
 * @param content 仕様書の内容（文字列）
 * @returns タスク配列
 */
export function parseTaskListFromContent(content: string): TaskInfo[] {
  // 「## 8. 実装タスクリスト」セクションを抽出
  const taskSectionMatch = content.match(
    /##\s*8\.\s*実装タスクリスト[\s\S]*?(?=\n##\s|\n---\s|$)/i
  );

  if (!taskSectionMatch) {
    return [];
  }

  const taskSection = taskSectionMatch[0];
  const tasks: TaskInfo[] = [];
  const lines = taskSection.split('\n');

  for (const line of lines) {
    // チェックボックス行を検出
    const checkboxMatch = line.match(/^\s*-\s*\[\s*\]\s*(.+)$/);
    if (!checkboxMatch) {
      continue;
    }

    const rawTitle = checkboxMatch[1].trim();

    // 空のタイトルはスキップ
    if (!rawTitle) {
      continue;
    }

    // UUID を生成
    const taskId = randomUUID();

    tasks.push({
      id: taskId,
      title: rawTitle,
      description: undefined,
    });
  }

  return tasks;
}

/**
 * 仕様書ファイルから「8. 実装タスクリスト」を解析
 *
 * @param specFilePath 仕様書ファイルパス
 * @returns タスク配列
 * @deprecated parseTaskListFromContent を使用してください
 */
export async function parseTaskListFromSpec(specFilePath: string): Promise<TaskInfo[]> {
  const content = await readFile(specFilePath, 'utf-8');
  return parseTaskListFromContent(content);
}
