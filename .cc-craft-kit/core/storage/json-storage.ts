/**
 * 共通 JSON ファイル I/O ユーティリティ
 *
 * すべての JSON ストレージモジュールで使用する共通機能を提供します。
 * 原子的書き込み（一時ファイル + リネーム）により、ファイル破損を防止します。
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * .cc-craft-kit/meta/ ディレクトリのパスを取得
 */
export function getMetaDir(baseDir?: string): string {
  const base = baseDir ?? process.cwd();
  return join(base, '.cc-craft-kit', 'meta');
}

/**
 * .cc-craft-kit/meta/ ディレクトリが存在しない場合は作成
 */
export function ensureMetaDir(baseDir?: string): void {
  const metaDir = getMetaDir(baseDir);
  if (!existsSync(metaDir)) {
    mkdirSync(metaDir, { recursive: true });
  }
}

/**
 * JSON ファイルを読み込む
 *
 * ファイルが存在しない場合は空配列を返します。
 * パース失敗時はエラーをスローします。
 *
 * @param filePath 読み込むファイルのパス
 * @returns パースされた JSON データ
 */
export function readJsonFile<T>(filePath: string): T[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  if (content.trim() === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected array but got ${typeof parsed}`);
    }
    return parsed as T[];
  } catch (error) {
    throw new Error(
      `Failed to parse JSON file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * JSON ファイルに原子的に書き込む
 *
 * 一時ファイルに書き込んでからリネームすることで、
 * 書き込み中の電源断などでファイルが破損することを防ぎます。
 *
 * @param filePath 書き込むファイルのパス
 * @param data 書き込むデータ
 */
export function writeJsonFile<T>(filePath: string, data: T[]): void {
  // ディレクトリが存在しない場合は作成
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // 一時ファイルパスを生成（同じディレクトリ内に作成）
  const tempPath = join(dir, `.${randomUUID()}.tmp`);

  try {
    // 整形された JSON を一時ファイルに書き込み
    const content = JSON.stringify(data, null, 2) + '\n';
    writeFileSync(tempPath, content, 'utf-8');

    // 原子的リネーム
    renameSync(tempPath, filePath);
  } catch (error) {
    // 失敗時は一時ファイルを削除（存在する場合）
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch {
      // 削除失敗は無視
    }
    throw error;
  }
}

/**
 * JSONL（JSON Lines）ファイルに1行追加
 *
 * ログなど、追記のみで良いデータに使用します。
 *
 * @param filePath 追記するファイルのパス
 * @param data 追記するデータ（1オブジェクト）
 */
export function appendJsonlFile<T>(filePath: string, data: T): void {
  // ディレクトリが存在しない場合は作成
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const line = JSON.stringify(data) + '\n';
  appendFileSync(filePath, line, 'utf-8');
}

/**
 * JSONL（JSON Lines）ファイルを読み込む
 *
 * @param filePath 読み込むファイルのパス
 * @returns パースされたデータの配列
 */
export function readJsonlFile<T>(filePath: string): T[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  if (content.trim() === '') {
    return [];
  }

  const lines = content.trim().split('\n');
  const result: T[] = [];

  for (const line of lines) {
    if (line.trim() === '') continue;
    try {
      result.push(JSON.parse(line) as T);
    } catch {
      // 不正な行はスキップ（ログファイルの破損に対する耐性）
      console.warn(`Skipping invalid JSONL line in ${filePath}: ${line}`);
    }
  }

  return result;
}

/**
 * 指定パスの JSON ファイルのフルパスを取得
 *
 * @param fileName ファイル名（例: "specs.json"）
 * @param baseDir ベースディレクトリ（省略時は process.cwd()）
 * @returns フルパス
 */
export function getJsonFilePath(fileName: string, baseDir?: string): string {
  return join(getMetaDir(baseDir), fileName);
}
