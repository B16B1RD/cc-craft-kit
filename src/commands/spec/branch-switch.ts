import * as readline from 'readline';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { clearBranchCache } from '../../core/git/branch-cache.js';

/**
 * ブランチ切り替えのオプション
 */
export interface BranchSwitchOptions {
  targetBranch: string;
  specId: string;
  checkUnsavedChanges?: boolean; // デフォルト: true
}

/**
 * ブランチ切り替えの結果
 */
export interface BranchSwitchResult {
  success: boolean;
  switched: boolean;
  error?: string;
}

/**
 * 仕様書情報
 */
export interface SpecInfo {
  id: string;
  name: string;
}

/**
 * エラーメッセージのテンプレート
 */
export const ERROR_MESSAGES = {
  SPEC_NOT_FOUND: (specId: string): string => `
${chalk.red('❌ 仕様書が見つかりません')}

指定された仕様書 ID に一致する仕様書がデータベースに存在しません。
  仕様書 ID: ${specId}

仕様書の一覧を確認してください：
  /cft:spec-list
`,

  BRANCH_MISMATCH: (spec: SpecInfo, specBranch: string, currentBranch: string): string => `
${chalk.yellow('⚠️  この仕様書は別のブランチで作成されています')}

仕様書情報:
  仕様書 ID: ${spec.id}
  仕様書名: ${spec.name}
  作成されたブランチ: ${specBranch}

現在のブランチ: ${currentBranch}
`,

  UNSAVED_CHANGES: (): string => `
${chalk.yellow('⚠️  未保存の変更があります')}

ブランチを切り替える前に、変更をコミットまたは stash してください。
  git status          # 変更を確認
  git add .           # 変更をステージング
  git commit -m "..." # コミット
  または
  git stash           # 一時的に退避
`,
};

/**
 * ユーザーにブランチ切り替えの選択を促す
 *
 * @param _currentBranch 現在のブランチ名（将来の拡張用）
 * @param _targetBranch 切り替え先のブランチ名（将来の拡張用）
 * @param _specInfo 仕様書情報（将来の拡張用）
 * @returns ユーザーが切り替えを選択した場合 true、キャンセルした場合 false
 */
export async function promptBranchSwitch(
  _currentBranch: string,
  _targetBranch: string,
  _specInfo: SpecInfo
): Promise<boolean> {
  console.log('ブランチを切り替えて仕様書を表示しますか？');
  console.log(chalk.green('  1. はい - ブランチを切り替えて表示'));
  console.log(chalk.gray('  2. いいえ - 現在のブランチに留まる'));
  console.log();

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('選択してください (1/2): ', (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed === '1');
    });
  });
}

/**
 * ブランチを切り替える
 *
 * @param options ブランチ切り替えのオプション
 * @returns ブランチ切り替えの結果
 */
export async function switchBranch(options: BranchSwitchOptions): Promise<BranchSwitchResult> {
  const { targetBranch, checkUnsavedChanges = true } = options;

  try {
    // 未保存の変更をチェック
    if (checkUnsavedChanges) {
      const status = execSync('git status --porcelain', {
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (status.trim()) {
        return {
          success: false,
          switched: false,
          error: ERROR_MESSAGES.UNSAVED_CHANGES(),
        };
      }
    }

    // ブランチ切り替え
    execSync(`git checkout ${targetBranch}`, { stdio: 'inherit' });

    // ブランチキャッシュをクリア
    clearBranchCache();

    return {
      success: true,
      switched: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      switched: false,
      error: `ブランチ切り替えに失敗しました: ${errorMessage}`,
    };
  }
}
