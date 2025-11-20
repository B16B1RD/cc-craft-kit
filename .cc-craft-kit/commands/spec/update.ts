/**
 * 仕様書更新通知コマンド
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase, closeDatabase } from '../../core/database/connection.js';
import { getEventBusAsync } from '../../core/workflow/event-bus.js';
import { formatSuccess, formatHeading, formatKeyValue } from '../utils/output.js';
import {
  createProjectNotInitializedError,
  createSpecNotFoundError,
  handleCLIError,
} from '../utils/error-handler.js';
import { validateSpecId } from '../utils/validation.js';

/**
 * 仕様書更新通知
 */
export async function updateSpec(
  specId: string,
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

  console.log(formatHeading('Updating Specification', 1, options.color));
  console.log('');
  console.log(formatKeyValue('Spec ID', spec.id, options.color));
  console.log(formatKeyValue('Spec Name', spec.name, options.color));
  console.log('');

  // updated_at を現在時刻に更新
  const now = new Date().toISOString();
  await db.updateTable('specs').set({ updated_at: now }).where('id', '=', spec.id).execute();

  console.log(formatSuccess('Database updated_at timestamp updated', options.color));

  // spec.updated イベントを発火（GitHub Issue に自動コメント）
  const eventBus = await getEventBusAsync();
  await eventBus.emit(
    eventBus.createEvent('spec.updated', spec.id, {
      name: spec.name,
      phase: spec.phase,
      updatedAt: now,
    })
  );

  console.log(formatSuccess('spec.updated event emitted', options.color));
  console.log('');

  if (spec.github_issue_id) {
    console.log(formatKeyValue('GitHub Issue', `#${spec.github_issue_id}`, options.color));
    console.log(formatSuccess('Update notification posted to GitHub Issue', options.color));
  } else {
    console.log(formatKeyValue('GitHub Issue', 'Not linked', options.color));
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const specId = process.argv[2];

  if (!specId) {
    console.error('Usage: npx tsx update.ts <spec-id>');
    process.exit(1);
  }

  updateSpec(specId)
    .catch((error) => handleCLIError(error))
    .finally(() => closeDatabase());
}
