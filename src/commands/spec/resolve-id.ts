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
import {
  validateSpecId,
  isGitHubIssueNumber,
  parseGitHubIssueNumber,
  isSpecId,
} from '../utils/validation.js';

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
 * 仕様書 ID を解決して完全な情報を取得（部分一致）
 */
async function resolveSpecById(partialId: string, ccCraftKitDir: string): Promise<ResolveIdOutput> {
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

/**
 * GitHub Issue 番号から仕様書を解決
 */
async function resolveSpecByIssueNumber(
  issueNumber: number,
  ccCraftKitDir: string
): Promise<ResolveIdOutput> {
  const db = getDatabase();

  // github_sync テーブルから entity_type = 'spec' で issue_number を検索
  const sync = await db
    .selectFrom('github_sync')
    .select(['entity_id', 'issue_number'])
    .where('entity_type', '=', 'spec')
    .where('issue_number', '=', issueNumber)
    .executeTakeFirst();

  if (!sync) {
    return {
      success: false,
      error: `No spec found for GitHub Issue #${issueNumber}`,
    };
  }

  // 仕様書を取得
  const spec = await db
    .selectFrom('specs')
    .selectAll()
    .where('id', '=', sync.entity_id)
    .executeTakeFirst();

  if (!spec) {
    return {
      success: false,
      error: `Spec record not found for entity_id: ${sync.entity_id}`,
    };
  }

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
      github_issue_number: sync.issue_number,
    },
  };
}

/**
 * 入力を解析して仕様書を解決
 *
 * 入力形式を自動判別し、適切な方法で仕様書を検索します:
 * - "#42" または "42" 形式 → GitHub Issue 番号として検索
 * - 8文字以上の hex 文字列 → 仕様書 ID として検索
 */
async function resolveSpecId(input: string): Promise<ResolveIdOutput> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    return {
      success: false,
      error: 'Project not initialized. Run /cft:init first.',
    };
  }

  // 入力形式の自動判別
  if (isGitHubIssueNumber(input)) {
    // GitHub Issue 番号として解決
    const issueNumber = parseGitHubIssueNumber(input);
    return resolveSpecByIssueNumber(issueNumber, ccCraftKitDir);
  } else if (isSpecId(input)) {
    // 仕様書 ID として解決
    return resolveSpecById(input, ccCraftKitDir);
  } else {
    // どちらの形式にも当てはまらない
    return {
      success: false,
      error: `Invalid input format: "${input}". Expected spec ID (8+ hex chars) or GitHub Issue number (#123 or 123).`,
    };
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const partialId = args[0];

  if (!partialId) {
    const errorOutput: ResolveIdOutput = {
      success: false,
      error: 'Usage: npx tsx resolve-id.ts <spec-id|#issue-number>',
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
