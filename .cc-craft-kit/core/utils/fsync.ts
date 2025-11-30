/**
 * ファイルシステム同期ユーティリティ
 *
 * ファイル書き込み後のバッファフラッシュを保証するヘルパー関数
 */

import { openSync, fsyncSync, closeSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * ファイルの内容を物理ディスクにフラッシュ
 *
 * @param filePath ファイルパス
 *
 * @example
 * writeFileSync(specPath, content, 'utf-8');
 * fsyncFile(specPath); // バッファフラッシュ
 */
export function fsyncFile(filePath: string): void {
  const fd = openSync(filePath, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * ディレクトリのメタデータを物理ディスクにフラッシュ
 *
 * ファイル作成・削除時は、ディレクトリエントリの変更も永続化する必要がある
 *
 * @param dirPath ディレクトリパス
 *
 * @example
 * writeFileSync(specPath, content, 'utf-8');
 * fsyncFile(specPath);
 * fsyncDirectory(dirname(specPath)); // ディレクトリエントリも永続化
 */
export function fsyncDirectory(dirPath: string): void {
  const fd = openSync(dirPath, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * ファイルとその親ディレクトリを物理ディスクにフラッシュ
 *
 * ファイル作成・更新時の標準的な永続化処理
 *
 * @param filePath ファイルパス
 *
 * @example
 * writeFileSync(specPath, content, 'utf-8');
 * fsyncFileAndDirectory(specPath); // ファイル + ディレクトリを永続化
 */
export function fsyncFileAndDirectory(filePath: string): void {
  fsyncFile(filePath);
  fsyncDirectory(dirname(filePath));
}
