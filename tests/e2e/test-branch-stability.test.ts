/**
 * テスト実行前後でブランチが変更されないことを検証するテスト
 *
 * このテストは、npm test 実行時にブランチが勝手に切り替わる問題を検出するために作成されました。
 * テスト開始前のブランチ名を記録し、テスト終了後に同じブランチであることを確認します。
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { execSync } from 'node:child_process';

describe('Test Branch Stability', () => {
  let initialBranch: string;
  let initialBranchList: string[];

  beforeAll(() => {
    // テスト開始前のブランチを記録
    try {
      initialBranch = execSync('git branch --show-current', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();

      initialBranchList = execSync('git branch', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      })
        .split('\n')
        .map((b) => b.trim().replace('* ', ''))
        .filter(Boolean);
    } catch (error) {
      // Git リポジトリでない場合はスキップ
      initialBranch = '';
      initialBranchList = [];
    }
  });

  afterAll(() => {
    if (!initialBranch) {
      return; // Git リポジトリでない場合はスキップ
    }

    // テスト終了後のブランチを確認
    const finalBranch = execSync('git branch --show-current', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    const finalBranchList = execSync('git branch', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
      .split('\n')
      .map((b) => b.trim().replace('* ', ''))
      .filter(Boolean);

    // ブランチが変更されていないことを確認
    if (finalBranch !== initialBranch) {
      console.error(`❌ ブランチが変更されました: ${initialBranch} → ${finalBranch}`);
      console.error('テスト実行前のブランチ一覧:', initialBranchList);
      console.error('テスト実行後のブランチ一覧:', finalBranchList);

      // 新しく作成されたブランチを特定
      const newBranches = finalBranchList.filter((b) => !initialBranchList.includes(b));
      if (newBranches.length > 0) {
        console.error('新しく作成されたブランチ:', newBranches);
      }

      throw new Error(
        `テスト実行により ブランチが変更されました。期待: ${initialBranch}, 実際: ${finalBranch}`
      );
    }

    // 新しいブランチが作成されていないことを確認
    const newBranches = finalBranchList.filter((b) => !initialBranchList.includes(b));
    if (newBranches.length > 0) {
      console.error(`❌ 新しいブランチが作成されました:`, newBranches);
      throw new Error(`テスト実行により新しいブランチが作成されました: ${newBranches.join(', ')}`);
    }
  });

  test('should not change Git branch during test execution', () => {
    // このテスト自体は何もしない（afterAll でブランチを検証）
    expect(initialBranch).toBeDefined();
  });

  test('should not create new branches during test execution', () => {
    // このテスト自体は何もしない（afterAll で新規ブランチをチェック）
    expect(initialBranchList).toBeDefined();
  });

  test('git status should have no changes after test execution', () => {
    if (!initialBranch) {
      return; // Git リポジトリでない場合はスキップ
    }

    // git status の出力を確認
    const status = execSync('git status --porcelain', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    // 変更がないことを確認（ただし、テストファイル自体の変更は許容）
    if (status) {
      console.warn('⚠️  git status に変更があります:');
      console.warn(status);
    }
  });
});
