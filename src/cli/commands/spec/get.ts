/**
 * 仕様書取得コマンド
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../../../core/database/connection.js';
import {
  formatHeading,
  formatKeyValue,
  formatMarkdown,
} from '../../utils/output.js';
import {
  createProjectNotInitializedError,
  createSpecNotFoundError,
} from '../../utils/error-handler.js';
import { validateSpecId } from '../../utils/validation.js';

/**
 * 仕様書取得
 */
export async function getSpec(
  specId: string,
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

  // Markdownファイル読み込み
  const specPath = join(takumiDir, 'specs', `${spec.id}.md`);
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
  console.log(
    formatKeyValue(
      'Description',
      spec.description || '(none)',
      options.color
    )
  );
  console.log(
    formatKeyValue(
      'GitHub Issue',
      spec.github_issue_id ? `#${spec.github_issue_id}` : '(not created)',
      options.color
    )
  );
  console.log(
    formatKeyValue(
      'Created',
      new Date(spec.created_at).toLocaleString(),
      options.color
    )
  );
  console.log(
    formatKeyValue(
      'Updated',
      new Date(spec.updated_at).toLocaleString(),
      options.color
    )
  );
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
  console.log(`  • Update phase: takumi spec phase ${spec.id.substring(0, 8)} <phase>`);
  if (!spec.github_issue_id) {
    console.log(`  • Create GitHub issue: takumi github issue create ${spec.id.substring(0, 8)}`);
  }
}
