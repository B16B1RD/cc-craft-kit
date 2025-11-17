/**
 * 仕様書作成コマンド
 */

import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../../core/database/connection.js';
import { getEventBus } from '../../core/workflow/event-bus.js';
import { formatSuccess, formatHeading, formatKeyValue, formatInfo } from '../utils/output.js';
import {
  createProjectNotInitializedError,
  createValidationError,
} from '../utils/error-handler.js';
import { validateRequired } from '../utils/validation.js';

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
  options: { color: boolean } = { color: true }
): Promise<void> {
  const cwd = process.cwd();
  const takumiDir = join(cwd, '.takumi');
  const specsDir = join(takumiDir, 'specs');

  // プロジェクト初期化チェック
  if (!existsSync(takumiDir)) {
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

  // データベースに仕様書レコード作成
  console.log(formatInfo('Creating spec record in database...', options.color));
  const db = getDatabase();

  await db
    .insertInto('specs')
    .values({
      id,
      name,
      description: description || null,
      phase: 'requirements',
      created_at: now,
      updated_at: now,
    })
    .execute();

  // Markdownファイル生成
  console.log(formatInfo('Generating spec file...', options.color));
  const specPath = join(specsDir, `${id}.md`);
  const template = getRequirementsTemplate(name, description);

  // テンプレートにメタデータを挿入
  const content = template
    .replace('**仕様書 ID:** (自動生成)', `**仕様書 ID:** ${id}`)
    .replace('**作成日時:** (自動生成)', `**作成日時:** ${new Date(now).toLocaleString()}`)
    .replace('**更新日時:** (自動生成)', `**更新日時:** ${new Date(now).toLocaleString()}`);

  writeFileSync(specPath, content, 'utf-8');

  // Note: content カラムはスキーマに存在しないため、ファイルのみに保存

  // spec.created イベントを発行
  const eventBus = getEventBus();
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
  console.log('  2. View the spec: /takumi:spec-get ' + id.substring(0, 8));
  console.log('  3. Move to design phase: /takumi:spec-phase ' + id.substring(0, 8) + ' design');
}
