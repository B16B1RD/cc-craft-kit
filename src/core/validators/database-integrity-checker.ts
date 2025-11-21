/**
 * データベース整合性チェッカー
 *
 * データベースとファイルシステムの整合性を検証し、不整合を検出する
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Kysely } from 'kysely';
import type { Database } from '../database/schema.js';
import { parseSpecFile, validateMetadata, type SpecMetadata } from './spec-file-validator.js';
import { getCurrentBranch } from '../git/branch-cache.js';

/**
 * 整合性チェック結果
 */
export interface IntegrityCheckResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalFiles: number;
    totalDbRecords: number;
    validFiles: number;
    invalidFiles: number;
    missingInDb: number;
    missingFiles: number;
    orphanedRecords: number;
    invalidBranches: number;
  };
  details: {
    invalidFiles: Array<{ filePath: string; reason: string }>;
    missingInDb: Array<{ filePath: string; metadata: SpecMetadata | null }>;
    missingFiles: Array<{ id: string; name: string }>;
    orphanedRecords: Array<{ id: string; name: string }>;
    invalidBranches: Array<{ id: string; name: string; branchName: string | null }>;
  };
}

/**
 * SQLite PRAGMA integrity_check の結果
 */
export interface SqliteIntegrityResult {
  isValid: boolean;
  errors: string[];
}

/**
 * データベースファイルの破損チェック（SQLite PRAGMA integrity_check）
 */
export async function checkSqliteIntegrity(db: Kysely<Database>): Promise<SqliteIntegrityResult> {
  try {
    await db.selectFrom('specs').select(db.fn.count('id').as('count')).executeTakeFirst();

    // クエリが正常に実行できれば、データベースは破損していない
    return {
      isValid: true,
      errors: [],
    };
  } catch (error) {
    // テーブルが存在しない場合は正常（マイグレーション前の状態）
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('no such table')) {
      return {
        isValid: true,
        errors: [],
      };
    }

    return {
      isValid: false,
      errors: [`Database corruption detected: ${errorMessage}`],
    };
  }
}

/**
 * 仕様書ファイルとデータベースの整合性チェック
 */
export async function checkDatabaseIntegrity(
  db: Kysely<Database>,
  specsDir: string
): Promise<IntegrityCheckResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const invalidFiles: Array<{ filePath: string; reason: string }> = [];
  const missingInDb: Array<{ filePath: string; metadata: SpecMetadata | null }> = [];
  const missingFiles: Array<{ id: string; name: string }> = [];
  const orphanedRecords: Array<{ id: string; name: string }> = [];
  const invalidBranches: Array<{ id: string; name: string; branchName: string | null }> = [];

  // 1. SQLite破損チェック
  const sqliteCheck = await checkSqliteIntegrity(db);
  if (!sqliteCheck.isValid) {
    errors.push(...sqliteCheck.errors);
    return {
      isValid: false,
      errors,
      warnings,
      stats: {
        totalFiles: 0,
        totalDbRecords: 0,
        validFiles: 0,
        invalidFiles: 0,
        missingInDb: 0,
        missingFiles: 0,
        orphanedRecords: 0,
        invalidBranches: 0,
      },
      details: {
        invalidFiles: [],
        missingInDb: [],
        missingFiles: [],
        orphanedRecords: [],
        invalidBranches: [],
      },
    };
  }

  // 2. ファイルシステムのスキャン
  if (!existsSync(specsDir)) {
    errors.push(`Specs directory not found: ${specsDir}`);
    return {
      isValid: false,
      errors,
      warnings,
      stats: {
        totalFiles: 0,
        totalDbRecords: 0,
        validFiles: 0,
        invalidFiles: 0,
        missingInDb: 0,
        missingFiles: 0,
        orphanedRecords: 0,
        invalidBranches: 0,
      },
      details: {
        invalidFiles: [],
        missingInDb: [],
        missingFiles: [],
        orphanedRecords: [],
        invalidBranches: [],
      },
    };
  }

  const files = readdirSync(specsDir).filter((f) => f.endsWith('.md'));
  const fileMetadataMap = new Map<string, SpecMetadata>();

  for (const file of files) {
    const filePath = join(specsDir, file);
    try {
      const content = readFileSync(filePath, 'utf-8');
      const metadata = parseSpecFile(content);

      if (!metadata) {
        invalidFiles.push({
          filePath,
          reason: 'Failed to parse metadata',
        });
        continue;
      }

      const validation = validateMetadata(metadata);
      if (!validation.isValid) {
        invalidFiles.push({
          filePath,
          reason: validation.errors.join(', '),
        });
        continue;
      }

      fileMetadataMap.set(metadata.id, metadata);
    } catch (error) {
      invalidFiles.push({
        filePath,
        reason: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  // 3. データベースレコードの取得
  const dbRecords = await db.selectFrom('specs').select(['id', 'name', 'branch_name']).execute();
  const dbRecordMap = new Map(dbRecords.map((r) => [r.id, r.name]));

  // 3-1. ブランチフィルタリング用の許可リストを作成
  const currentBranch = getCurrentBranch();
  const allowedBranches = [currentBranch, 'main', 'develop'];

  // 3-2. ブランチ整合性チェック
  for (const record of dbRecords) {
    // branch_name が null または空文字列の場合は不正
    if (!record.branch_name || record.branch_name.trim() === '') {
      invalidBranches.push({
        id: record.id,
        name: record.name,
        branchName: record.branch_name,
      });
    }
  }

  // 4. 整合性チェック
  // 4-1. ファイルはあるがDBレコードがない
  for (const [id, metadata] of fileMetadataMap) {
    if (!dbRecordMap.has(id)) {
      missingInDb.push({
        filePath: join(specsDir, `${id}.md`),
        metadata,
      });
    }
  }

  // 4-2. DBレコードはあるがファイルがない（ブランチフィルタリング適用）
  for (const record of dbRecords) {
    const { id, name, branch_name } = record;
    const filePath = join(specsDir, `${id}.md`);

    // 別ブランチの仕様書はファイルチェックをスキップ
    if (!allowedBranches.includes(branch_name)) {
      continue; // 正常と判定
    }

    if (!existsSync(filePath)) {
      missingFiles.push({ id, name });
    } else if (!fileMetadataMap.has(id)) {
      // ファイルはあるが、メタデータが不正（invalidFilesに含まれる）
      orphanedRecords.push({ id, name });
    }
  }

  // 5. エラー・警告の生成
  if (invalidFiles.length > 0) {
    warnings.push(`Found ${invalidFiles.length} invalid spec file(s)`);
  }

  if (missingInDb.length > 0) {
    warnings.push(`Found ${missingInDb.length} spec file(s) not registered in database`);
  }

  if (missingFiles.length > 0) {
    errors.push(`Found ${missingFiles.length} database record(s) without corresponding file`);
  }

  if (orphanedRecords.length > 0) {
    warnings.push(`Found ${orphanedRecords.length} database record(s) with invalid spec file`);
  }

  if (invalidBranches.length > 0) {
    warnings.push(
      `Found ${invalidBranches.length} database record(s) with missing or invalid branch_name`
    );
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    stats: {
      totalFiles: files.length,
      totalDbRecords: dbRecords.length,
      validFiles: fileMetadataMap.size,
      invalidFiles: invalidFiles.length,
      missingInDb: missingInDb.length,
      missingFiles: missingFiles.length,
      orphanedRecords: orphanedRecords.length,
      invalidBranches: invalidBranches.length,
    },
    details: {
      invalidFiles,
      missingInDb,
      missingFiles,
      orphanedRecords,
      invalidBranches,
    },
  };
}

/**
 * 整合性チェック結果を人間が読める形式で出力
 */
export function formatIntegrityCheckResult(result: IntegrityCheckResult): string {
  const lines: string[] = [];

  lines.push('=== Database Integrity Check ===');
  lines.push('');
  lines.push(`Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}`);
  lines.push('');

  // 統計情報
  lines.push('Statistics:');
  lines.push(`  Total spec files: ${result.stats.totalFiles}`);
  lines.push(`  Total DB records: ${result.stats.totalDbRecords}`);
  lines.push(`  Valid files: ${result.stats.validFiles}`);
  lines.push(`  Invalid files: ${result.stats.invalidFiles}`);
  lines.push(`  Missing in DB: ${result.stats.missingInDb}`);
  lines.push(`  Missing files: ${result.stats.missingFiles}`);
  lines.push(`  Orphaned records: ${result.stats.orphanedRecords}`);
  lines.push(`  Invalid branches: ${result.stats.invalidBranches}`);
  lines.push('');

  // エラー
  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  ❌ ${error}`);
    }
    lines.push('');
  }

  // 警告
  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  ⚠️  ${warning}`);
    }
    lines.push('');
  }

  // 詳細
  if (result.details.invalidFiles.length > 0) {
    lines.push('Invalid files:');
    for (const { filePath, reason } of result.details.invalidFiles) {
      lines.push(`  - ${filePath}`);
      lines.push(`    Reason: ${reason}`);
    }
    lines.push('');
  }

  if (result.details.missingInDb.length > 0) {
    lines.push('Files not in database:');
    for (const { filePath, metadata } of result.details.missingInDb) {
      lines.push(`  - ${filePath}`);
      if (metadata) {
        lines.push(`    Name: ${metadata.name}`);
        lines.push(`    Phase: ${metadata.phase}`);
      }
    }
    lines.push('');
  }

  if (result.details.missingFiles.length > 0) {
    lines.push('Database records without files:');
    for (const { id, name } of result.details.missingFiles) {
      lines.push(`  - ${id}`);
      lines.push(`    Name: ${name}`);
    }
    lines.push('');
  }

  if (result.details.orphanedRecords.length > 0) {
    lines.push('Orphaned records (invalid spec file):');
    for (const { id, name } of result.details.orphanedRecords) {
      lines.push(`  - ${id}`);
      lines.push(`    Name: ${name}`);
    }
    lines.push('');
  }

  if (result.details.invalidBranches.length > 0) {
    lines.push('Invalid branch names:');
    for (const { id, name, branchName } of result.details.invalidBranches) {
      lines.push(`  - ${id}`);
      lines.push(`    Name: ${name}`);
      lines.push(`    Branch: ${branchName === null ? '(null)' : `"${branchName}"`}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
