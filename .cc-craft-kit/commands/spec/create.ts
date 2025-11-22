/**
 * 仕様書作成コマンド
 */

import '../../core/config/env.js';
import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { getDatabase, closeDatabase } from '../../core/database/connection.js';
import { getEventBusAsync } from '../../core/workflow/event-bus.js';
import { formatSuccess, formatHeading, formatKeyValue, formatInfo } from '../utils/output.js';
import {
  createProjectNotInitializedError,
  createValidationError,
  handleCLIError,
} from '../utils/error-handler.js';
import { validateRequired } from '../utils/validation.js';
import { getCurrentDateTimeForSpec } from '../../core/utils/date-format.js';
import { fsyncFileAndDirectory } from '../../core/utils/fsync.js';
import { getCurrentBranch, clearBranchCache } from '../../core/git/branch-cache.js';
import { createSpecBranch } from '../../core/git/branch-creation.js';

/**
 * Requirements テンプレート
 */
function getRequirementsTemplate(name: string, description?: string): string {
  return `# ${name}

**仕様書 ID:** (自動生成)
**フェーズ:** requirements
**作成日時:** (自動生成)
**更新日時:** (自動生成)

---

## 1. 背景と目的

### 背景

${description || '(背景を記述してください)'}

### 目的

(この仕様の目的を記述してください)

---

## 2. 対象ユーザー

(この機能の対象ユーザーを記述してください)

---

## 3. 受け入れ基準

### 必須要件

- [ ] (必須要件1)
- [ ] (必須要件2)

### 機能要件

- [ ] (機能要件1)
- [ ] (機能要件2)

### 非機能要件

- [ ] (非機能要件1)
- [ ] (非機能要件2)

---

## 4. 制約条件

(制約条件を記述してください)

---

## 5. 依存関係

(依存する他の仕様やコンポーネントを記述してください)

---

## 6. 参考情報

- (参考資料やリンク)
`;
}

/**
 * 仕様書作成
 */
export async function createSpec(
  name: string,
  description?: string,
  options: { color: boolean; branchName?: string } = { color: true }
): Promise<void> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const specsDir = join(ccCraftKitDir, 'specs');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    throw createProjectNotInitializedError();
  }

  // 必須引数チェック
  validateRequired(name, 'name');

  // 仕様書名の長さチェック
  if (name.trim().length === 0) {
    throw createValidationError('name', 'Spec name cannot be empty');
  }

  if (name.length > 200) {
    throw createValidationError('name', 'Spec name must be at most 200 characters');
  }

  console.log(formatHeading('Creating Specification', 1, options.color));
  console.log('');

  // UUID生成
  const id = randomUUID();
  const now = new Date().toISOString();
  const formattedDateTime = getCurrentDateTimeForSpec();

  // データベースに仕様書レコード作成
  console.log(formatInfo('Creating spec record in database...', options.color));
  const db = getDatabase();

  const specPath = join(specsDir, `${id}.md`);

  // ブランチ作成結果
  let branchCreated = false;
  let branchName: string | null = null;
  let originalBranch: string | null = null;

  try {
    // 0. ブランチ作成（仕様書作成時に自動作成）
    const branchResult = options.branchName
      ? createSpecBranch(id, options.branchName)
      : createSpecBranch(id);

    if (branchResult.created && branchResult.branchName) {
      branchCreated = true;
      branchName = branchResult.branchName;
      originalBranch = branchResult.originalBranch;

      // ブランチキャッシュをクリア（次回の getCurrentBranch() で最新を取得）
      clearBranchCache();

      console.log(
        formatInfo(
          `Created branch: ${branchResult.branchName}, switched back to ${branchResult.originalBranch}`,
          options.color
        )
      );
    } else {
      originalBranch = branchResult.originalBranch;
      console.log(
        formatInfo(branchResult.reason || 'ブランチ作成をスキップしました。', options.color)
      );
    }

    // 1. データベースレコード作成
    await db
      .insertInto('specs')
      .values({
        id,
        name,
        description: description || null,
        phase: 'requirements',
        branch_name: branchCreated && branchName ? branchName : getCurrentBranch(),
        created_at: now,
        updated_at: now,
      })
      .execute();

    // 2. Markdownファイル生成 + fsync()
    console.log(formatInfo('Generating spec file...', options.color));
    const template = getRequirementsTemplate(name, description);

    // テンプレートにメタデータを挿入（日時形式を統一）
    const content = template
      .replace('**仕様書 ID:** (自動生成)', `**仕様書 ID:** ${id}`)
      .replace('**作成日時:** (自動生成)', `**作成日時:** ${formattedDateTime}`)
      .replace('**更新日時:** (自動生成)', `**更新日時:** ${formattedDateTime}`);

    writeFileSync(specPath, content, 'utf-8');

    // バッファフラッシュ（ファイル + ディレクトリ）
    fsyncFileAndDirectory(specPath);

    // 3. spec.created イベント発火（非同期ハンドラー登録を待機）
    const eventBus = await getEventBusAsync();
    await eventBus.emit(
      eventBus.createEvent('spec.created', id, {
        name,
        description: description || null,
        phase: 'requirements',
      })
    );

    console.log('');
    console.log(formatSuccess('Specification created successfully!', options.color));
    console.log('');
    console.log(formatKeyValue('Spec ID', id, options.color));
    console.log(formatKeyValue('Name', name, options.color));
    console.log(formatKeyValue('Phase', 'requirements', options.color));
    console.log(formatKeyValue('File', specPath, options.color));
    console.log('');
    console.log('Next steps:');
    console.log('  1. Edit the spec file to define requirements');
    console.log('  2. View the spec: /cft:spec-get ' + id.substring(0, 8));
    console.log('  3. Move to design phase: /cft:spec-phase ' + id.substring(0, 8) + ' design');
  } catch (error) {
    // エラー時のロールバック処理
    console.error('');
    console.error(formatInfo('Rolling back due to error...', options.color));

    // ブランチ削除（作成された場合のみ）
    if (branchCreated && originalBranch && branchName) {
      try {
        execSync(`git checkout ${originalBranch}`, { stdio: 'ignore' });
        execSync(`git branch -D ${branchName}`, { stdio: 'ignore' });
        console.error(`Deleted branch: ${branchName}`);
      } catch (branchError) {
        console.error('Failed to rollback branch:', branchError);
      }
    }

    // DBレコード削除
    try {
      await db.deleteFrom('specs').where('id', '=', id).execute();
    } catch (dbError) {
      console.error('Failed to rollback database record:', dbError);
    }

    // ファイル削除
    try {
      if (existsSync(specPath)) {
        unlinkSync(specPath);
      }
    } catch (fsError) {
      console.error('Failed to rollback spec file:', fsError);
    }

    // エラーを再スロー
    throw error;
  }
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const name = process.argv[2];
  const description = process.argv[3];

  // --branch-name オプションのパース
  const branchNameIndex = process.argv.indexOf('--branch-name');
  const branchName = branchNameIndex !== -1 ? process.argv[branchNameIndex + 1] : undefined;

  if (!name) {
    console.error('Error: spec-name is required');
    console.error('Usage: npx tsx create.ts <spec-name> [description] [--branch-name <name>]');
    process.exit(1);
  }

  createSpec(name, description, { color: true, branchName })
    .catch((error) => handleCLIError(error))
    .finally(() => closeDatabase());
}
