#!/usr/bin/env node
/**
 * MCP起動エラーSpec作成スクリプト
 */
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DatabaseSchema {
  specs: {
    id: string;
    name: string;
    description: string | null;
    phase: string;
    content: string | null;
    github_issue_number: number | null;
    created_at: string;
    updated_at: string;
  };
}

async function createSpec() {
  const projectRoot = path.resolve(__dirname, '..');
  const dbPath = path.join(projectRoot, '.cc-craft-kit', 'cc-craft-kit.db');

  const db = new Database(dbPath);
  const kysely = new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: db }),
  });

  const specId = randomUUID();
  const now = new Date().toISOString();

  const specData = {
    id: specId,
    name: 'Takumi MCPサーバーが起動しない原因の調査と解決',
    description: 'MCPサーバー起動時のマイグレーションエラー（table "specs" already exists）を修正する',
    phase: 'requirements' as const,
    content: `# Takumi MCPサーバー起動エラー修正仕様書

## 問題の概要

MCPサーバーを起動しようとすると、以下のエラーが発生する：

\`\`\`
✗ Migration "001_initial_schema" failed
Migration failed: SqliteError: table "specs" already exists
\`\`\`

## 原因分析

### 根本原因
1. **マイグレーション履歴の不整合**
   - \`kysely_migration\`テーブルは存在するが、レコードが空
   - \`scripts/init-dogfooding.ts\`で手動作成したテーブルの存在をマイグレーションシステムが認識していない

2. **スキーマの不一致**
   - \`scripts/init-dogfooding.ts\`: \`github_issue_number\`, \`assigned_to\`
   - \`001_initial_schema.ts\`: \`github_issue_id\`, \`assignee\`, \`github_project_id\`, \`github_milestone_id\`

3. **マイグレーション実装の問題**
   - \`.ifNotExists()\`が使用されていない
   - 既存テーブルのチェックなし

## 解決策

### オプション1: マイグレーション履歴を手動で記録（推奨）

既存のテーブルスキーマを維持し、マイグレーション履歴だけを記録する。

**手順:**
1. 現在のスキーマを確認
2. \`kysely_migration\`テーブルに\`001_initial_schema\`を手動でINSERT
3. MCPサーバーを再起動

**メリット:**
- データ損失なし
- 既存のSpecやデータを保持
- 最も安全

**デメリット:**
- スキーマ不一致は残る（後で修正が必要）

### オプション2: データベースを再初期化

\`.cc-craft-kit/cc-craft-kit.db\`を削除して、マイグレーションシステムで再作成。

**手順:**
1. データベースをバックアップ
2. \`.cc-craft-kit/cc-craft-kit.db\`を削除
3. MCPサーバーを起動（マイグレーション自動実行）
4. Specを再作成

**メリット:**
- クリーンな状態
- スキーマの完全一致

**デメリット:**
- 既存のSpec/タスクデータが消える

### オプション3: マイグレーション修正 + スキーマ統一

マイグレーションに\`.ifNotExists()\`を追加し、スキーマを統一。

**手順:**
1. \`001_initial_schema.ts\`に\`.ifNotExists()\`を追加
2. スキーマ不一致を解消するマイグレーション追加
3. MCPサーバーを起動

**メリット:**
- データ保持
- 正しいマイグレーション履歴

**デメリット:**
- 実装コストが高い

## 推奨アプローチ: オプション1

ドッグフーディング初期段階のため、**オプション1（マイグレーション履歴を手動記録）**を推奨。

### 実装手順

#### Step 1: マイグレーション履歴を手動記録

\`\`\`sql
INSERT INTO kysely_migration (name, timestamp)
VALUES ('001_initial_schema', datetime('now'));
\`\`\`

#### Step 2: MCPサーバー起動確認

\`\`\`bash
npm run mcp:dev
\`\`\`

#### Step 3: スキーマ不一致の対応（後日）

新しいマイグレーション\`002_fix_schema.ts\`を作成：
- \`github_issue_id\`カラムを追加（\`github_issue_number\`との互換性維持）
- \`github_project_id\`, \`github_milestone_id\`カラムを追加

## 検証計画

### テスト項目

1. **MCPサーバー起動テスト**
   - \`npm run mcp:dev\`がエラーなく起動すること
   - マイグレーションエラーが発生しないこと

2. **MCPツール動作テスト**
   - \`takumi:list_specs\`が動作すること
   - 既存のSpec（WebUIダッシュボード）が取得できること

3. **新規Spec作成テスト**
   - \`takumi:create_spec\`でSpecが作成できること
   - データベースに正しく保存されること

## 受け入れ基準

- ✅ MCPサーバーがエラーなく起動する
- ✅ 既存のSpecデータが保持されている
- ✅ MCPツールが正常に動作する
- ✅ マイグレーション履歴が正しく記録されている

## 制約条件

- 既存のSpecデータを失わないこと
- GitHub Issue #1との連携を維持すること

## 依存関係

- なし（独立したバグ修正）

## 次のフェーズ

Requirements承認後、すぐに実装フェーズに移行して修正を適用する。
`,
    github_issue_number: null,
    created_at: now,
    updated_at: now,
  };

  await kysely.insertInto('specs').values(specData).execute();

  console.log('✅ Spec作成完了\n');
  console.log('📋 Spec情報:');
  console.log(`  ID: ${specId}`);
  console.log(`  名前: ${specData.name}`);
  console.log(`  フェーズ: ${specData.phase}`);
  console.log(`  作成日: ${new Date(now).toLocaleString()}\n`);

  await kysely.destroy();
  db.close();

  console.log('🔧 推奨される即時対応:');
  console.log('  npx tsx scripts/fix-migration-history.ts');
}

createSpec().catch((error) => {
  console.error('❌ Spec作成エラー:', error);
  process.exit(1);
});
