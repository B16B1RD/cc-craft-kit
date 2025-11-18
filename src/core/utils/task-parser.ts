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
 * 仕様書ファイルから「8. 実装タスクリスト」を解析
 *
 * @param specFilePath 仕様書ファイルパス
 * @returns タスク配列
 */
export async function parseTaskListFromSpec(specFilePath: string): Promise<TaskInfo[]> {
  const content = await readFile(specFilePath, 'utf-8');

  // 「## 8. 実装タスクリスト」セクションを抽出
  const taskSectionMatch = content.match(/##\s*8\.\s*実装タスクリスト[\s\S]*$/i);

  if (!taskSectionMatch) {
    return []; // タスクリストセクションがない場合は空配列
  }

  const taskSection = taskSectionMatch[0];

  // Markdown チェックリスト（「- [ ] **タスク X**: ...」）を解析
  const taskRegex = /-\s*\[\s*\]\s*\*\*タスク\s+\d+\*\*:\s*(.+?)(?=\n|$)/gi;
  const tasks: TaskInfo[] = [];

  let match: RegExpExecArray | null;
  while ((match = taskRegex.exec(taskSection)) !== null) {
    const title = match[1].trim();

    // タスク ID を生成（UUID）
    const taskId = randomUUID();

    tasks.push({
      id: taskId,
      title,
      description: undefined, // 詳細は後続行にある可能性があるが、簡略化のため省略
    });
  }

  return tasks;
}
