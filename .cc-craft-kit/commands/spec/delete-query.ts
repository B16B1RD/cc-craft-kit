/**
 * 仕様書削除 - Query 層
 *
 * 削除対象の仕様書情報を取得します。
 * プロンプトから呼び出され、JSON 出力のみを行います。
 */

import '../../core/config/env.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase, closeDatabase } from '../../core/database/connection.js';
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
export async function queryDeleteTarget(partialId: string): Promise<DeleteQueryOutput> {
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

  // データベース取得
  const db = getDatabase();

  // 仕様書検索（部分一致対応）
  const specs = await db
    .selectFrom('specs')
    .selectAll()
    .where('id', 'like', `${partialId}%`)
    .execute();

  if (specs.length === 0) {
    return {
      success: false,
      error: `仕様書が見つかりません: ${partialId}`,
    };
  }

  if (specs.length > 1) {
    const candidates = specs.map((s) => `  - ${s.id.substring(0, 8)}: ${s.name}`).join('\n');
    return {
      success: false,
      error: `複数の仕様書が該当します。より具体的な ID を指定してください:\n${candidates}`,
    };
  }

  const spec = specs[0];

  // github_sync テーブルから GitHub Issue 番号を取得
  const sync = await db
    .selectFrom('github_sync')
    .select(['issue_number'])
    .where('entity_type', '=', 'spec')
    .where('entity_id', '=', spec.id)
    .executeTakeFirst();

  // 仕様書ファイルパス
  const filePath = join(specsDir, `${spec.id}.md`);

  return {
    success: true,
    spec: {
      id: spec.id,
      name: spec.name,
      phase: spec.phase,
      branch_name: spec.branch_name,
      github_issue_number: sync?.issue_number ?? null,
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

  queryDeleteTarget(partialId)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      const errorOutput: DeleteQueryOutput = {
        success: false,
        error: message,
      };
      console.log(JSON.stringify(errorOutput, null, 2));
      process.exit(1);
    })
    .finally(() => closeDatabase());
}
