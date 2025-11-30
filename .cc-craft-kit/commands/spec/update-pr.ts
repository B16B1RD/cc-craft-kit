/**
 * PR 情報更新コマンド
 *
 * PR 番号・URL をデータベース (github_sync テーブル) に記録する
 */

import '../../core/config/env.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getDatabase, closeDatabase } from '../../core/database/connection.js';
import { formatSuccess, formatHeading, formatKeyValue, formatError } from '../utils/output.js';
import { handleCLIError } from '../utils/error-handler.js';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/database/schema.js';

/**
 * 引数スキーマ
 */
const argsSchema = z.object({
  specId: z.string().uuid('Invalid spec ID format'),
  prNumber: z.number().int().positive('PR number must be positive integer'),
  prUrl: z.string().url('Invalid PR URL format'),
});

/**
 * PR 情報更新オプション
 */
export interface UpdatePullRequestOptions {
  color?: boolean;
  db?: Kysely<Database>; // テスト用にデータベース接続を注入
}

/**
 * PR 情報更新
 */
export async function updatePullRequest(
  specId: string,
  prNumber: number,
  prUrl: string,
  options: UpdatePullRequestOptions = { color: true },
  closeDbAfterUpdate = true
): Promise<void> {
  try {
    // 引数バリデーション
    const parsed = argsSchema.parse({
      specId,
      prNumber,
      prUrl,
    });

    console.log(formatHeading('Updating Pull Request Information', 1, options.color));
    console.log(formatKeyValue('Spec ID', parsed.specId, options.color));
    console.log(formatKeyValue('PR Number', `#${parsed.prNumber}`, options.color));
    console.log(formatKeyValue('PR URL', parsed.prUrl, options.color));
    console.log('');

    const db = options.db || getDatabase();

    // トランザクション開始
    await db.transaction().execute(async (trx) => {
      // 既存レコード確認
      const existing = await trx
        .selectFrom('github_sync')
        .where('entity_id', '=', parsed.specId)
        .where('entity_type', '=', 'spec')
        .selectAll()
        .executeTakeFirst();

      if (existing) {
        // 既存レコード更新
        await trx
          .updateTable('github_sync')
          .set({
            pr_number: parsed.prNumber,
            pr_url: parsed.prUrl,
            sync_status: 'success',
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .where('id', '=', existing.id)
          .execute();
      } else {
        // 新規レコード作成
        await trx
          .insertInto('github_sync')
          .values({
            id: randomUUID(),
            entity_type: 'spec',
            entity_id: parsed.specId,
            github_id: '',
            github_number: null,
            github_node_id: null,
            issue_number: null,
            issue_url: null,
            pr_number: parsed.prNumber,
            pr_url: parsed.prUrl,
            pr_merged_at: null,
            sync_status: 'success',
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            error_message: null,
          })
          .execute();
      }
    });

    console.log(
      formatSuccess(`Pull Request #${parsed.prNumber} recorded successfully.`, options.color)
    );

    if (closeDbAfterUpdate) {
      await closeDatabase();
    }
  } catch (error) {
    if (closeDbAfterUpdate) {
      await closeDatabase();
      handleCLIError(error, options.color);
    }
    throw error;
  }
}

/**
 * CLI エントリーポイント
 *
 * 直接実行時のみ実行される（テスト時はスキップ）
 */
/* istanbul ignore next */
// eslint-disable-next-line no-undef
if (typeof require !== 'undefined' && require.main === module) {
  const args = process.argv.slice(2);

  if (args.length !== 3) {
    console.error(formatError('Usage: npx tsx update-pr.ts <spec-id> <pr-number> <pr-url>', true));
    process.exit(1);
  }

  const specId = args[0];
  const prNumber = parseInt(args[1], 10);
  const prUrl = args[2];

  updatePullRequest(specId, prNumber, prUrl).catch((error) => {
    console.error(formatError(`Fatal error: ${error.message}`, true));
    process.exit(1);
  });
}
