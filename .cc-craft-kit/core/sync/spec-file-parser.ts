import { readFile } from 'fs/promises';
import { basename } from 'path';
import { SpecPhase } from '../database/schema.js';

/**
 * 仕様書ファイルから抽出されたメタデータ
 */
export interface SpecMetadata {
  id: string;
  name: string;
  phase: SpecPhase;
  created_at: string;
  updated_at: string;
}

/**
 * メタデータ抽出時のエラー
 */
export class SpecParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SpecParseError';
  }
}

/**
 * 仕様書ファイルからメタデータを抽出するパーサー
 */
export class SpecFileParser {
  /**
   * 仕様書ファイルからメタデータを抽出します
   *
   * @param filePath - 仕様書ファイルのパス
   * @returns 抽出されたメタデータ
   * @throws {SpecParseError} ファイル読み込みまたはパースに失敗した場合
   */
  async parseFile(filePath: string): Promise<SpecMetadata> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return this.parseContent(filePath, content);
    } catch (error) {
      throw new SpecParseError(
        `Failed to read spec file: ${filePath}`,
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * ファイル内容からメタデータを抽出します
   *
   * @param filePath - ファイルパス（エラーメッセージ用）
   * @param content - ファイル内容
   * @returns 抽出されたメタデータ
   * @throws {SpecParseError} パースに失敗した場合
   */
  parseContent(filePath: string, content: string): SpecMetadata {
    const id = this.extractId(filePath);
    const name = this.extractTitle(content);
    const phase = this.extractPhase(content);
    const created_at = this.extractCreatedAt(content);
    const updated_at = this.extractUpdatedAt(content);

    return {
      id,
      name,
      phase,
      created_at,
      updated_at,
    };
  }

  /**
   * ファイル名からUUIDを抽出します
   *
   * @param filePath - ファイルパス
   * @returns UUID
   * @throws {SpecParseError} UUIDの抽出に失敗した場合
   */
  private extractId(filePath: string): string {
    const filename = basename(filePath, '.md');

    // UUID v4のパターン: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(filename)) {
      throw new SpecParseError(`Invalid UUID format in filename: ${filename}`, filePath);
    }

    return filename;
  }

  /**
   * マークダウンの第1行目からタイトルを抽出します
   *
   * @param content - ファイル内容
   * @returns タイトル
   */
  private extractTitle(content: string): string {
    const lines = content.split('\n');
    const titleLine = lines.find((line) => line.trim().startsWith('#'));

    if (!titleLine) {
      return 'Untitled';
    }

    // "# " を削除してタイトルを取得
    return titleLine.replace(/^#\s*/, '').trim();
  }

  /**
   * フェーズ情報を抽出します
   *
   * **フェーズ:** tasks のパターンでマッチング
   *
   * @param content - ファイル内容
   * @returns フェーズ
   */
  private extractPhase(content: string): SpecPhase {
    const phasePattern = /\*\*フェーズ:\*\*\s*(\w+)/;
    const match = content.match(phasePattern);

    if (!match || !match[1]) {
      return 'requirements'; // デフォルト値
    }

    const phase = match[1].toLowerCase();

    // フェーズ名のバリデーション
    const validPhases: SpecPhase[] = [
      'requirements',
      'design',
      'tasks',
      'implementation',
      'completed',
    ];

    if (validPhases.includes(phase as SpecPhase)) {
      return phase as SpecPhase;
    }

    return 'requirements'; // 無効な値の場合はデフォルト
  }

  /**
   * 作成日時を抽出します
   *
   * **作成日時:** 2025/11/19 10:47:58 のパターンでマッチング
   *
   * @param content - ファイル内容
   * @returns 作成日時（ISO 8601形式）
   */
  private extractCreatedAt(content: string): string {
    const createdPattern = /\*\*作成日時:\*\*\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/;
    const match = content.match(createdPattern);

    if (!match || !match[1]) {
      return new Date().toISOString(); // デフォルト値
    }

    // YYYY/MM/DD HH:MM:SS を ISO 8601 形式に変換
    return this.convertToISO8601(match[1]);
  }

  /**
   * 更新日時を抽出します
   *
   * **更新日時:** 2025/11/19 10:47:58 のパターンでマッチング
   *
   * @param content - ファイル内容
   * @returns 更新日時（ISO 8601形式）
   */
  private extractUpdatedAt(content: string): string {
    const updatedPattern = /\*\*更新日時:\*\*\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/;
    const match = content.match(updatedPattern);

    if (!match || !match[1]) {
      return new Date().toISOString(); // デフォルト値
    }

    // YYYY/MM/DD HH:MM:SS を ISO 8601 形式に変換
    return this.convertToISO8601(match[1]);
  }

  /**
   * YYYY/MM/DD HH:MM:SS 形式をISO 8601形式に変換します
   *
   * @param dateStr - 変換元の日時文字列
   * @returns ISO 8601形式の日時文字列
   */
  private convertToISO8601(dateStr: string): string {
    // "2025/11/19 10:47:58" -> "2025-11-19T10:47:58"
    const [datePart, timePart] = dateStr.split(' ');
    const isoDate = datePart.replace(/\//g, '-');
    return `${isoDate}T${timePart}`;
  }
}
