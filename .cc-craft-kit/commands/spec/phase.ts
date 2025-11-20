/**
 * 仕様書フェーズ更新コマンド
 */

import '../../core/config/env.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase, closeDatabase } from '../../core/database/connection.js';
import { getEventBusAsync } from '../../core/workflow/event-bus.js';
import { formatSuccess, formatHeading, formatKeyValue, formatInfo } from '../utils/output.js';
import {
  createProjectNotInitializedError,
  createSpecNotFoundError,
  handleCLIError,
} from '../utils/error-handler.js';
import { validateSpecId, validatePhase, Phase } from '../utils/validation.js';
import { ensureGitHubIssue } from '../../integrations/github/ensure-issue.js';
import { getCurrentDateTimeForSpec } from '../../core/utils/date-format.js';
import { fsyncFileAndDirectory } from '../../core/utils/fsync.js';

/**
 * 仕様書フェーズ更新
 */
export async function updateSpecPhase(
  specId: string,
  newPhase: string,
  options: { color: boolean } = { color: true }
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

  // データベース更新
  console.log(formatInfo('Updating database...', options.color));
  const now = new Date().toISOString();
  const formattedDateTime = getCurrentDateTimeForSpec();

  const oldPhase = spec.phase;

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
    const eventBus = await getEventBusAsync();
    await eventBus.emit(
      eventBus.createEvent('spec.phase_changed', spec.id, {
        oldPhase,
        newPhase: validatedPhase,
      })
    );
  } catch (error) {
    // エラー時のロールバック処理
    console.error('');
    console.error(formatInfo('Rolling back due to error...', options.color));

    // DBレコードを元のフェーズに戻す
    try {
      await db
        .updateTable('specs')
        .set({
          phase: oldPhase,
        })
        .where('id', '=', spec.id)
        .execute();
    } catch (dbError) {
      console.error('Failed to rollback database record:', dbError);
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
  const specId = process.argv[2];
  const phase = process.argv[3];

  if (!specId || !phase) {
    console.error('Error: spec-id and phase are required');
    console.error('Usage: npx tsx phase.ts <spec-id> <phase>');
    process.exit(1);
  }

  updateSpecPhase(specId, phase)
    .catch((error) => handleCLIError(error))
    .finally(() => closeDatabase());
}
