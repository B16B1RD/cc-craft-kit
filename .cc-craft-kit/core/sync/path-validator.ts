import { resolve, relative } from 'path';

/**
 * パストラバーサル攻撃を防ぐためのファイルパス検証
 */
export class PathValidator {
  /**
   * ファイルIDを検証し、安全なファイルパスを返す
   *
   * @param baseDir - ベースディレクトリ
   * @param fileId - ファイルID (UUID形式)
   * @returns 安全なファイルパス
   * @throws {Error} 無効なファイルIDまたはパストラバーサル検出時
   */
  static validateFilePath(baseDir: string, fileId: string): string {
    // UUID v4形式の検証
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(fileId)) {
      throw new Error(`Invalid file ID format: ${fileId}`);
    }

    const filePath = resolve(baseDir, `${fileId}.md`);
    const relativePath = relative(baseDir, filePath);

    // パストラバーサルチェック
    if (relativePath.startsWith('..') || resolve(baseDir, relativePath) !== filePath) {
      throw new Error(`Path traversal detected: ${fileId}`);
    }

    return filePath;
  }
}
