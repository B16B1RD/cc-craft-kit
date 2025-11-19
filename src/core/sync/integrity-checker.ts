import { Kysely } from 'kysely';
import { Database } from '../database/schema.js';
import { SpecFileParser } from './spec-file-parser.js';
import { PathValidator } from './path-validator.js';
import { readdir } from 'fs/promises';

/**
 * 整合性チェックレポート
 */
export interface IntegrityReport {
  /** ファイルのみ存在 (DB未登録) */
  filesOnly: string[];
  /** DBのみ存在 (ファイル削除済み) */
  dbOnly: string[];
  /** メタデータ不一致 */
  mismatch: Array<{
    id: string;
    differences: string[];
  }>;
  /** 正常に同期済み */
  synced: string[];
  /** ファイル総数 */
  totalFiles: number;
  /** データベースレコード総数 */
  totalDbRecords: number;
  /** 同期率 (%) */
  syncRate: number;
}

/**
 * 整合性チェッカー - ファイルシステムとデータベース間の整合性をチェック
 */
export class IntegrityChecker {
  private parser: SpecFileParser;

  constructor(private db: Kysely<Database>) {
    this.parser = new SpecFileParser();
  }

  /**
   * 仕様書ファイルとデータベース間の整合性をチェック
   *
   * @param specsDir - 仕様書ディレクトリのパス
   * @returns 整合性レポート
   */
  async check(specsDir: string): Promise<IntegrityReport> {
    // 1. ファイルシステムから全.mdファイルを取得
    const files = await readdir(specsDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));
    const fileIds = mdFiles.map((f) => f.replace('.md', ''));

    // 2. データベースから全specsレコードを取得
    const dbSpecs = await this.db.selectFrom('specs').selectAll().execute();
    const dbIds = dbSpecs.map((s) => s.id);

    // 3. 差分を検出
    const filesOnly = fileIds.filter((id) => !dbIds.includes(id));
    const dbOnly = dbIds.filter((id) => !fileIds.includes(id));

    // 4. 共通IDでメタデータの一致確認
    const commonIds = fileIds.filter((id) => dbIds.includes(id));
    const mismatch: Array<{ id: string; differences: string[] }> = [];
    const synced: string[] = [];

    for (const id of commonIds) {
      try {
        const filePath = PathValidator.validateFilePath(specsDir, id);
        const metadata = await this.parser.parseFile(filePath);
        const dbRecord = dbSpecs.find((s) => s.id === id);

        if (!dbRecord) {
          continue; // データベースレコードがない（理論的にはあり得ない）
        }

        const differences = this.compareMetadata(metadata, dbRecord);
        if (differences.length > 0) {
          mismatch.push({ id, differences });
        } else {
          synced.push(id);
        }
      } catch (error) {
        // パースエラーの場合はスキップ
        mismatch.push({
          id,
          differences: [`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        });
      }
    }

    // 5. 同期率を計算
    const totalFiles = fileIds.length;
    const totalDbRecords = dbIds.length;
    const syncRate = totalFiles > 0 ? Math.round((synced.length / totalFiles) * 100) : 0;

    return {
      filesOnly,
      dbOnly,
      mismatch,
      synced,
      totalFiles,
      totalDbRecords,
      syncRate,
    };
  }

  /**
   * メタデータとデータベースレコードを比較
   *
   * @param metadata - ファイルから抽出したメタデータ
   * @param dbRecord - データベースレコード
   * @returns 差分リスト
   */
  private compareMetadata(
    metadata: { name: string; phase: string; updated_at: string },
    dbRecord: { name: string; phase: string; updated_at: Date }
  ): string[] {
    const differences: string[] = [];

    // 名前の比較
    if (metadata.name !== dbRecord.name) {
      differences.push(`Name mismatch: file="${metadata.name}" db="${dbRecord.name}"`);
    }

    // フェーズの比較
    if (metadata.phase !== dbRecord.phase) {
      differences.push(`Phase mismatch: file="${metadata.phase}" db="${dbRecord.phase}"`);
    }

    // 更新日時の比較 (ISO 8601形式に変換して比較)
    const dbUpdatedAt = new Date(dbRecord.updated_at).toISOString();
    const fileUpdatedAt = new Date(metadata.updated_at).toISOString();

    // 秒単位まで比較（ミリ秒は無視）
    const dbTime = dbUpdatedAt.slice(0, 19);
    const fileTime = fileUpdatedAt.slice(0, 19);

    if (dbTime !== fileTime) {
      differences.push(`Updated time mismatch: file="${fileTime}" db="${dbTime}"`);
    }

    return differences;
  }
}
