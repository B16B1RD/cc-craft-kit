/**
 * PR 情報更新コマンド
 *
 * PR 番号・URL をデータベース (github_sync テーブル) に記録する
 */

import '../../core/config/env.js';
import { z } from 'zod';
import {
  getGitHubSyncBySpecId,
  addGitHubSync,
  updateGitHubSyncByEntity,
} from '../../core/storage/index.js';
import { formatSuccess, formatHeading, formatKeyValue, formatError } from '../utils/output.js';
import { handleCLIError } from '../utils/error-handler.js';

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
}

/**
 * PR 情報更新
 */
export function updatePullRequest(
  specId: string,
  prNumber: number,
  prUrl: string,
  options: UpdatePullRequestOptions = { color: true }
): void {
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

  // 既存レコード確認
  const existing = getGitHubSyncBySpecId(parsed.specId);

  if (existing) {
    // 既存レコード更新
    updateGitHubSyncByEntity(parsed.specId, 'spec', {
      pr_number: parsed.prNumber,
      pr_url: parsed.prUrl,
      sync_status: 'success',
    });
  } else {
    // 新規レコード作成
    addGitHubSync({
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
      error_message: null,
      checkbox_hash: null,
      last_body_hash: null,
      parent_issue_number: null,
      parent_spec_id: null,
    });
  }

  console.log(
    formatSuccess(`Pull Request #${parsed.prNumber} recorded successfully.`, options.color)
  );
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length !== 3) {
    console.error(formatError('Usage: npx tsx update-pr.ts <spec-id> <pr-number> <pr-url>', true));
    process.exit(1);
  }

  const specId = args[0];
  const prNumber = parseInt(args[1], 10);
  const prUrl = args[2];

  try {
    updatePullRequest(specId, prNumber, prUrl);
  } catch (error) {
    handleCLIError(error);
  }
}
