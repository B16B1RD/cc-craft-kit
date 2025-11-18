/**
 * Git統合のイベントハンドラー
 */

import { execSync } from 'node:child_process';
import { Kysely } from 'kysely';
import { Database } from '../database/schema.js';
import { EventBus, WorkflowEvent } from './event-bus.js';

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
 * コミット対象ファイルの決定
 */
function getCommitTargets(phase: Phase, specId: string): string[] {
  if (phase === 'completed') {
    // completedフェーズでは全変更をコミット
    return ['.'];
  }

  // その他のフェーズでは仕様書ファイルのみ
  return [`.cc-craft-kit/specs/${specId}.md`];
}

/**
 * Gitコミット実行
 */
async function gitCommit(
  files: string[],
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // git add
    const addCommand =
      files.length === 1 && files[0] === '.' ? 'git add .' : `git add ${files.join(' ')}`;

    execSync(addCommand, { stdio: 'pipe' });

    // git commit
    // コミットメッセージのエスケープ（シェルインジェクション対策）
    const escapedMessage = message.replace(/'/g, "'\\''");
    execSync(`git commit -m '${escapedMessage}'`, { stdio: 'pipe' });

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
      if (process.env.DEBUG) {
        console.warn('Warning: Not a Git repository. Skipping auto-commit.');
      }
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
      console.log(`\n✓ Auto-committed: ${message}`);
    } else {
      console.error(`\nWarning: Failed to auto-commit: ${result.error}`);
      console.error('You can commit manually with: git add . && git commit');
    }
  } catch (error) {
    // エラーが発生してもフェーズ変更は成功させる
    console.error('Warning: Error in Git auto-commit handler:', error);
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
