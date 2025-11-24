/**
 * 仕様書フェーズ更新コマンド
 */

import '../../core/config/env.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase, closeDatabase } from '../../core/database/connection.js';
import { getEventBusAsync, getEventBus, EventBus } from '../../core/workflow/event-bus.js';
import {
  formatSuccess,
  formatHeading,
  formatKeyValue,
  formatInfo,
  formatError,
} from '../utils/output.js';
import {
  createProjectNotInitializedError,
  createSpecNotFoundError,
  handleCLIError,
} from '../utils/error-handler.js';
import { validateSpecId, validatePhase, Phase } from '../utils/validation.js';
import { ensureGitHubIssue } from '../../integrations/github/ensure-issue.js';
import { getCurrentDateTimeForSpec } from '../../core/utils/date-format.js';
import { fsyncFileAndDirectory } from '../../core/utils/fsync.js';
import { switchBranch, BranchSwitchError } from '../../core/git/branch-switching.js';
import {
  validatePhaseTransition,
  displayValidationResult,
} from '../../core/workflow/phase-transition-validator.js';

/**
 * 仕様書フェーズ更新オプション
 */
export interface UpdateSpecPhaseOptions {
  color?: boolean;
  force?: boolean;
  dryRun?: boolean;
  retry?: boolean;
}

/**
 * 仕様書フェーズ更新
 */
export async function updateSpecPhase(
  specId: string,
  newPhase: string,
  options: UpdateSpecPhaseOptions = { color: true }
): Promise<void> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    throw createProjectNotInitializedError();
  }

  // 仕様書IDの検証
  validateSpecId(specId);

  // フェーズの検証
  const validatedPhase: Phase = validatePhase(newPhase);

  // データベース取得
  const db = getDatabase();

  // 仕様書検索（部分一致対応）
  const spec = await db
    .selectFrom('specs')
    .selectAll()
    .where('id', 'like', `${specId}%`)
    .executeTakeFirst();

  if (!spec) {
    throw createSpecNotFoundError(specId);
  }

  console.log(formatHeading('Updating Spec Phase', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Spec ID', spec.id, options.color));
  console.log(formatKeyValue('Name', spec.name, options.color));
  console.log(formatKeyValue('Current Phase', spec.phase, options.color));
  console.log(formatKeyValue('New Phase', validatedPhase, options.color));
  console.log('');

  // GitHub Issue 自動リカバリー（フェーズ更新前に実行）
  await ensureGitHubIssue(db, spec.id);

  // ブランチ切り替え（仕様書の branch_name が設定されている場合のみ）
  if (spec.branch_name) {
    try {
      const result = switchBranch(spec.branch_name);

      if (result.switched) {
        console.log('');
        console.log(formatSuccess(`✓ Switched to branch: ${result.targetBranch}`, options.color));
        console.log('');
      }
    } catch (error) {
      if (error instanceof BranchSwitchError) {
        console.error('');
        console.error(`❌ ${error.message}`);
        console.error('');
        throw error;
      }
      throw error;
    }
  }

  // フェーズ遷移前バリデーション
  const oldPhase = spec.phase as Phase;
  const validationResult = await validatePhaseTransition(spec.id, oldPhase, validatedPhase, {
    force: options.force,
    dryRun: options.dryRun,
  });

  // バリデーション結果を表示
  displayValidationResult(validationResult);

  // dryRun モードの場合はここで終了
  if (options.dryRun) {
    console.log('');
    console.log(formatInfo('Dry-run mode: No changes were made.', options.color));
    console.log('');
    return;
  }

  // バリデーション失敗時の処理
  if (!validationResult.isValid) {
    if (validationResult.needsCompletion && !options.retry) {
      // 自動補完が必要な場合
      console.error('');
      console.error('❌ フェーズ遷移前のバリデーションに失敗しました。');
      console.error('');
      throw new Error('Phase transition validation failed. Please complete the missing sections.');
    }
  }

  // データベース更新
  console.log(formatInfo('Updating database...', options.color));
  const now = new Date().toISOString();
  const formattedDateTime = getCurrentDateTimeForSpec();

  try {
    // 1. データベース更新
    await db
      .updateTable('specs')
      .set({
        phase: validatedPhase,
        updated_at: now,
      })
      .where('id', '=', spec.id)
      .execute();

    // 2. Markdownファイル更新 + fsync()
    const specPath = join(ccCraftKitDir, 'specs', `${spec.id}.md`);
    if (existsSync(specPath)) {
      console.log(formatInfo('Updating spec file...', options.color));
      let content = readFileSync(specPath, 'utf-8');

      // フェーズ行を更新
      content = content.replace(/\*\*フェーズ:\*\* .+/, `**フェーズ:** ${validatedPhase}`);

      // 更新日時を更新（日時形式を統一）
      content = content.replace(/\*\*更新日時:\*\* .+/, `**更新日時:** ${formattedDateTime}`);

      writeFileSync(specPath, content, 'utf-8');

      // バッファフラッシュ（ファイル + ディレクトリ）
      fsyncFileAndDirectory(specPath);
    }

    // 3. イベント発火（非同期ハンドラー登録を待機）
    let eventBus: EventBus;
    try {
      eventBus = await getEventBusAsync();
    } catch {
      // タイムアウトエラーをキャッチ
      console.error('');
      console.error(
        formatError(
          '⚠️  Handler registration timeout. Event handlers may not be fully registered.',
          options.color
        )
      );
      console.error(
        formatInfo(
          'This may be caused by slow system performance or network issues.',
          options.color
        )
      );
      console.error(
        formatInfo(
          'Phase transition will continue, but some handlers may not execute.',
          options.color
        )
      );
      console.error('');

      // タイムアウトしても EventBus インスタンスは取得可能
      eventBus = getEventBus();
    }

    await eventBus.emit(
      eventBus.createEvent('spec.phase_changed', spec.id, {
        oldPhase,
        newPhase: validatedPhase,
      })
    );
  } catch (error) {
    // エラー時のロールバック処理
    console.error('');
    console.error(formatError('❌ Phase transition failed. Rolling back...', options.color));
    console.error('');

    // エラーの詳細をログ出力
    if (error instanceof Error) {
      console.error(formatError(`Error: ${error.message}`, options.color));
      if (error.stack) {
        console.error('');
        console.error('Stack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(formatError(`Unknown error: ${String(error)}`, options.color));
    }
    console.error('');

    // DBレコードを元のフェーズに戻す
    try {
      console.error(formatInfo('Rolling back database changes...', options.color));
      await db
        .updateTable('specs')
        .set({
          phase: oldPhase,
        })
        .where('id', '=', spec.id)
        .execute();
      console.error(formatSuccess('✓ Database rollback successful', options.color));
    } catch (dbError) {
      console.error(formatError('✗ Failed to rollback database record', options.color));
      console.error(dbError);
      console.error('');
      console.error(
        formatError(
          'Warning: Database is now in an inconsistent state. Manual intervention required.',
          options.color
        )
      );
    }

    // エラーを再スロー
    throw error;
  }

  console.log('');
  console.log(formatSuccess('Phase updated successfully!', options.color));
  console.log('');

  // フェーズ移行のガイダンス
  console.log(formatHeading('Next Steps', 2, options.color));
  console.log('');

  switch (validatedPhase) {
    case 'requirements':
      console.log('  • Define requirements in the spec file');
      console.log('  • Add background, objectives, and acceptance criteria');
      console.log('  • Move to design: /cft:spec-phase ' + spec.id.substring(0, 8) + ' design');
      break;

    case 'design':
      console.log('  • Create detailed design in the spec file');
      console.log('  • Add architecture, API design, and data models');
      console.log('  • Move to tasks: /cft:spec-phase ' + spec.id.substring(0, 8) + ' tasks');
      break;

    case 'tasks':
      console.log('  • Break down into implementable tasks');
      console.log('  • Estimate effort and dependencies');
      console.log(
        '  • Move to implementation: /cft:spec-phase ' + spec.id.substring(0, 8) + ' implementation'
      );
      break;

    case 'implementation':
      console.log('  • Implement the tasks');
      console.log('  • Write tests and documentation');
      console.log(
        '  • Move to completed: /cft:spec-phase ' + spec.id.substring(0, 8) + ' completed'
      );
      break;

    case 'completed':
      console.log('  • Review the implementation');
      console.log('  • Archive or close related GitHub issues');
      console.log('  • Create new specs for follow-up work');
      break;
  }

  console.log('');
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  // オプションフラグをパース
  const options: UpdateSpecPhaseOptions = {
    color: true,
    force: false,
    dryRun: false,
    retry: false,
  };

  const positionalArgs: string[] = [];

  for (const arg of args) {
    if (arg === '--force') {
      options.force = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--retry') {
      options.retry = true;
    } else if (!arg.startsWith('--')) {
      positionalArgs.push(arg);
    }
  }

  const [specId, phase] = positionalArgs;

  if (!specId || !phase) {
    console.error('Error: spec-id and phase are required');
    console.error('Usage: npx tsx phase.ts <spec-id> <phase> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --force     Skip validation and force phase transition');
    console.error('  --dry-run   Validate without making changes');
    console.error('  --retry     Retry auto-completion (not yet implemented)');
    process.exit(1);
  }

  updateSpecPhase(specId, phase, options)
    .catch((error) => handleCLIError(error))
    .finally(() => closeDatabase());
}
