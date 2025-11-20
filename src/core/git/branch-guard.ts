/**
 * ブランチ保護機能
 *
 * 統合ブランチ（main, develop など）での直接編集を防止する
 */

import { execSync } from 'node:child_process';
import { ProtectedBranchError } from '../errors/protected-branch-error.js';

/**
 * ブランチ情報のキャッシュ
 */
interface BranchCache {
  currentBranch?: string;
  protectedBranches?: string[];
  timestamp: number;
}

/**
 * キャッシュの有効期限（ミリ秒）
 */
const CACHE_TTL = 60000; // 1分

/**
 * セッション単位のキャッシュ
 */
let cache: BranchCache = { timestamp: 0 };

/**
 * Git コマンド実行のタイムアウト（ミリ秒）
 */
const GIT_COMMAND_TIMEOUT = 100;

/**
 * Git リポジトリの存在確認
 */
function isGitRepository(): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore', timeout: GIT_COMMAND_TIMEOUT });
    return true;
  } catch {
    return false;
  }
}

/**
 * キャッシュの有効性チェック
 */
function isCacheValid(): boolean {
  return Date.now() - cache.timestamp < CACHE_TTL;
}

/**
 * 現在のブランチ名を取得
 *
 * @returns 現在のブランチ名
 * @throws Error Git コマンド実行失敗時
 */
export async function getCurrentBranch(): Promise<string> {
  // キャッシュチェック
  if (isCacheValid() && cache.currentBranch) {
    return cache.currentBranch;
  }

  if (!isGitRepository()) {
    throw new Error('Not a git repository');
  }

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: GIT_COMMAND_TIMEOUT,
    }).trim();

    // キャッシュ更新
    cache.currentBranch = branch;
    cache.timestamp = Date.now();

    return branch;
  } catch (error) {
    throw new Error(
      `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 保護対象ブランチのリストを取得
 *
 * @returns 保護対象ブランチ名の配列
 */
export async function getProtectedBranches(): Promise<string[]> {
  // キャッシュチェック
  if (isCacheValid() && cache.protectedBranches) {
    return cache.protectedBranches;
  }

  // 環境変数から読み込み
  const envBranches = process.env.PROTECTED_BRANCHES;
  if (envBranches) {
    const branches = envBranches
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);

    // キャッシュ更新
    cache.protectedBranches = branches;
    cache.timestamp = Date.now();

    return branches;
  }

  // デフォルトブランチを自動検出
  const defaultBranch = await getDefaultBranch();

  // キャッシュ更新
  cache.protectedBranches = [defaultBranch];
  cache.timestamp = Date.now();

  return [defaultBranch];
}

/**
 * デフォルトブランチを自動検出
 *
 * @returns デフォルトブランチ名
 */
async function getDefaultBranch(): Promise<string> {
  if (!isGitRepository()) {
    return 'main'; // Git リポジトリでない場合はデフォルト値
  }

  try {
    // リモートのデフォルトブランチを取得
    const remoteBranch = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: GIT_COMMAND_TIMEOUT,
    }).trim();

    // refs/remotes/origin/main -> main
    const branchName = remoteBranch.split('/').pop();
    return branchName || 'main';
  } catch {
    // リモートのデフォルトブランチ取得失敗時
    // ローカルブランチの存在を確認
    try {
      execSync('git rev-parse --verify main', {
        stdio: 'ignore',
        timeout: GIT_COMMAND_TIMEOUT,
      });
      return 'main';
    } catch {
      try {
        execSync('git rev-parse --verify master', {
          stdio: 'ignore',
          timeout: GIT_COMMAND_TIMEOUT,
        });
        return 'master';
      } catch {
        return 'main'; // どちらも存在しない場合はデフォルト値
      }
    }
  }
}

/**
 * 指定されたブランチが保護対象かチェック
 *
 * @param branch - チェック対象のブランチ名
 * @returns 保護対象の場合 true
 */
export async function isProtectedBranch(branch: string): Promise<boolean> {
  const protectedBranches = await getProtectedBranches();
  return protectedBranches.includes(branch);
}

/**
 * ブランチチェックを実行
 *
 * @throws ProtectedBranchError 保護対象ブランチでの操作時
 */
export async function validateBranch(): Promise<void> {
  // Git リポジトリでない場合はスキップ
  if (!isGitRepository()) {
    return;
  }

  const currentBranch = await getCurrentBranch();
  const protected_ = await isProtectedBranch(currentBranch);

  if (protected_) {
    const protectedBranches = await getProtectedBranches();
    const suggestions = suggestWorkingBranch();

    throw new ProtectedBranchError(currentBranch, protectedBranches, suggestions);
  }
}

/**
 * 推奨作業ブランチ名を提案
 *
 * @param specPhase - 仕様書のフェーズ（任意）
 * @returns 推奨ブランチ名の配列
 */
export function suggestWorkingBranch(specPhase?: string): string[] {
  const suggestions: string[] = [];

  // フェーズに基づいた提案
  if (specPhase === 'implementation') {
    suggestions.push('feature/<機能名>');
  } else if (specPhase === 'testing') {
    suggestions.push('test/<テスト内容>');
  }

  // 共通の提案
  suggestions.push('feature/<機能名>', 'fix/<修正内容>', 'refactor/<リファクタリング内容>');

  // 重複排除
  return Array.from(new Set(suggestions));
}

/**
 * キャッシュをクリア（テスト用）
 */
export function clearCache(): void {
  cache = { timestamp: 0 };
}
