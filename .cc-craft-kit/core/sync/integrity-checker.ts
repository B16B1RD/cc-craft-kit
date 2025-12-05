import { SpecFileParser } from './spec-file-parser.js';
import { PathValidator } from './path-validator.js';
import { readdir } from 'fs/promises';
import { getCurrentBranch } from '../git/branch-cache.js';
import { loadSpecs } from '../storage/index.js';

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
 * 整合性チェッカー - ファイルシステムと JSON ストレージ間の整合性をチェック
 */
export class IntegrityChecker {
  private parser: SpecFileParser;

  constructor() {
    this.parser = new SpecFileParser();
  }

  /**
   * 仕様書ファイルと JSON ストレージ間の整合性をチェック
   *
   * @param specsDir - 仕様書ディレクトリのパス
   * @returns 整合性レポート
   */
  async check(specsDir: string): Promise<IntegrityReport> {
    // 1. ファイルシステムから全.mdファイルを取得
    const files = await readdir(specsDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));
    const fileIds = mdFiles.map((f) => f.replace('.md', ''));

    // 2. JSON ストレージから全specsレコードを取得
    const storageSpecs = loadSpecs();
    const storageIds = storageSpecs.map((s) => s.id);

    // 3. ブランチフィルタリング用の許可リストを作成
    const currentBranch = getCurrentBranch();
    const allowedBranches = [currentBranch, 'main', 'develop'];

    // 4. 差分を検出（ブランチフィルタリングを適用）
    const filesOnly = fileIds.filter((id) => !storageIds.includes(id));
    // storageOnly: 別ブランチの仕様書は除外
    const storageOnly = storageIds.filter((id) => {
      if (fileIds.includes(id)) {
        return false; // ファイルが存在する
      }
      const storageRecord = storageSpecs.find((s) => s.id === id);
      if (!storageRecord) {
        return true; // ストレージレコードがない（理論的にはあり得ない）
      }
      // 別ブランチの仕様書は「storageOnly」に含めない（正常と判定）
      // branch_name が null の場合は、PR マージ後にクリアされた可能性があるため、許可
      return (
        storageRecord.branch_name === null || allowedBranches.includes(storageRecord.branch_name)
      );
    });

    // 5. 共通IDでメタデータの一致確認
    const commonIds = fileIds.filter((id) => storageIds.includes(id));
    const mismatch: Array<{ id: string; differences: string[] }> = [];
    const synced: string[] = [];

    for (const id of commonIds) {
      try {
        const filePath = PathValidator.validateFilePath(specsDir, id);
        const metadata = await this.parser.parseFile(filePath);
        const storageRecord = storageSpecs.find((s) => s.id === id);

        if (!storageRecord) {
          continue; // ストレージレコードがない（理論的にはあり得ない）
        }

        const differences = this.compareMetadata(metadata, storageRecord);
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

    // 6. 同期率を計算
    const totalFiles = fileIds.length;
    const totalStorageRecords = storageIds.length;
    const syncRate = totalFiles > 0 ? Math.round((synced.length / totalFiles) * 100) : 0;

    return {
      filesOnly,
      dbOnly: storageOnly,
      mismatch,
      synced,
      totalFiles,
      totalDbRecords: totalStorageRecords,
      syncRate,
    };
  }

  /**
   * メタデータとストレージレコードを比較
   *
   * @param metadata - ファイルから抽出したメタデータ
   * @param storageRecord - ストレージレコード
   * @returns 差分リスト
   */
  private compareMetadata(
    metadata: { name: string; phase: string; updated_at: string },
    storageRecord: { name: string; phase: string; updated_at: string }
  ): string[] {
    const differences: string[] = [];

    // 名前の比較
    if (metadata.name !== storageRecord.name) {
      differences.push(`Name mismatch: file="${metadata.name}" storage="${storageRecord.name}"`);
    }

    // フェーズの比較
    if (metadata.phase !== storageRecord.phase) {
      differences.push(`Phase mismatch: file="${metadata.phase}" storage="${storageRecord.phase}"`);
    }

    // 更新日時の比較 (ISO 8601形式に変換して比較)
    const storageUpdatedAt = new Date(storageRecord.updated_at).toISOString();
    const fileUpdatedAt = new Date(metadata.updated_at).toISOString();

    // 秒単位まで比較（ミリ秒は無視）
    const storageTime = storageUpdatedAt.slice(0, 19);
    const fileTime = fileUpdatedAt.slice(0, 19);

    if (storageTime !== fileTime) {
      differences.push(`Updated time mismatch: file="${fileTime}" storage="${storageTime}"`);
    }

    return differences;
  }
}
