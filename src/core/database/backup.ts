/**
 * データベースバックアップ機能
 *
 * データベース破損時の復旧を可能にするため、
 * 定期的なバックアップと復元機能を提供する
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';

export interface BackupOptions {
  /** バックアップディレクトリ（デフォルト: .cc-craft-kit/backups） */
  backupDir?: string;
  /** 保持するバックアップ数（デフォルト: 10） */
  maxBackups?: number;
}

/**
 * データベースのバックアップを作成
 *
 * @param dbPath - データベースファイルのパス
 * @param options - バックアップオプション
 * @returns バックアップファイルのパス
 */
export function createBackup(dbPath: string, options: BackupOptions = {}): string {
  if (!existsSync(dbPath)) {
    throw new Error(`Database file not found: ${dbPath}`);
  }

  const backupDir = options.backupDir || join(dirname(dbPath), 'backups');
  const maxBackups = options.maxBackups || 10;

  // バックアップディレクトリ作成
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  // バックアップファイル名（タイムスタンプ付き）
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `cc-craft-kit-${timestamp}.db`);

  // バックアップ作成
  copyFileSync(dbPath, backupPath);
  console.log(`✓ Database backup created: ${backupPath}`);

  // 古いバックアップを削除
  cleanupOldBackups(backupDir, maxBackups);

  return backupPath;
}

/**
 * バックアップからデータベースを復元
 *
 * @param backupPath - バックアップファイルのパス
 * @param dbPath - 復元先のデータベースパス
 */
export function restoreBackup(backupPath: string, dbPath: string): void {
  if (!existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  // 既存のデータベースをバックアップ
  if (existsSync(dbPath)) {
    const emergencyBackup = `${dbPath}.emergency-${Date.now()}`;
    copyFileSync(dbPath, emergencyBackup);
    console.log(`⚠️  Existing database backed up to: ${emergencyBackup}`);
  }

  // バックアップから復元
  copyFileSync(backupPath, dbPath);
  console.log(`✓ Database restored from: ${backupPath}`);
}

/**
 * 利用可能なバックアップ一覧を取得
 *
 * @param backupDir - バックアップディレクトリ
 * @returns バックアップファイルのパスと日時の配列
 */
export function listBackups(backupDir: string): Array<{ path: string; date: Date }> {
  if (!existsSync(backupDir)) {
    return [];
  }

  return readdirSync(backupDir)
    .filter((f) => f.startsWith('cc-craft-kit-') && f.endsWith('.db'))
    .map((f) => {
      const path = join(backupDir, f);
      const stats = statSync(path);
      return { path, date: stats.mtime };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * 古いバックアップを削除
 *
 * @param backupDir - バックアップディレクトリ
 * @param maxBackups - 保持する最大バックアップ数
 */
function cleanupOldBackups(backupDir: string, maxBackups: number): void {
  const backups = listBackups(backupDir);

  if (backups.length > maxBackups) {
    const toDelete = backups.slice(maxBackups);
    for (const backup of toDelete) {
      unlinkSync(backup.path);
      console.log(`  Removed old backup: ${backup.path}`);
    }
  }
}

/**
 * 最新のバックアップを取得
 *
 * @param backupDir - バックアップディレクトリ
 * @returns 最新のバックアップファイルパス、または null
 */
export function getLatestBackup(backupDir: string): string | null {
  const backups = listBackups(backupDir);
  return backups.length > 0 ? backups[0].path : null;
}
