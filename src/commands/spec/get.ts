/**
 * 仕様書取得コマンド
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { getSpecsWithGitHubInfo, type SpecWithGitHub } from '../../core/storage/index.js';
import { formatHeading, formatKeyValue, formatMarkdown } from '../utils/output.js';
import { createProjectNotInitializedError, handleCLIError } from '../utils/error-handler.js';
import { validateSpecId } from '../utils/validation.js';
import { getCurrentBranch } from '../../core/git/branch-cache.js';
import { promptBranchSwitch, switchBranch, ERROR_MESSAGES } from './branch-switch.js';

/**
 * ブランチ不一致を処理する
 */
async function handleBranchMismatch(
  spec: SpecWithGitHub,
  currentBranch: string,
  ccCraftKitDir: string,
  options: { color: boolean }
): Promise<void> {
  // エラーメッセージを表示
  console.error(
    ERROR_MESSAGES.BRANCH_MISMATCH(
      { id: spec.id, name: spec.name },
      spec.branch_name || '(unknown)',
      currentBranch
    )
  );

  // ユーザーに選択を促す
  const shouldSwitch = await promptBranchSwitch(currentBranch, spec.branch_name || '', {
    id: spec.id,
    name: spec.name,
  });

  if (!shouldSwitch) {
    console.log('キャンセルしました。');
    process.exit(0);
  }

  // ブランチを切り替え
  const result = await switchBranch({
    targetBranch: spec.branch_name || '',
    specId: spec.id,
    checkUnsavedChanges: true,
  });

  if (!result.success) {
    console.error(chalk.red(`❌ ${result.error}`));
    process.exit(1);
  }

  // 成功メッセージ
  console.log(chalk.green('✓ ブランチを切り替えました'));
  console.log('');

  // 再度仕様書を表示
  displaySpec(spec, ccCraftKitDir, options);
}

/**
 * 仕様書を表示する
 */
function displaySpec(
  spec: SpecWithGitHub,
  ccCraftKitDir: string,
  options: { color: boolean }
): void {
  // TODO: GitHub Issue 自動リカバリーは Phase 3 で JSON ストレージ対応後に再実装

  // Markdownファイル読み込み
  const specPath = join(ccCraftKitDir, 'specs', `${spec.id}.md`);
  let content = '';

  if (existsSync(specPath)) {
    content = readFileSync(specPath, 'utf-8');
  } else {
    content = `# ${spec.name}\n\n仕様書ファイルが見つかりません。`;
  }

  // メタデータ表示
  console.log(formatHeading('Specification Details', 1, options.color));
  console.log('');
  console.log(formatKeyValue('ID', spec.id, options.color));
  console.log(formatKeyValue('Name', spec.name, options.color));
  console.log(formatKeyValue('Phase', spec.phase, options.color));
  console.log(formatKeyValue('Description', spec.description || '(none)', options.color));
  console.log(
    formatKeyValue(
      'GitHub Issue',
      spec.github_issue_number ? `#${spec.github_issue_number}` : '(not created)',
      options.color
    )
  );
  console.log(formatKeyValue('Created', new Date(spec.created_at).toLocaleString(), options.color));
  console.log(formatKeyValue('Updated', new Date(spec.updated_at).toLocaleString(), options.color));
  console.log('');

  // コンテンツ表示
  console.log(formatHeading('Content', 2, options.color));
  console.log('');
  console.log(formatMarkdown(content));
  console.log('');

  // 次のアクション
  console.log(formatHeading('Next Actions', 2, options.color));
  console.log('');
  console.log(`  • Edit the file: ${specPath}`);
  console.log(`  • Update phase: /cft:spec-phase ${spec.id.substring(0, 8)} <phase>`);
  if (!spec.github_issue_number) {
    console.log(`  • Create GitHub issue: /cft:github-issue-create ${spec.id.substring(0, 8)}`);
  }
}

/**
 * 仕様書取得
 */
export async function getSpec(
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

  // 現在のブランチを取得
  const currentBranch = getCurrentBranch();

  // JSON ストレージからすべての仕様書を取得
  const allSpecs = getSpecsWithGitHubInfo();

  // 仕様書 ID で検索
  const matchedSpec = allSpecs.find((s) => s.id.startsWith(specId));

  if (!matchedSpec) {
    // 仕様書が存在しない
    console.error(ERROR_MESSAGES.SPEC_NOT_FOUND(specId));
    process.exit(1);
  }

  // ブランチフィルタリングを適用
  const allowedBranches =
    currentBranch === 'main' || currentBranch === 'develop'
      ? ['main', 'develop']
      : ['main', 'develop', currentBranch];

  const specBranch = matchedSpec.branch_name || '';

  if (!allowedBranches.includes(specBranch)) {
    // ブランチが異なる
    await handleBranchMismatch(matchedSpec, currentBranch, ccCraftKitDir, options);
    return;
  }

  // 仕様書を表示
  displaySpec(matchedSpec, ccCraftKitDir, options);
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const specId = process.argv[2];

  if (!specId) {
    console.error('Error: spec-id is required');
    console.error('Usage: npx tsx get.ts <spec-id>');
    process.exit(1);
  }

  getSpec(specId).catch((error) => handleCLIError(error));
}
