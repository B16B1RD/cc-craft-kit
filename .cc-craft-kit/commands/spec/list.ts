/**
 * 仕様書一覧コマンド
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getSpecsWithGitHubInfo, countSpecsWithFilter } from '../../core/storage/index.js';
import { formatHeading, formatTable, formatKeyValue, OutputOptions } from '../utils/output.js';
import { createProjectNotInitializedError, handleCLIError } from '../utils/error-handler.js';
import { validatePhase, VALID_PHASES } from '../utils/validation.js';

/**
 * 仕様書一覧表示
 */
export function listSpecs(
  phase?: string,
  limit?: number,
  options: OutputOptions = { format: 'table', color: true }
): void {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    throw createProjectNotInitializedError();
  }

  // パラメータのデフォルト値
  const displayLimit = limit || 20;

  // フェーズバリデーション
  const validatedPhase = phase ? validatePhase(phase) : undefined;

  // JSON ストレージから取得
  const specs = getSpecsWithGitHubInfo({
    phase: validatedPhase,
    limit: displayLimit,
    orderBy: 'created_at',
    orderDirection: 'desc',
  });

  // 総数取得
  const total = countSpecsWithFilter(validatedPhase);

  console.log(formatHeading('Specifications', 1, options.color));
  console.log('');

  if (phase) {
    console.log(formatKeyValue('Filter', `Phase = ${phase}`, options.color));
  }
  console.log(formatKeyValue('Total', total, options.color));
  console.log(formatKeyValue('Showing', specs.length, options.color));
  console.log('');

  if (specs.length === 0) {
    console.log('No specifications found.');
    console.log('');
    console.log('Create your first spec: /cft:spec-create "<name>"');
    return;
  }

  // テーブル形式で出力
  const headers = ['ID (short)', 'Name', 'Phase', 'GitHub', 'Created'];
  const rows = specs.map((spec) => [
    spec.id.substring(0, 8) + '...',
    spec.name.length > 40 ? spec.name.substring(0, 37) + '...' : spec.name,
    spec.phase,
    spec.github_issue_number ? `#${spec.github_issue_number}` : '-',
    new Date(spec.created_at).toLocaleDateString(),
  ]);

  console.log(formatTable(headers, rows, options));
  console.log('');

  // 次のアクション
  console.log('Next actions:');
  console.log('  • View a spec: /cft:spec-get <id>');
  console.log('  • Create a spec: /cft:spec-create "<name>"');
  if (!phase) {
    console.log('  • Filter by phase: /cft:spec-list <phase>');
    console.log(`    Available phases: ${VALID_PHASES.join(', ')}`);
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const phase = process.argv[2];
  const limit = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

  try {
    listSpecs(phase, limit);
  } catch (error) {
    handleCLIError(error);
  }
}
