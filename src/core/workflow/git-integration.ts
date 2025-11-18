/**
 * Git統合のイベントハンドラー
 */

import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { Kysely } from 'kysely';
import { Database } from '../database/schema.js';
import { EventBus, WorkflowEvent } from './event-bus.js';
import { getErrorHandler } from '../errors/error-handler.js';

/**
 * フェーズ型定義
 */
type Phase = 'requirements' | 'design' | 'tasks' | 'implementation' | 'completed';

/**
 * Gitリポジトリの存在確認
 */
function isGitRepository(): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * コミットメッセージ生成
 */
function generateCommitMessage(specName: string, phase: Phase): string {
  const messages: Record<Phase, string> = {
    requirements: `feat: ${specName} の要件定義を完了`,
    design: `feat: ${specName} の設計を完了`,
    tasks: `feat: ${specName} のタスク分解を完了`,
    implementation: `feat: ${specName} の実装を開始`,
    completed: `feat: ${specName} を実装完了`,
  };
  return messages[phase];
}

/**
 * ファイルが .gitignore で除外されているかチェック
 * @param files チェック対象のファイルパス配列
 * @returns 除外されているファイルパス配列
 */
function getIgnoredFiles(files: string[]): string[] {
  if (files.length === 0) return [];

  const result = spawnSync('git', ['check-ignore', ...files], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // 終了コード 0: 除外されたファイルがある
  // 終了コード 1: 除外されたファイルがない（正常）
  // 終了コード 128以上: Gitエラー
  if (result.status !== null && result.status >= 128) {
    throw new Error(`git check-ignore failed: ${result.stderr}`);
  }

  return result.stdout.trim().split('\n').filter(Boolean);
}

/**
 * コミット対象ファイルの決定
 * @param phase フェーズ
 * @param specId 仕様書ID（UUID形式）
 * @returns コミット対象ファイルパス配列
 * @throws specIdがUUID形式でない場合、エラーをスロー
 */
function getCommitTargets(phase: Phase, specId: string): string[] {
  // specIdのバリデーション（UUID形式）
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(specId)) {
    throw new Error(`Invalid spec ID format: ${specId}`);
  }

  if (phase === 'completed') {
    // completedフェーズでは全変更をコミット
    return ['.'];
  }

  // パストラバーサル対策
  const safeSpecId = path.basename(specId);

  // その他のフェーズでは仕様書ファイルのみ
  return [`.cc-craft-kit/specs/${safeSpecId}.md`];
}

/**
 * Gitコミット実行
 * @param files コミット対象ファイルパス配列
 * @param message コミットメッセージ
 * @returns 成功/失敗の結果オブジェクト
 */
async function gitCommit(
  files: string[],
  message: string
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    // git add . の場合は特別処理
    if (files.length === 1 && files[0] === '.') {
      const addResult = spawnSync('git', ['add', '.'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (addResult.status !== 0) {
        return { success: false, error: addResult.stderr.toString() };
      }
    } else {
      // .gitignore チェック
      const ignoredFiles = new Set(getIgnoredFiles(files));
      const filesToAdd = files.filter((file) => !ignoredFiles.has(file));

      if (filesToAdd.length === 0) {
        // コミット対象なし、正常終了
        return { success: true, skipped: true };
      }

      // git add 実行（シェルインジェクション対策）
      const addResult = spawnSync('git', ['add', ...filesToAdd], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (addResult.status !== 0) {
        return { success: false, error: addResult.stderr.toString() };
      }
    }

    // git commit 実行（エスケープ不要）
    const commitResult = spawnSync('git', ['commit', '-m', message], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (commitResult.status !== 0) {
      return { success: false, error: commitResult.stderr.toString() };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * フェーズ変更時の自動コミット処理
 */
async function handlePhaseChangeCommit(
  event: WorkflowEvent<{ oldPhase: string; newPhase: string }>,
  db: Kysely<Database>
): Promise<void> {
  try {
    // Gitリポジトリ確認
    if (!isGitRepository()) {
      const errorHandler = getErrorHandler();
      await errorHandler.handle(new Error('Not a Git repository'), {
        event: 'spec.phase_changed',
        specId: event.specId,
        oldPhase: event.data.oldPhase,
        newPhase: event.data.newPhase,
        action: 'git_auto_commit',
        message: 'Skipping auto-commit',
      });
      return;
    }

    // 仕様書取得
    const spec = await db
      .selectFrom('specs')
      .where('id', '=', event.specId)
      .selectAll()
      .executeTakeFirst();

    if (!spec) {
      return;
    }

    // コミット対象ファイルの決定
    const files = getCommitTargets(event.data.newPhase as Phase, spec.id);

    // コミットメッセージ生成
    const message = generateCommitMessage(spec.name, event.data.newPhase as Phase);

    // Gitコミット実行
    const result = await gitCommit(files, message);

    if (result.success) {
      if (result.skipped) {
        // コミット対象なし（.gitignore で除外されている）
        console.log('\nℹ Auto-commit skipped: No files to commit (ignored by .gitignore)');
      } else {
        console.log(`\n✓ Auto-committed: ${message}`);
      }
    } else {
      const errorHandler = getErrorHandler();
      await errorHandler.handle(new Error(result.error || 'Git commit failed'), {
        event: 'spec.phase_changed',
        specId: event.specId,
        oldPhase: event.data.oldPhase,
        newPhase: event.data.newPhase,
        action: 'git_auto_commit',
        commitMessage: message,
        files,
      });
      console.log('You can commit manually with: git add . && git commit\n');
    }
  } catch (error) {
    // エラーが発生してもフェーズ変更は成功させる
    const errorHandler = getErrorHandler();
    const errorObj = error instanceof Error ? error : new Error(String(error));
    await errorHandler.handle(errorObj, {
      event: 'spec.phase_changed',
      specId: event.specId,
      action: 'git_auto_commit',
    });
  }
}

/**
 * Git統合のイベントハンドラーを登録
 */
export function registerGitIntegrationHandlers(eventBus: EventBus, db: Kysely<Database>): void {
  // spec.phase_changed → Git自動コミット
  eventBus.on<{ oldPhase: string; newPhase: string }>(
    'spec.phase_changed',
    async (event: WorkflowEvent<{ oldPhase: string; newPhase: string }>) => {
      await handlePhaseChangeCommit(event, db);
    }
  );
}
