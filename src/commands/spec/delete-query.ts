/**
 * 仕様書削除 - Query 層
 *
 * 削除対象の仕様書情報を取得します。
 * プロンプトから呼び出され、JSON 出力のみを行います。
 */

import '../../core/config/env.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findSpecByIdPrefix, loadSpecs, getGitHubSyncBySpecId } from '../../core/storage/index.js';
import { validateSpecId } from '../utils/validation.js';

/**
 * Query 層の出力型定義
 */
export interface DeleteQueryOutput {
  success: boolean;
  spec?: {
    id: string;
    name: string;
    phase: string;
    branch_name: string | null;
    github_issue_number: number | null;
    file_path: string;
  };
  error?: string;
}

/**
 * 削除対象の仕様書情報を取得
 */
export function queryDeleteTarget(partialId: string): DeleteQueryOutput {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const specsDir = join(ccCraftKitDir, 'specs');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    return {
      success: false,
      error: 'プロジェクトが初期化されていません。/cft:init を実行してください。',
    };
  }

  // 仕様書 ID の検証
  try {
    validateSpecId(partialId);
  } catch {
    return {
      success: false,
      error: `無効な仕様書 ID: ${partialId}（最低 8 文字必要です）`,
    };
  }

  // 仕様書検索（前方一致）
  const spec = findSpecByIdPrefix(partialId);

  if (!spec) {
    // 複数候補があるかチェック
    const allSpecs = loadSpecs();
    const matches = allSpecs.filter((s) => s.id.startsWith(partialId));

    if (matches.length > 1) {
      const candidates = matches.map((s) => `  - ${s.id.substring(0, 8)}: ${s.name}`).join('\n');
      return {
        success: false,
        error: `複数の仕様書が該当します。より具体的な ID を指定してください:\n${candidates}`,
      };
    }

    return {
      success: false,
      error: `仕様書が見つかりません: ${partialId}`,
    };
  }

  // github-sync.json から GitHub Issue 番号を取得
  const sync = getGitHubSyncBySpecId(spec.id);

  // 仕様書ファイルパス
  const filePath = join(specsDir, `${spec.id}.md`);

  return {
    success: true,
    spec: {
      id: spec.id,
      name: spec.name,
      phase: spec.phase,
      branch_name: spec.branch_name,
      github_issue_number: sync?.github_number ?? null,
      file_path: filePath,
    },
  };
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const partialId = args[0];

  if (!partialId) {
    const errorOutput: DeleteQueryOutput = {
      success: false,
      error: 'Usage: npx tsx delete-query.ts <spec-id>',
    };
    console.log(JSON.stringify(errorOutput, null, 2));
    process.exit(1);
  }

  try {
    const result = queryDeleteTarget(partialId);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const errorOutput: DeleteQueryOutput = {
      success: false,
      error: message,
    };
    console.log(JSON.stringify(errorOutput, null, 2));
    process.exit(1);
  }
}
