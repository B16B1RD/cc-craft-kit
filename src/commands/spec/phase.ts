/**
 * 仕様書フェーズ更新コマンド
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../../core/database/connection.js';
import { getEventBusAsync } from '../../core/workflow/event-bus.js';
import { formatSuccess, formatHeading, formatKeyValue, formatInfo } from '../utils/output.js';
import {
  createProjectNotInitializedError,
  createSpecNotFoundError,
} from '../utils/error-handler.js';
import { validateSpecId, validatePhase, Phase } from '../utils/validation.js';

/**
 * 仕様書フェーズ更新
 */
export async function updateSpecPhase(
  specId: string,
  newPhase: string,
  options: { color: boolean } = { color: true }
): Promise<void> {
  const cwd = process.cwd();
  const takumiDir = join(cwd, '.takumi');

  // プロジェクト初期化チェック
  if (!existsSync(takumiDir)) {
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

  // データベース更新
  console.log(formatInfo('Updating database...', options.color));
  const now = new Date().toISOString();

  await db
    .updateTable('specs')
    .set({
      phase: validatedPhase,
      updated_at: now,
    })
    .where('id', '=', spec.id)
    .execute();

  // Markdownファイル更新（フェーズ情報を更新）
  const specPath = join(takumiDir, 'specs', `${spec.id}.md`);
  if (existsSync(specPath)) {
    console.log(formatInfo('Updating spec file...', options.color));
    let content = readFileSync(specPath, 'utf-8');

    // フェーズ行を更新
    content = content.replace(/\*\*フェーズ:\*\* .+/, `**フェーズ:** ${validatedPhase}`);

    // 更新日時を更新
    content = content.replace(
      /\*\*更新日時:\*\* .+/,
      `**更新日時:** ${new Date(now).toLocaleString()}`
    );

    writeFileSync(specPath, content, 'utf-8');
  }

  // イベント発火（GitHub統合のため）
  const eventBus = await getEventBusAsync();
  await eventBus.emit(
    eventBus.createEvent('spec.phase_changed', spec.id, {
      oldPhase: spec.phase,
      newPhase: validatedPhase,
    })
  );

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
      console.log('  • Move to design: /takumi:spec-phase ' + spec.id.substring(0, 8) + ' design');
      break;

    case 'design':
      console.log('  • Create detailed design in the spec file');
      console.log('  • Add architecture, API design, and data models');
      console.log('  • Move to tasks: /takumi:spec-phase ' + spec.id.substring(0, 8) + ' tasks');
      break;

    case 'tasks':
      console.log('  • Break down into implementable tasks');
      console.log('  • Estimate effort and dependencies');
      console.log(
        '  • Move to implementation: /takumi:spec-phase ' +
          spec.id.substring(0, 8) +
          ' implementation'
      );
      break;

    case 'implementation':
      console.log('  • Implement the tasks');
      console.log('  • Write tests and documentation');
      console.log(
        '  • Move to completed: /takumi:spec-phase ' + spec.id.substring(0, 8) + ' completed'
      );
      break;

    case 'completed':
      console.log('  • Review the implementation');
      console.log('  • Archive or close related GitHub issues');
      console.log('  • Create new specs for follow-up work');
      break;
  }
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

  updateSpecPhase(specId, phase).catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
