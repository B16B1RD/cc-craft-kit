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
- `tasks` - タスク（ステータス: todo → in_progress → blocked → review → done）
- `logs` - アクションログ（レベル: debug/info/warn/error）
- `github_sync` - GitHub 同期状態管理

**重要なインデックス:**

- `specs.phase` - フェーズでのフィルタリング用
- `tasks.status` - ステータス検索用
- `github_sync.entity_id` - 同期レコード検索用

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

⚠️ **重要: データベース破損を防ぐための厳格なルール**

1. **`getDatabase()` の使用**
   - データベース接続は **必ず** `getDatabase()` を使用すること
   - `config` パラメータは指定しないこと（デフォルトパスを使用）
   - 異なるパスが必要な場合は、必ず `closeDatabase()` を先に呼び出すこと

2. **禁止事項**
   - `createDatabase()` を直接呼び出さないこと
   - `getDatabase({ databasePath: ... })` のように明示的にパスを指定しないこと
   - 複数のデータベースインスタンスを同時に作成しないこと

3. **正しい使用例**

   ```typescript
   // ✅ 正しい
   import { getDatabase } from '../core/database/connection.js';
   const db = getDatabase();

   // ❌ 間違い（データベース破損の原因）
   const db = getDatabase({ databasePath: '/custom/path.db' });
   ```

4. **バックアップ**
   - データベースは `/cft:status` コマンド実行時に週 1 回自動バックアップされる
   - バックアップは `.cc-craft-kit/backups/` に最大 10 世代保存される
   - 手動バックアップは `createBackup()` を使用すること

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

### Issue ナレッジベース化

Issue は単なるタスク管理ではなく、以下の情報を統合記録する。

- 作業ログや完了タスクなどの進捗を記録
- 遭遇したエラーと解決方法を記録
- 作業中に得た知見を Tips として記録

これにより、Issue が開発ナレッジベースとして機能します。

## Git自動コミット機能

### 概要

フェーズ変更時に変更内容を自動的に Git コミットする機能を提供します。特に completed フェーズ移行時のコミット漏れを防ぎます。

### コミットタイミング

| フェーズ | コミット対象 | コミットメッセージ |
|---|---|---|
| requirements | 仕様書ファイルのみ | `feat: <仕様書名> の要件定義を完了` |
| design | 仕様書ファイルのみ | `feat: <仕様書名> の設計を完了` |
| tasks | 仕様書ファイルのみ | `feat: <仕様書名> のタスク分解を完了` |
| implementation | 仕様書ファイルのみ | `feat: <仕様書名> の実装を開始` |
| **completed** | **全変更ファイル** | `feat: <仕様書名> を実装完了` |

### 動作

1. `/cft:spec-phase <spec-id> <phase>` 実行
2. `spec.phase_changed` イベント発火
3. Git 統合ハンドラーが自動的にコミット実行
4. コミット成功/失敗を通知

### エラーハンドリング

- Git リポジトリ未初期化の場合、警告のみ表示し、フェーズ変更は成功
- pre-commit フック失敗の場合、警告メッセージ表示し、手動コミット案内
- コミット失敗の場合、エラーログ出力し、フェーズ変更は成功

### 実装ファイル

- `src/core/workflow/git-integration.ts` - Git 統合ハンドラー
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

## トラブルシューティング

### コマンドが起動しない

1. `npx tsc --noEmit` で型エラーがないか確認
2. `.env` ファイルが正しく設定されているか確認
3. `npm run sync:dogfood` で同期が正常に完了しているか確認

### データベースエラー

1. `.cc-craft-kit/cc-craft-kit.db`が破損している可能性 → 削除して`npm run db:migrate`で再初期化
2. マイグレーションの順序エラー → マイグレーションファイルの連番を確認

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

## 参考ドキュメント

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - 詳細なアーキテクチャ設計
- [QUICK_START.md](./docs/QUICK_START.md) - クイックスタートガイド
