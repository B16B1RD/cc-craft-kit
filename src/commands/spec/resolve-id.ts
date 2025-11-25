/**
 * 仕様書 ID 解決スクリプト
 *
 * 部分 ID から完全な仕様書情報を解決します。
 * プロンプトから呼び出される最小限のスクリプトです。
 */

import '../../core/config/env.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase, closeDatabase } from '../../core/database/connection.js';
import { validateSpecId } from '../utils/validation.js';

/**
 * 解決結果の型定義
 */
interface ResolveIdOutput {
  success: boolean;
  spec?: {
    id: string;
    name: string;
    phase: string;
    branch_name: string | null;
    spec_path: string;
    github_issue_number?: number | null;
  };
  error?: string;
}

/**
 * 仕様書 ID を解決して完全な情報を取得
 */
async function resolveSpecId(partialId: string): Promise<ResolveIdOutput> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    return {
      success: false,
      error: 'Project not initialized. Run /cft:init first.',
    };
  }

  // 仕様書IDの検証
  try {
    validateSpecId(partialId);
  } catch {
    return {
      success: false,
      error: `Invalid spec ID: ${partialId}. Must be at least 8 characters.`,
    };
  }

  // データベース取得
  const db = getDatabase();

  // 仕様書検索（部分一致対応）
  const spec = await db
    .selectFrom('specs')
    .selectAll()
    .where('id', 'like', `${partialId}%`)
    .executeTakeFirst();

  if (!spec) {
    return {
      success: false,
      error: `Spec not found: ${partialId}`,
    };
  }

  // github_sync テーブルから GitHub Issue 番号を取得
  const sync = await db
    .selectFrom('github_sync')
    .select(['issue_number'])
    .where('entity_type', '=', 'spec')
    .where('entity_id', '=', spec.id)
    .executeTakeFirst();

  // 仕様書ファイルパス
  const specPath = join(ccCraftKitDir, 'specs', `${spec.id}.md`);

  return {
    success: true,
    spec: {
      id: spec.id,
      name: spec.name,
      phase: spec.phase,
      branch_name: spec.branch_name,
      spec_path: specPath,
      github_issue_number: sync?.issue_number ?? null,
    },
  };
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const partialId = args[0];

  if (!partialId) {
    const errorOutput: ResolveIdOutput = {
      success: false,
      error: 'Usage: npx tsx resolve-id.ts <spec-id>',
    };
    console.log(JSON.stringify(errorOutput, null, 2));
    process.exit(1);
  }

  resolveSpecId(partialId)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      const errorOutput: ResolveIdOutput = {
        success: false,
        error: message,
      };
      console.log(JSON.stringify(errorOutput, null, 2));
      process.exit(1);
    })
    .finally(() => closeDatabase());
}

export { resolveSpecId, type ResolveIdOutput };
