# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

cc-craft-kit は、Claude Code 上で仕様駆動開発（SDD）、GitHub Projects/Issues 完全連携を実現する開発支援ツールキット。
`.cc-craft-kit/` ディレクトリベースの軽量アーキテクチャ、カスタムスラッシュコマンド、サブエージェント、スキルの統合により、開発ワークフローを革新します。

## ⚠️ 重要: ソースコードとインストール先の関係

### ディレクトリ構成

cc-craft-kit プロジェクトは、**自分自身を使って開発する（ドッグフーディング）** ため、以下のディレクトリ構造を採用しています。

| ディレクトリ | 役割 | Git管理 | 説明 |
|---|---|---|---|
| **`src/`** | **ソースコード** | ✅ | 開発時に編集する本体のTypeScriptコード |
| **`src/commands/`** | CLI実装 | ✅ | スラッシュコマンドから実行されるCLI実装 |
| **`src/slash-commands/`** | スラッシュコマンド定義 | ✅ | Claude Codeのスラッシュコマンド定義 (`.md`) |
| **`src/scripts/`** | 同期・マイグレーションスクリプト | ✅ | 整合性チェック、自動同期、マイグレーションツール |
| **`.claude/commands/cc-craft-kit/`** | シンボリックリンク | ✅ | `src/slash-commands/` へのシンボリックリンク |
| **`.cc-craft-kit/`** | **インストール先** | ❌ | cc-craft-kit 自身が cc-craft-kit を使うためのインストール先（ドッグフーディング用） |

### 開発フロー

1. **編集**: `src/` 配下のファイルを編集
2. **同期**: `npm run sync:dogfood` で `.cc-craft-kit/` へ TypeScript ファイルをコピー
3. **実行**: スラッシュコマンド `/cft:*` を実行してテスト（`npx tsx` で直接実行）

注意: `src/` を編集したら必ず `npm run sync:dogfood` を実行してください。ビルドは不要です。

### 開発時の注意事項

**❌ 間違った手順:**

```bash
# .cc-craft-kit/ のファイルを直接編集
vim .cc-craft-kit/integrations/github/sync.ts  # NG!
```

**✅ 正しい手順:**

```bash
# 1. src/ のソースコードを編集
vim src/integrations/github/sync.ts

# 2. 同期実行（TypeScriptファイルをコピー）
npm run sync:dogfood
```

### なぜ2つのコードベースが存在するのか

cc-craft-kit は「自分自身を使って開発する」ため、開発中のプロジェクトディレクトリ内に `.cc-craft-kit/` ディレクトリがあります。これにより以下が可能になります。

- cc-craft-kit の開発中に、cc-craft-kit のコマンド（`/cft:spec-create` など）を使用できる
- 実際の運用環境と同じ構成でテスト可能
- `.cc-craft-kit/` は `.gitignore` に含まれており、Git で管理されない

### コード修正時の確認方法

```bash
# src/ と .cc-craft-kit/ の整合性チェック
npm run check:sync

# 差分がある場合は同期
npm run sync:dogfood

# 再度チェック
npm run check:sync
```

## よく使うコマンド

### 開発

```bash
# cc-craft-kit は TypeScript を直接実行するため、ビルド不要です
# すべてのコマンドは npx tsx で直接実行されます

# 型チェック
npm run typecheck
```

### テスト

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジレポート
npm run test:coverage
```

### リント・フォーマット

```bash
# ESLint実行
npm run lint

# ESLint自動修正
npm run lint:fix

# Prettier実行
npm run format

# textlintチェック（ドキュメント）
npm run textlint

# textlint自動修正
npm run textlint:fix
```

### コマンド実行

すべてのコマンドはスラッシュコマンド経由で実行します。

```bash
# 例: プロジェクト状態確認
/cft:status

# 直接実行（開発・デバッグ用）
npx tsx .cc-craft-kit/commands/status.ts
```

## cc-craft-kit スラッシュコマンドの自動処理

### /cft:spec-phase の動作

このコマンドは、フェーズ移行後、ユーザー確認を求めず自動的に次の作業を開始します。

#### tasks フェーズ移行時の自動処理

フェーズ更新後、以下を自動実行してください。

1. 仕様書ファイルを Read ツールで読み込む
2. 受け入れ基準セクション（「3. 受け入れ基準」）を解析
3. TodoWrite ツールで実装タスクリストを作成
4. 仕様書ファイルの末尾へ「## 8. 実装タスクリスト」セクションを追加
5. `/cft:spec-update <spec-id>` で GitHub Issue へ更新を通知

#### implementation フェーズ移行時の自動処理

フェーズ更新後、以下を自動実行してください。

1. 仕様書ファイルを Read ツールで読み込む
2. 「8. 実装タスクリスト」セクションを確認
3. TodoWrite ツールでタスクリストを表示し、進捗管理を開始
4. 最初の未完了タスクを in_progress へ設定
5. 対象ファイルを Read して実装を開始
6. タスク完了後、TodoWrite で completed へ設定し、次のタスクへ自動移行

注意:「実装を開始しますか」などの確認は不要です。自動的に作業を進めてください。

#### 重要: ブランチ作成について

implementation フェーズ移行時に、新しいブランチを作成してはいけません。ブランチは仕様書作成時に既に作成されています。

- ブランチ作成コマンド（`git checkout -b`, `git branch` など）を実行しない
- `createSpecBranch()` 関数を呼び出さない
- 現在のブランチで実装を進める

### データベース

```bash
# マイグレーション実行
npm run db:migrate
```

### ソースコード同期

```bash
# 整合性チェック
npm run check:sync

# ドッグフーディング環境へ同期
npm run sync:dogfood

# Dry-runモード（変更内容を確認のみ）
npm run sync:dogfood:dry

# 構造マイグレーション（初回のみ）
npm run migrate:structure

# マイグレーションのDry-run
npm run migrate:structure:dry
```

## アーキテクチャ

### モジュラーモノリスパターン

cc-craft-kit は**モジュラーモノリス**アーキテクチャを採用し、将来的なマイクロサービス化に備えています。

### レイヤー構造

```text
┌─────────────────────────────────────┐
│  Slash Commands (.claude/commands/) │  ← ユーザーインターフェース
├─────────────────────────────────────┤
│   Commands (.cc-craft-kit/commands/)      │  ← コマンド実装層
├─────────────────────────────────────┤
│   Core (.cc-craft-kit/core/)              │  ← ドメインロジック
│   - database/                       │
│   - workflow/                       │
│   - events/                         │
│   - templates/                      │
│   - subagents/                      │
│   - skills/                         │
├─────────────────────────────────────┤
│   Integrations (.cc-craft-kit/integrations/) │ ← GitHub統合
├─────────────────────────────────────┤
│   Database Layer (Kysely + SQLite)  │  ← データ永続化
└─────────────────────────────────────┘
```

### イベント駆動アーキテクチャ

EventEmitter2 を使用したイベント駆動設計により、モジュール間の疎結合を実現しています。

**重要なイベントタイプ:**

- `spec.created` - 仕様書作成時
- `spec.phase_changed` - フェーズ移行時
- `task.created` - タスク作成時
- `task.started` - タスク開始時
- `task.completed` - タスク完了時
- `github.issue_created` - GitHub Issue 作成時
- `github.issue_updated` - GitHub Issue 更新時

**自動ハンドラー登録:**

`getEventBus()` または `getEventBusAsync()` を初回呼び出し時に、統合ハンドラーが自動的に登録されます。

- `spec.created` → GitHub Issue 自動作成
- `spec.phase_changed` → GitHub Issue ラベル・Projects ステータス自動更新、**Git 自動コミット**

新機能の実装時は、適切なイベントの発火と購読を忘れずに実装してください。イベントを発火する際は、`getEventBusAsync()` を使用してハンドラー登録を待機することを推奨します。

```typescript
// イベント発火の推奨パターン
const eventBus = await getEventBusAsync();
await eventBus.emit(
  eventBus.createEvent('spec.phase_changed', specId, {
    oldPhase,
    newPhase,
  })
);
```

### データベーススキーマ

**主要テーブル:**

- `specs` - 仕様書（フェーズ管理: requirements → design → tasks → implementation → completed）
  - GitHub 連携情報は `github_sync` テーブルで管理（`specs` テーブルには GitHub 関連カラムなし）
  - `branch_name`: 仕様書が作成されたブランチ名（ブランチ間の分離管理）
- `tasks` - タスク（ステータス: todo → in_progress → blocked → review → done）
- `logs` - アクションログ（レベル: debug/info/warn/error）
- `github_sync` - GitHub 同期状態管理（**Issue/PR 情報の単一情報源**）
  - `entity_type`: 連携対象エンティティ（`spec` または `task`）
  - `entity_id`: 対象の仕様書 ID またはタスク ID
  - `github_id`: GitHub API リソース ID
  - `github_number`: Issue/PR 番号
  - `github_node_id`: GraphQL API 用ノード ID
  - `sync_status`: 同期ステータス（`success` / `failed` / `pending`）

**重要なインデックス:**

- `specs.phase` - フェーズでのフィルタリング用
- `specs.branch_name` - ブランチでのフィルタリング用
- `specs.(phase, branch_name)` - フェーズとブランチの複合フィルタリング用
- `tasks.status` - ステータス検索用
- `github_sync.entity_id` - 同期レコード検索用
- `github_sync.entity_type` - エンティティタイプでのフィルタリング用

**GitHub 統合のデータアクセスパターン:**

仕様書と GitHub 情報を結合取得する場合は、以下のヘルパー関数を使用すること。

```typescript
// 単一仕様書 + GitHub 情報
import { getSpecWithGitHubInfo } from '../commands/spec/helpers.js';
const spec = await getSpecWithGitHubInfo(db, specId);

// 複数仕様書 + GitHub 情報（フェーズフィルタリング）
import { getSpecsWithGitHubInfo } from '../commands/spec/helpers.js';
const specs = await getSpecsWithGitHubInfo(db, { phase: 'implementation' });

// ブランチフィルタリング（現在のブランチ、main、develop のみ表示）
import { getCurrentBranch } from '../core/git/branch-cache.js';
const currentBranch = getCurrentBranch();
const branchSpecs = await getSpecsWithGitHubInfo(db, { branchName: currentBranch });

// フェーズとブランチの複合フィルタリング
const filteredSpecs = await getSpecsWithGitHubInfo(db, {
  phase: 'implementation',
  branchName: currentBranch,
});
```

直接 JOIN を書く代わりに、これらのヘルパー関数を使用することで、一貫性のあるデータアクセスを実現します。

**ブランチフィルタリングの仕様:**

- `branchName` オプションを指定すると、以下のブランチで作成された仕様書のみが表示されます：
  - 指定されたブランチ（現在のブランチ）
  - `main` ブランチ（全ブランチから参照可能）
  - `develop` ブランチ（全ブランチから参照可能）
- これにより、ブランチを切り替えても適切な仕様書のみが表示され、データベース不整合を防ぐ。

### ブランチ管理

cc-craft-kit は、Git ブランチと仕様書を紐づけて管理し、ブランチ切り替え時のデータベース不整合を防止します。

#### ブランチ作成のタイミング

注意: ブランチは仕様書作成時のみ自動的に作成される。フェーズ移行時（tasks → implementation）には、ブランチは作成されない。

これにより、1 つの仕様書に対して 1 つのブランチのみが存在することが保証されます。

#### 仕様書作成時の自動ブランチ作成

仕様書を作成すると、自動的に専用ブランチが作成されます。

```bash
# 仕様書作成（feature ブランチで実行）
/cft:spec-create "新機能の実装"

# 自動的に以下が実行される：
# 1. 仕様書 ID 生成: 12345678-1234-1234-1234-123456789abc
# 2. ブランチ作成: spec/12345678
# 3. データベースレコード作成: branch_name = "spec/12345678"
```

**ブランチ命名規則:**

| 実行元ブランチ | カスタムブランチ名 | 生成されるブランチ名 |
|---|---|---|
| feature/* | なし | `spec/<短縮ID>` |
| feature/* | あり | `spec/<短縮ID>-<カスタム名>` |
| **develop** | なし | `feature/spec-<短縮ID>` |
| **develop** | あり | `feature/spec-<短縮ID>-<カスタム名>` |
| **main** | なし | `feature/spec-<短縮ID>` |
| **main** | あり | `feature/spec-<短縮ID>-<カスタム名>` |

**保護ブランチでの動作:**

- v0.2.0 以降、`main` または `develop` ブランチから実行した場合、自動的に `feature/spec-` プレフィックス付きブランチを作成
- これにより、保護ブランチでの直接作業を防ぎつつ、手動でのブランチ作成の手間を削減
- 環境変数 `PROTECTED_BRANCHES` でカスタマイズ可能（デフォルト: `main,develop`）

```bash
# 保護ブランチのカスタマイズ（.env）
PROTECTED_BRANCHES=main,develop,staging
```

**ブランチ作成後の動作（v0.3.0 以降）:**

仕様書作成時にブランチが自動作成されるが、作成後は**元のブランチへ自動的に戻る**。

- ブランチは作成され、データベースに記録された状態で残る
- 開発者が意図しないブランチで作業するリスクを防止する
- 実装を開始する際は、手動で作成されたブランチへ切り替える必要がある

**実装開始時:**

```bash
# 作成されたブランチに切り替え
git checkout feature/spec-910e63ad
```

**注意事項:**

- ブランチ切り替えに失敗した場合、エラーが発生し、仕様書作成が中断される
- エラーメッセージに従って手動でブランチを切り替える必要がある
- ブランチ切り替え失敗の主な原因: 未コミット変更、ファイルロック、Git エラー

#### ブランチフィルタリング

`/cft:spec-list` コマンドは、現在のブランチに応じて表示される仕様書を自動的にフィルタリングします。

**フィルタリングルール:**

| 現在のブランチ | 表示される仕様書 |
|---|---|
| `main` | `main` と `develop` で作成された仕様書のみ |
| `develop` | `main` と `develop` で作成された仕様書のみ |
| `feature/test` | `main`, `develop`, `feature/test` で作成された仕様書 |

**動作例:**

```bash
# main ブランチで実行
$ git checkout main
$ /cft:spec-list
# → main と develop の仕様書のみ表示

# feature ブランチで実行
$ git checkout feature/new-feature
$ /cft:spec-list
# → main, develop, feature/new-feature の仕様書を表示
```

#### ブランチキャッシュ機構

Git コマンドの実行コストを削減するため、プロセスレベルでブランチ名をキャッシュします。

```typescript
import { getCurrentBranch, clearBranchCache } from './core/git/branch-cache.js';

// キャッシュを使用（推奨）
const branch = getCurrentBranch(); // 初回のみ git コマンド実行

// キャッシュをクリア（ブランチ切り替え後）
clearBranchCache();
const newBranch = getCurrentBranch(); // 再度 git コマンド実行
```

#### ブランチ作成ロジック

仕様書作成時のブランチ作成ロジックは、`src/core/git/branch-creation.ts` に実装されています。

**主な機能:**

1. **セキュリティ強化**: UUID フォーマット検証とサニタイゼーションによりコマンドインジェクションを防止
2. **保護ブランチからの自動ブランチ作成**: 環境変数 `PROTECTED_BRANCHES` (デフォルト: `main,develop`) で指定された保護ブランチから実行時、自動的に `feature/spec-` プレフィックス付きブランチを作成
3. **ブランチ作成検証**: ブランチ作成後、実際に切り替わったか検証し、失敗時は自動ロールバック
4. **明確なエラーメッセージ**: Git 未初期化、ブランチ作成失敗など、状況に応じた詳細なメッセージを返却

```typescript
import { createSpecBranch } from './core/git/branch-creation.js';

// 仕様書作成時に呼び出す
const result = createSpecBranch(specId);

if (result.created) {
  console.log(`Created branch: ${result.branchName}`);
  // ブランチキャッシュをクリア
  clearBranchCache();
} else {
  console.log(`Skipped: ${result.reason}`);
}
```

**ブランチ作成結果の型定義:**

```typescript
interface BranchCreationResult {
  created: boolean;                // ブランチが作成されたか
  branchName: string | null;       // 作成されたブランチ名
  originalBranch: string | null;   // 元のブランチ名
  reason?: string;                 // スキップされた理由
}
```

#### エラーハンドリングとロールバック

仕様書作成中にエラーが発生した場合、以下を自動的にロールバックします。

1. **データベースレコード削除** - 作成途中の仕様書レコードを削除
2. **ファイル削除** - 作成途中の仕様書ファイルを削除
3. **ブランチ削除** - 作成したブランチを削除し、元のブランチに戻る

**実装例 (`src/commands/spec/create.ts`):**

```typescript
let branchCreated = false;
let branchName: string | null = null;
let originalBranch: string | null = null;

try {
  // 1. ブランチ作成
  const branchResult = createSpecBranch(id);
  if (branchResult.created && branchResult.branchName) {
    branchCreated = true;
    branchName = branchResult.branchName;
    originalBranch = branchResult.originalBranch;
    clearBranchCache();
  }

  // 2. データベースレコード作成
  await db.insertInto('specs').values({ ... }).execute();

  // 3. ファイル作成
  writeFileSync(specPath, content);
  fsyncFileAndDirectory(specPath);
} catch (error) {
  // ロールバック処理
  if (branchCreated && originalBranch && branchName) {
    execSync(`git checkout ${originalBranch}`, { stdio: 'ignore' });
    execSync(`git branch -D ${branchName}`, { stdio: 'ignore' });
  }
  await db.deleteFrom('specs').where('id', '=', id).execute();
  if (existsSync(specPath)) {
    unlinkSync(specPath);
  }
  throw error;
}
```

**セキュリティ対策:**

- UUID フォーマット検証により、不正な仕様書 ID によるコマンドインジェクションを防止
- ブランチ名のサニタイゼーション（16 進数のみ許可）により、特殊文字の混入を防止
- `stdio: 'pipe'` によるコマンド実行で、エラーメッセージの漏洩を防止

#### データベース整合性チェック

ブランチ整合性を含むデータベース整合性チェックは、起動時および `/cft:status` コマンド実行時に自動実行されます。

**チェック項目:**

- `branch_name` が `null` または空文字列でないこと
- データベースレコードと仕様書ファイルのメタデータが一致すること
- 孤立したレコードやファイルが存在しないこと

```bash
# 整合性チェック実行
$ /cft:status

# 不整合が検出された場合
⚠️  Database integrity warnings:
  - Found 2 database record(s) with missing or invalid branch_name

# 自動修復スクリプト実行
$ npx tsx .cc-craft-kit/scripts/repair-database.ts
```

#### ブランチ切り替え時の注意事項

ブランチを切り替えても、データベースレコードは残り続けます。これは意図的な設計です。

**想定されるシナリオ:**

1. **feature ブランチで仕様書を作成** - データベースに記録される
2. **main ブランチに切り替え** - 仕様書ファイルは Git で管理されていないため消える
3. **仕様書の一覧を表示** - ブランチフィルタリングにより、feature の仕様書は表示されない

**データベース不整合が発生しない理由:**

- ブランチフィルタリングにより、現在のブランチで参照できない仕様書は非表示になる
- 元のブランチに戻れば、仕様書は再び表示される
- データベースレコードは削除されないため、ブランチ間でデータが失われることはない

### カスタムスラッシュコマンド

すべてのコマンドはスラッシュコマンド経由で実行します。各スラッシュコマンドは `.cc-craft-kit/commands/` 配下の対応するコマンドファイルを `npx tsx` で直接実行します。

**プロジェクト管理:**

- `/cft:init <project-name> [description]` - プロジェクト初期化
- `/cft:status` - プロジェクト状況表示
- `/cft:spec-create <name> [description]` - 仕様書作成
- `/cft:spec-list [phase] [limit]` - 仕様書一覧
- `/cft:spec-get <spec-id>` - 仕様書の詳細表示
- `/cft:spec-phase <spec-id> <phase>` - フェーズ更新
- `/cft:github-init <owner> <repo>` - GitHub 統合初期化
- `/cft:github-issue-create <spec-id>` - Issue 作成
- `/cft:github-sync <direction> <spec-id>` - GitHub 同期
- `/cft:github-project-add <spec-id> <project-number>` - Project 追加
- `/cft:knowledge-progress <spec-id> <message>` - 進捗記録
- `/cft:knowledge-error <spec-id> <error> <solution>` - エラー解決策記録
- `/cft:knowledge-tip <spec-id> <category> <tip>` - Tips 記録

**品質チェック:**

- `/cft:code-review [file-pattern]` - code-reviewer サブエージェントでコードレビュー
- `/cft:test-generate <file-pattern>` - test-generator サブエージェントでテスト自動生成
- `/cft:lint-check` - typescript-eslint スキルで型エラー・ESLint チェック
- `/cft:schema-validate` - database-schema-validator スキルでスキーマ検証
- `/cft:refactor [file-pattern]` - refactoring-assistant サブエージェントでリファクタリング

### サブエージェントとスキルの使用方針

cc-craft-kit は、コード品質を保証するために、サブエージェントとスキルを積極的に活用します。

#### 利用可能なサブエージェント

1. **code-reviewer** (`.claude/agents/code-reviewer.md`)
   - コード品質、セキュリティ、ベストプラクティスの検証を実施
   - Task ツールで `code-reviewer` サブエージェントを実行
   - 実装完了後（completed フェーズ移行前）および `/cft:code-review` コマンド実行時に自動実行

2. **test-generator** (`.claude/agents/test-generator.md`)
   - 単体テストの自動生成（正常系、エッジケース、エラーケース）を実施
   - Task ツールで `test-generator` サブエージェントを実行
   - 実装タスク完了後および `/cft:test-generate` コマンド実行時に自動実行

3. **refactoring-assistant** (`.claude/agents/refactoring-assistant.md`)
   - コード構造改善、パフォーマンス最適化を実施
   - Task ツールで `refactoring-assistant` サブエージェントを実行
   - `/cft:refactor` コマンド実行時に自動実行

#### 利用可能なスキル

1. **typescript-eslint** (`.claude/skills/typescript-eslint/SKILL.md`)
   - TypeScript コンパイルエラー・ESLint 警告の検出を実施
   - Skill ツールで `typescript-eslint` スキルを実行
   - implementation フェーズ開始前および `/cft:lint-check` コマンド実行時に自動実行

2. **database-schema-validator** (`.claude/skills/database-schema-validator/SKILL.md`)
   - Kysely スキーマとマイグレーションの検証を実施
   - Skill ツールで `database-schema-validator` スキルを実行
   - データベーススキーマ変更後および `/cft:schema-validate` コマンド実行時に自動実行

3. **git-operations** (`.claude/skills/git-operations/SKILL.md`)
   - Git リポジトリ管理、コミット履歴解析を実施
   - Skill ツールで `git-operations` スキルを実行
   - completed フェーズ移行時の変更差分確認で自動実行

#### サブエージェント/スキルの明示的な呼び出し方法

スラッシュコマンド実行時、Claude は以下のパターンでサブエージェント/スキルを呼び出します。

**Task ツールによるサブエージェント呼び出し:**

```text
Task ツールで `code-reviewer` サブエージェントを実行し、対象ファイルのコード品質を検証してください。
```

**Skill ツールによるスキル呼び出し:**

```text
Skill ツールで `typescript-eslint` スキルを実行し、型エラーと ESLint 警告をチェックしてください。
```

#### 自動実行が推奨されるタイミング

| タイミング | サブエージェント/スキル | 目的 |
|---|---|---|
| **implementation フェーズ開始前** | `typescript-eslint` スキル | 既存コードの型エラーチェック |
| **実装タスク完了後** | `test-generator` サブエージェント | テスト自動生成 |
| **実装タスク完了後** | `code-reviewer` サブエージェント | コード品質検証 |
| **completed フェーズ移行前** | `code-reviewer` サブエージェント | 最終コードレビュー |
| **completed フェーズ移行前** | `git-operations` スキル | 変更差分確認 |
| **データベーススキーマ変更後** | `database-schema-validator` スキル | スキーマ整合性検証 |

#### 品質チェックワークフローの例

**実装フェーズの標準フロー:**

1. **実装開始前**: `typescript-eslint` スキルで既存コードをチェック
2. **実装中**: 各タスク完了後、`test-generator` でテスト生成、`code-reviewer` でレビュー
3. **実装完了後**: `code-reviewer` で最終レビュー、`git-operations` で変更差分確認
4. **completed フェーズ移行**: Git 自動コミット実行

**明示的な品質チェック:**

```bash
# 実装開始前の準備
/cft:lint-check

# 実装中のテスト生成
/cft:test-generate "src/commands/quality/**/*.ts"

# 実装完了後のコードレビュー
/cft:code-review "src/commands/quality/**/*.ts"

# データベーススキーマ変更後の検証
/cft:schema-validate
```

### 依存性注入（DI）

TSyringe による DI コンテナを使用しています。新しいサービスクラスを追加する場合は、以下のパターンに従ってください。

```typescript
import { injectable } from 'tsyringe';

@injectable()
export class YourService {
  constructor(
    private db: Kysely<Database>,
    private otherService: OtherService
  ) {}
}
```

## コーディング規約

### TypeScript

- strict mode を有効にして、すべての型チェックを厳格に実施すること
- `any`型は禁止。`unknown`または具体的な型定義を使用すること（現在`any`型は 0 個）
- camelCase（変数・関数）、PascalCase（クラス・型・インターフェース）の命名規則に従うこと
- インデントは 2 スペースを使用すること

### ファイル構成

- 単一責任の原則に従い、1 ファイル 1 責務とすること
- `index.ts`で公開 API を明示的にエクスポートして、モジュールを整理すること
- モジュール内は相対パス、外部は絶対パス（`.js`拡張子必須）を使用すること

### エラーハンドリング

- `src/core/errors/`の標準エラークラスを使用すること
- エラーメッセージにはトークンなどのセンシティブ情報を含めないこと
- ログレベルは `debug` → `info` → `warn` → `error` を適切に使い分けること

### セキュリティ

- すべての CLI コマンド引数は適切に検証すること（Zod スキーマ等）
- SQL インジェクション対策として、Kysely のパラメータ化クエリのみを使用すること
- HTML 出力時は必ずサニタイゼーションを実施すること
- 認証情報は環境変数（`.env`）で管理し、コードに直接記述しないこと

### データベース接続の安全性

データベース破損を防ぐための厳格なルール。

1. **`getDatabase()` の使用**
   - データベース接続は **必ず** `getDatabase()` を使用すること
   - `config` パラメータは指定しないこと（デフォルトパスを使用）
   - 異なるパスが必要な場合は、必ず `closeDatabase()` を先に呼び出すこと

2. **禁止事項**
   - `createDatabase()` を直接呼び出さないこと
   - `getDatabase({ databasePath: ... })` のように明示的なパス指定をしないこと
   - 複数のデータベースインスタンスを同時に作成しないこと

3. **正しい使用例**

   ```typescript
   // 正しい例
   import { getDatabase } from '../core/database/connection.js';
   const db = getDatabase();

   // 間違った例（データベース破損の原因）
   const db = getDatabase({ databasePath: '/custom/path.db' });
   ```

4. **バックアップ**
   - データベースは `/cft:status` コマンド実行時に週 1 回自動バックアップされる
   - バックアップは `.cc-craft-kit/backups/` に最大 10 世代保存される
   - 手動バックアップは `createBackup()` を使用すること

5. **複数 Claude Code インスタンスでの使用**
   - 複数の Claude Code を同時に起動して本開発キットを使用することは **サポートされています**
   - WAL モード + `busy_timeout` により、複数プロセスからの同時アクセスを安全に処理
   - データベースロック時は最大 5 秒間自動リトライされる
   - 万が一エラーが発生した場合でも、バックアップから復旧可能

## テスト戦略

### 単体テスト

- テストファイルは `tests/`ディレクトリに`src/`と同じ構造で配置すること
- ファイル名は `*.test.ts` とすること
- データベース、GitHub API は必ずモック化すること
- カバレッジ目標は 80%以上を目指すこと

### E2Eテスト

実際のワークフローを統合テストとして検証します。

**主要シナリオ:**

1. プロジェクト初期化 → 仕様書作成
2. 仕様書作成 → GitHub Issue 作成 → 同期確認
3. 仕様書フェーズ移行 → Issue ステータス更新、Git 自動コミット

### テスト実行時の注意

- データベースは`:memory:`モードでテスト
- GitHub API 呼び出しは必ずモック化（レート制限回避）
- **Git 操作は必ずモック化すること**（テスト実行時にブランチが変更されることを防止）

#### Git 操作のモック化ガイドライン

テストコードで Git 操作を含む関数をテストする場合、**必ず以下のようにモック化**してください。

**モック化が必要な操作:**

1. `createSpecBranch()` 関数の呼び出し
2. `execSync()` による Git コマンド実行（`git checkout -b`, `git branch`, `git add`, `git commit` など）
3. ファイルシステム操作（`writeFileSync`, `unlinkSync`, `mkdirSync`, `rmdirSync`）

**モック化のパターン:**

```typescript
// パターン 1: createSpecBranch() のモック化
import { vi } from 'vitest';
import * as branchCreation from '../../src/core/git/branch-creation.js';

vi.mock('../../src/core/git/branch-creation.js', () => ({
  createSpecBranch: vi.fn(() => ({
    created: true,
    branchName: 'spec/12345678',
    originalBranch: 'develop',
  })),
}));
```

```typescript
// パターン 2: execSync のモック化
import { vi } from 'vitest';
import { execSync } from 'node:child_process';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

describe('Git Command Test', () => {
  const mockExecSync = vi.mocked(execSync);

  beforeEach(() => {
    mockExecSync.mockReset();
    mockExecSync.mockReturnValue(Buffer.from('success'));
  });

  // テスト実装
});
```

```typescript
// パターン 3: ファイルシステム操作のモック化
import { vi } from 'vitest';
import * as fs from 'node:fs';

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => 'mock content'),
}));
```

参考となる実装例は以下の通り。

- `.claude/agents/test-generator.md` の「Git 操作を含むテストの自動モック化」セクション
- `tests/core/git/branch-creation.test.ts` - 正しいモック化の実装例
- `tests/e2e/test-branch-stability.test.ts` - ブランチ変更検証テスト

## GitHub統合の仕組み

### REST API vs GraphQL API

- REST API で Issue、PR、Milestone を操作する
- GraphQL API で Projects v2 を操作する（REST では非対応のため）

### 双方向同期

cc-craft-kit は仕様書と GitHub Issue の双方向同期をサポートします。

**cc-craft-kit → GitHub:**

- 仕様書作成時に Issue 自動作成
- フェーズ変更時に Issue ラベル更新
- `github_sync`テーブルに同期ログ記録

**GitHub → cc-craft-kit:**

- Issue 状態変更を Webhook で検知（将来実装）
- `syncGitHubToSpec`ツールによる手動同期

### GitHub Issue 重複作成防止

cc-craft-kit は、同一仕様書に対して複数の GitHub Issue が作成されることを防止します。

**防止メカニズム:**

1. **アプリケーションレベルの重複チェック**
   - `/cft:github-issue-create` コマンド実行時に `github_sync` テーブルをクエリ
   - `entity_type='spec'` かつ `entity_id=<spec-id>` かつ `sync_status='success'` のレコードが存在する場合、エラーを throw
   - エラーメッセージ: `この仕様書には既に GitHub Issue が作成されています: <Issue URL>`

2. **データベースレベルの重複防止**
   - `github_sync` テーブルに `UNIQUE(entity_type, entity_id)` 制約を追加
   - 万が一アプリケーションレベルの重複チェックをすり抜けても、データベース制約でエラーになる

3. **失敗したレコードの再作成**
   - `sync_status='failed'` のレコードは無視され、再作成が許可される
   - `recordSyncLog` メソッドが既存の `failed` レコードを `success` に更新する

使用例を以下に示す。

```bash
# 仕様書作成（Issue が自動作成される）
/cft:spec-create "新機能の実装"

# 重複作成を試みる → エラー
/cft:github-issue-create <spec-id>
# ❌ Error: この仕様書には既に GitHub Issue が作成されています: https://github.com/owner/repo/issues/123
```

**実装ファイル:**

- `src/integrations/github/sync.ts:56-69` - 重複チェックロジック
- `src/core/workflow/github-integration.ts:104-110` - spec.created イベントハンドラー
- `src/core/database/migrations/007_add_unique_constraint_to_github_sync.ts` - UNIQUE 制約追加
- `tests/integrations/github/duplicate-issue-prevention.test.ts` - 単体テスト
- `tests/e2e/github-issue-duplicate-prevention.test.ts` - E2E テスト

### Issue ナレッジベース化

Issue は単なるタスク管理ではなく、以下の情報を統合記録する。

- 作業ログや完了タスクなどの進捗を記録
- 遭遇したエラーと解決方法を記録
- 作業中に得た知見を Tips として記録

これにより、Issue が開発ナレッジベースとして機能します。

## Git自動コミット機能

### 概要

フェーズ変更時に変更内容を自動的に Git コミットする機能を提供します。特に completed フェーズ移行時のコミット漏れを防ぎます。

**v0.2.0 以降の機能強化:**

- 未コミット変更の事前チェック機能を追加
- コミット失敗時の自動ロールバック機能を追加
- コミットスキップ時のメッセージ表示を追加

### コミットタイミング

| フェーズ | コミット対象 | コミットメッセージ |
|---|---|---|
| requirements | 仕様書ファイルのみ | `feat: <仕様書名> の要件定義を完了` |
| design | 仕様書ファイルのみ | `feat: <仕様書名> の設計を完了` |
| tasks | 仕様書ファイルのみ | `feat: <仕様書名> のタスク分解を完了` |
| implementation | 仕様書ファイルのみ | `feat: <仕様書名> の実装を開始` |
| **completed** | **全変更ファイル** | `feat: <仕様書名> を実装完了` |

### 動作フロー

1. `/cft:spec-phase <spec-id> <phase>` 実行
2. `spec.phase_changed` イベント発火
3. **未コミット変更のチェック** (v0.2.0 以降)
   - `hasUncommittedChanges()` で未コミット変更の有無を確認
   - 変更がない場合は「No uncommitted changes, skipping auto-commit」メッセージを表示して終了
4. Git 統合ハンドラーが自動的にコミット実行
5. コミット成功/失敗を通知

### 未コミット変更の検出

#### checkGitStatus()

`git status --porcelain` の出力をパースし、ファイルを以下のカテゴリに分類します。

```typescript
interface GitStatus {
  hasChanges: boolean;      // 未コミット変更の有無
  stagedFiles: string[];    // ステージングされたファイル
  unstagedFiles: string[];  // 未ステージングのファイル
  untrackedFiles: string[]; // 追跡されていないファイル
}
```

**ステータスコードの解釈:**

- `M  file.ts` → ステージング済み (stagedFiles)
- `M file.ts` → 未ステージング (unstagedFiles)
- `?? file.ts` → 未追跡 (untrackedFiles)

#### hasUncommittedChanges()

未コミット変更の有無を簡易的にチェックする関数です。

```typescript
function hasUncommittedChanges(): boolean {
  try {
    const gitStatus = checkGitStatus();
    return gitStatus.hasChanges;
  } catch {
    // Git コマンド実行エラー時は false を返す
    return false;
  }
}
```

**動作:**

- 未コミット変更がある場合 → `true` を返す
- 未コミット変更がない場合 → `false` を返す
- Git リポジトリ未初期化の場合 → `false` を返す
- Git コマンドエラーの場合 → `false` を返す（例外を握りつぶす）

### コミット失敗時の自動ロールバック

`git commit` が失敗した場合、ステージングされたファイルを自動的にリセットします。

**ロールバック処理:**

1. `git commit` 失敗を検知
2. `git reset HEAD` を実行してステージングをクリア
3. 「Rolled back staged changes (git reset HEAD)」メッセージを表示
4. フェーズ切り替えは継続（エラーでもフェーズ変更は成功）

**ロールバック失敗時:**

- 警告メッセージ「Failed to rollback staged changes」を表示
- フェーズ切り替えは継続

### エラーハンドリング

#### 1. Git リポジトリ未初期化

- 警告メッセージを表示
- フェーズ変更は成功

#### 2. 未コミット変更なし

- 情報メッセージ「No uncommitted changes, skipping auto-commit」を表示
- コミットをスキップ
- フェーズ変更は成功

#### 3. pre-commit フック失敗

- エラーログを記録
- `git reset HEAD` でステージングをロールバック
- 手動コミット手順を案内
- フェーズ変更は成功

#### 4. git add 失敗

- エラーログを記録
- 手動コミット手順を案内
- フェーズ変更は成功

#### 5. git commit 失敗

- エラーログを記録
- `git reset HEAD` でステージングをロールバック
- 手動コミット手順を案内
- フェーズ変更は成功

### 実装ファイル

- `src/core/workflow/git-integration.ts` - Git 統合ハンドラー
  - `checkGitStatus()` - Git ステータスのパースと分類
  - `hasUncommittedChanges()` - 未コミット変更の簡易チェック
  - `gitCommit()` - コミット実行とロールバック処理
  - `handlePhaseChangeCommit()` - フェーズ変更時の自動コミット
- `src/core/workflow/event-bus.ts` - 自動ハンドラー登録

## プラグインシステム

### プラグインインターフェース

```typescript
interface cc-craft-kitPlugin {
  name: string;
  version: string;
  onInit?(context: PluginContext): void | Promise<void>;
  tools?: MCPTool[];
  eventHandlers?: EventHandler[];
}
```

### 公式プラグイン

- Backlog 統合プラグインは `src/plugins/backlog/` にある
- Slack 通知プラグインは `src/plugins/slack/` にある

新しいプラグインを追加する場合は、`src/plugins/<plugin-name>/`以下に配置し、`PluginRegistry`に登録してください。

## 開発時の注意事項

### マイグレーション

データベーススキーマを変更する場合は、必ず`src/core/database/migrations/`にマイグレーションファイルを追加してください。

**マイグレーションファイル命名規則:**

- `<連番>_<説明>.ts`（例: `001_initial_schema.ts`）

### GitHub API レート制限

- REST API: 5,000 リクエスト/時
- GraphQL API: 5,000 ポイント/時（クエリの複雑さによりポイント消費）

レート制限に達した場合は、`RateLimitError`をスローし、リトライロジックで対処してください。

### イベントリスナーの登録

新しいイベントリスナーを追加する場合は、以下のパターンに従ってください。

```typescript
eventBus.on('spec:created', async (spec) => {
  // リスナー処理
});
```

リスナー内でエラーが発生しても、他のリスナーに影響を与えないように try-catch で囲む必要があります。

### ソースコード管理

- すべてのコード編集は `src/` で行う。`.cc-craft-kit/` 配下のファイルは自動生成されるため、直接編集しない
- スラッシュコマンド定義を `src/slash-commands/` で管理する。`.claude/commands/cc-craft-kit/` はシンボリックリンクのため、直接編集しない
- 同期を忘れない。`src/` を編集したら `npm run sync:dogfood` を実行する
- CI/CD での整合性チェックを実施する。プルリクエスト時に `npm run check:sync` を実行して差分がないことを確認する
- マイグレーション実行前は必ずバックアップを取る。`npm run migrate:structure:dry` で Dry-run を実行してから本番実行する
- 型エラーは即座に修正する。`npx tsc --noEmit` でエラーが出た場合は、同期前に修正すること

### .cc-craft-kit/ ディレクトリのファイル管理

- 基本方針: `.cc-craft-kit/` ディレクトリは `.gitignore` に含まれ、Git 管理対象外
- 例外: `.cc-craft-kit/specs/*.md` (仕様書ファイル) のみ Git 管理対象
- 理由: ドッグフーディング環境のため、データベース等の自動生成ファイルは除外するが、仕様書の変更履歴は記録する必要がある
- 実装: `.gitignore` にネゲーションパターン `!.cc-craft-kit/specs/` を追加し、仕様書ディレクトリのみ除外対象から外している

## トラブルシューティング

### コマンドが起動しない

1. `npx tsc --noEmit` で型エラーがないか確認
2. `.env` ファイルが正しく設定されているか確認
3. `npm run sync:dogfood` で同期が正常に完了しているか確認

### データベースエラー

1. `.cc-craft-kit/cc-craft-kit.db`が破損している可能性 → 削除して`npm run db:migrate`で再初期化
2. マイグレーションの順序エラー → マイグレーションファイルの連番を確認

### データベース不整合エラー

**症状:** Claude Code 起動時に以下の警告が表示される。

```text
⚠️  Database integrity warnings:
  - Found X invalid spec file(s)
  - Found X database record(s) with invalid spec file
```

**原因:**

データベースレコードと仕様書ファイルのメタデータが不整合になっています。主な原因は以下の 3 つです。

1. **日時形式の不一致**:
   - 仕様書ファイルの日時が `YYYY/MM/DD HH:MM:SS` 形式ではない
   - 例: `2025/11/20 7:42:46` (時刻の 0 埋めなし) → 不正
   - 正: `2025/11/20 07:42:46` (時刻が 2 桁で 0 埋めされている)

2. **ファイル書き込みの未完了**:
   - Claude Code 異常終了時に、OS バッファに残ったデータがディスクに書き込まれていない
   - `fsync()` 未実装により、バッファフラッシュが保証されていない

3. **トランザクション不整合**:
   - 仕様書作成中にエラーが発生し、DB レコードは作成されたがファイルが未作成
   - ロールバック処理が未実装のため、不整合が残る

**解決策:**

```bash
# 自動修復スクリプトを実行
npx tsx .cc-craft-kit/scripts/repair-database.ts
```

このスクリプトは以下を自動実行します。

1. **整合性チェック実行**:
   - データベースレコードと仕様書ファイルを比較
   - 不整合の種類と件数を表示

2. **メタデータ自動修正**:
   - 日時形式の不一致を自動修正 (時刻の 0 埋めなど)
   - フィールド名の修正 (例: `仕様書ID` → `仕様書 ID`)

3. **データベース同期**:
   - ファイルから正しいメタデータを読み取り、DB レコードを更新
   - 不足しているレコードを作成、孤立したレコードを削除

4. **最終検証**:
   - 修復後の整合性を再チェック
   - エラー0 件を確認

**修復例:**

```bash
$ npx tsx .cc-craft-kit/scripts/repair-database.ts

# Before:
⚠️  Found 2 invalid spec file(s)
⚠️  Found 2 database record(s) with invalid spec file

# 自動修正実行...

# After:
✅ VALID (61 specs, 0 errors)
```

**予防策:**

cc-craft-kit v0.1.1 以降では、以下の修正により不整合が発生しにくくなっています。

1. **日時形式の統一**:
   - `toLocaleString()` (環境依存) → `YYYY/MM/DD HH:MM:SS` 固定形式
   - `src/core/utils/date-format.ts` で統一管理

2. **fsync() 実装**:
   - ファイル書き込み後に `fsyncFileAndDirectory()` を実行
   - OS バッファを強制フラッシュし、異常終了時のデータ損失を防止

3. **トランザクション + ロールバック**:
   - try-catch でエラーハンドリング
   - エラー時は DB レコードとファイルを自動削除

4. **起動時整合性チェック**:
   - `/cft:status` コマンド実行時に整合性チェックを自動実行
   - 不整合が検出された場合、修復スクリプトの実行を案内

5. **E2E テストによる検証**:
   - 100 回連続実行で不整合 0 件を達成
   - `tests/e2e/database-integrity.test.ts` で継続的に検証

### GitHub API エラー

- 401 Unauthorized が出た場合、トークンが無効。`.env`の GITHUB_TOKEN を再設定すること
- 403 Forbidden が出た場合、スコープが不足。Fine-grained PAT に`repo`, `project`スコープを追加すること
- 404 Not Found が出た場合、リポジトリ・Project が存在しない。owner/repo を確認すること

### ソースコード同期エラー

**症状:** スラッシュコマンドが古い動作をする。

**原因:** `src/` の変更が `.cc-craft-kit/` に反映されていない。

**解決策:**

```bash
# 1. 差分確認
npm run check:sync

# 2. 同期実行
npm run sync:dogfood

# 3. 整合性再確認
npm run check:sync
```

**症状:** `npm run check:sync` で差分が検出される。

**原因:** `src/` と `.cc-craft-kit/` のファイルハッシュが一致していない。

**解決策:**

```bash
# src/ と .cc-craft-kit/ のファイルハッシュを比較
md5sum src/commands/status.ts .cc-craft-kit/commands/status.ts

# 一致していない場合は同期
npm run sync:dogfood
```

**症状:** マイグレーション実行時に競合エラー。

**原因:** `src/commands/` または `src/slash-commands/` が既に存在する。

**解決策:**

```bash
# Dry-runで確認
npm run migrate:structure:dry

# 既存ディレクトリをバックアップ
mv src/commands src/commands.bak
mv src/slash-commands src/slash-commands.bak

# 再度マイグレーション実行
npm run migrate:structure
```

### ブランチ保護エラー

**症状:** Edit ツールまたは Write ツールで「統合ブランチでの直接編集は禁止されている」エラーが表示される。

**原因:** main や develop などの保護対象ブランチで直接ファイル編集を試みている。

**解決策:**

```bash
# 1. 現在のブランチを確認
git branch

# 2. 適切な作業ブランチを作成
git checkout -b feature/<機能名>
# または
git checkout -b fix/<修正内容>

# 3. 編集を再実行
```

**設定変更:**

保護対象ブランチは `.env` ファイルで変更可能です。

```bash
# .env
# カンマ区切りで複数指定
PROTECTED_BRANCHES=main,develop,staging

# 設定を削除すると、リモートのデフォルトブランチ（main または master）が自動検出される
```

## 参考ドキュメント

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - 詳細なアーキテクチャ設計
- [QUICK_START.md](./docs/QUICK_START.md) - クイックスタートガイド
