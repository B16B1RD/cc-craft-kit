import { SpecFileParser, SpecMetadata } from './spec-file-parser.js';
import { PathValidator } from './path-validator.js';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { getSpec, addSpec, updateSpec } from '../storage/index.js';

/**
 * 同期結果
 */
export interface SyncResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
}

/**
 * 同期サービス - 仕様書ファイルと JSON ストレージ間の同期を管理
 */
export class SyncService {
  private parser: SpecFileParser;

  constructor() {
    this.parser = new SpecFileParser();
  }

  /**
   * 指定されたディレクトリから全仕様書ファイルをインポート
   *
   * @param specsDir - 仕様書ディレクトリのパス
   * @returns 同期結果
   */
  async importFromDirectory(specsDir: string): Promise<SyncResult> {
    const result: SyncResult = {
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    try {
      // .mdファイルを取得
      const files = await readdir(specsDir);
      const mdFiles = files.filter((f) => f.endsWith('.md'));

      // 並列処理でパース
      const metadataResults = await Promise.allSettled(
        mdFiles.map((file) => this.parser.parseFile(join(specsDir, file)))
      );

      const metadataList: SpecMetadata[] = [];
      for (let i = 0; i < metadataResults.length; i++) {
        const res = metadataResults[i];
        if (res.status === 'fulfilled') {
          metadataList.push(res.value);
        } else {
          result.failed++;
          result.errors.push({
            file: mdFiles[i],
            error: res.reason?.message || 'Unknown error',
          });
        }
      }

      // 順次インポート
      for (const metadata of metadataList) {
        try {
          this.importSpec(metadata);
          result.imported++;
        } catch (error) {
          // 既存レコードの場合はスキップ
          if (error instanceof Error && error.message.includes('already exists')) {
            result.skipped++;
          } else {
            result.failed++;
            result.errors.push({
              file: `${metadata.id}.md`,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to import from directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 個別の仕様書ファイルをインポート
   *
   * @param fileIds - インポートするファイルのID配列
   * @param specsDir - 仕様書ディレクトリのパス
   * @returns 同期結果
   */
  async importFromFiles(fileIds: string[], specsDir: string): Promise<SyncResult> {
    const result: SyncResult = {
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const fileId of fileIds) {
      try {
        const filePath = PathValidator.validateFilePath(specsDir, fileId);
        const metadata = await this.parser.parseFile(filePath);
        this.importSpec(metadata);
        result.imported++;
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          result.skipped++;
        } else {
          result.failed++;
          result.errors.push({
            file: `${fileId}.md`,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return result;
  }

  /**
   * 仕様書メタデータを JSON ストレージにインポート (upsertロジック)
   *
   * @param metadata - 仕様書メタデータ
   */
  private importSpec(metadata: SpecMetadata): void {
    // 既存レコード確認
    const existing = getSpec(metadata.id);

    if (existing) {
      // 更新 (ファイル優先)
      updateSpec(metadata.id, {
        name: metadata.name,
        phase: metadata.phase,
        updated_at: metadata.updated_at,
      });
    } else {
      // 新規挿入
      addSpec({
        id: metadata.id,
        name: metadata.name,
        description: null,
        phase: metadata.phase,
        branch_name: 'develop',
      });
    }
  }

  /**
   * データベースから仕様書をファイルにエクスポート
   *
   * @param _specIds - エクスポートする仕様書のID配列
   * @param _specsDir - 仕様書ディレクトリのパス
   */
  async exportToFiles(_specIds: string[], _specsDir: string): Promise<void> {
    // 将来実装: データベースから仕様書を読み込んでファイルに書き出し
    throw new Error('exportToFiles is not implemented yet');
  }
}
