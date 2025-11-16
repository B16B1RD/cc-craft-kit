# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Takumi（匠）は、Claude Code 上で仕様駆動開発（SDD）、GitHub Projects/Issues 完全連携を実現する開発支援ツールキット。
`.takumi/` ディレクトリベースの軽量アーキテクチャ、カスタムスラッシュコマンド、サブエージェント、スキルの統合により、開発ワークフローを革新します。

## ⚠️ 重要: ソースコードとインストール先の関係

### ディレクトリ構成

Takumi プロジェクトは、**自分自身を使って開発する（ドッグフーディング）** ため、以下のディレクトリ構造を採用しています：

| ディレクトリ | 役割 | Git管理 | 説明 |
|---|---|---|---|
| **`src/`** | **ソースコード** | ✅ | 開発時に編集する本体のTypeScriptコード |
| **`src/commands/`** | CLI実装 | ✅ | スラッシュコマンドから実行されるCLI実装 |
| **`src/slash-commands/`** | スラッシュコマンド定義 | ✅ | Claude Codeのスラッシュコマンド定義 (`.md`) |
| **`src/scripts/`** | ビルド・同期スクリプト | ✅ | 整合性チェック、自動同期、マイグレーションツール |
| **`.claude/commands/takumi/`** | シンボリックリンク | ✅ | `src/slash-commands/` へのシンボリックリンク |
| **`dist/`** | ビルド成果物 | ❌ | `npm run build` で `src/` からコンパイルされる |
| **`.takumi/`** | **インストール先** | ❌ | Takumi自身がTakumiを使うためのインストール先（ドッグフーディング用） |

### 開発フロー

1. **編集**: `src/` 配下のファイルを編集
2. **ビルド**: `npm run build` でTypeScriptコンパイル
3. **同期**: `npm run sync:dogfood` で `.takumi/` へ自動コピー
4. **実行**: スラッシュコマンド `/takumi:*` を実行してテスト

**重要:** `src/` を編集したら必ず `npm run sync:dogfood` を実行してください。

### 開発時の注意事項

**❌ 間違った手順:**

```bash
# .takumi/ のファイルを直接編集
vim .takumi/integrations/github/sync.ts  # NG!
```

**✅ 正しい手順:**

```bash
# 1. src/ のソースコードを編集
vim src/integrations/github/sync.ts

# 2. ビルド + 同期（一括実行）
npm run build:dogfood

# または個別に実行
npm run build
npm run sync:dogfood
```

### なぜ2つのコードベースが存在するのか？

Takumi は「自分自身を使って開発する」ため、開発中のプロジェクトディレクトリ内に `.takumi/` ディレクトリがあります。これにより:

- Takumi の開発中に、Takumi のコマンド（`/takumi:spec-create` など）を使用できる
- 実際の運用環境と同じ構成でテスト可能
- `.takumi/` は `.gitignore` に含まれており、Git で管理されない

### コード修正時の確認方法

```bash
# src/ と .takumi/ の整合性チェック
npm run check:sync

# 差分がある場合は同期
npm run sync:dogfood

# 再度チェック
npm run check:sync
```

## よく使うコマンド

### ビルド・開発

```bash
# TypeScriptビルド
npm run build

# 開発モード（ホットリロード）
npm run dev

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

すべてのコマンドはスラッシュコマンド経由で実行します:

```bash
# 例: プロジェクト状態確認
/takumi:status

# 直接実行（開発・デバッグ用）
npx tsx .takumi/commands/status.ts
```

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

# ビルド + 同期（一括実行）
npm run build:dogfood

# 構造マイグレーション（初回のみ）
npm run migrate:structure

# マイグレーションのDry-run
npm run migrate:structure:dry
```

## アーキテクチャ

### モジュラーモノリスパターン

Takumi は**モジュラーモノリス**アーキテクチャを採用し、将来的なマイクロサービス化に備えています。

### レイヤー構造

```text
┌─────────────────────────────────────┐
│  Slash Commands (.claude/commands/) │  ← ユーザーインターフェース
├─────────────────────────────────────┤
│   Commands (.takumi/commands/)      │  ← コマンド実装層
├─────────────────────────────────────┤
│   Core (.takumi/core/)              │  ← ドメインロジック
│   - database/                       │
│   - workflow/                       │
│   - events/                         │
│   - templates/                      │
│   - subagents/                      │
│   - skills/                         │
├─────────────────────────────────────┤
│   Integrations (.takumi/integrations/) │ ← GitHub統合
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

すべてのコマンドはスラッシュコマンド経由で実行します。各スラッシュコマンドは `.takumi/commands/` 配下の対応するコマンドファイルを `npx tsx` で直接実行します。

**プロジェクト管理:**

- `/takumi:init <project-name> [description]` - プロジェクト初期化
- `/takumi:status` - プロジェクト状況表示
- `/takumi:spec-create <name> [description]` - 仕様書作成
- `/takumi:spec-list [phase] [limit]` - 仕様書一覧
- `/takumi:spec-get <spec-id>` - 仕様書詳細表示
- `/takumi:spec-phase <spec-id> <phase>` - フェーズ更新
- `/takumi:github-init <owner> <repo>` - GitHub 統合初期化
- `/takumi:github-issue-create <spec-id>` - Issue 作成
- `/takumi:github-sync <direction> <spec-id>` - GitHub 同期
- `/takumi:github-project-add <spec-id> <project-number>` - Project 追加
- `/takumi:knowledge-progress <spec-id> <message>` - 進捗記録
- `/takumi:knowledge-error <spec-id> <error> <solution>` - エラー解決策記録
- `/takumi:knowledge-tip <spec-id> <category> <tip>` - Tips 記録

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

Takumi は仕様書と GitHub Issue の双方向同期をサポートします。

**Takumi → GitHub:**

- 仕様書作成時に Issue 自動作成
- フェーズ変更時に Issue ラベル更新
- `github_sync`テーブルに同期ログ記録

**GitHub → Takumi:**

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

1. `/takumi:spec-phase <spec-id> <phase>` 実行
2. `spec.phase_changed` イベント発火
3. Git 統合ハンドラーが自動的にコミット実行
4. コミット成功/失敗を通知

### エラーハンドリング

- **Git リポジトリ未初期化**: 警告のみ、フェーズ変更は成功
- **pre-commit フック失敗**: 警告メッセージ表示、手動コミット案内
- **コミット失敗**: エラーログ出力、フェーズ変更は成功

### 実装ファイル

- `src/core/workflow/git-integration.ts` - Git 統合ハンドラー
- `src/core/workflow/event-bus.ts` - 自動ハンドラー登録

## プラグインシステム

### プラグインインターフェース

```typescript
interface TakumiPlugin {
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

- **すべてのコード編集は `src/` で行う**: `.takumi/` 配下のファイルは自動生成されるため、直接編集しない
- **スラッシュコマンド定義は `src/slash-commands/` で管理**: `.claude/commands/takumi/` はシンボリックリンクのため、直接編集しない
- **同期を忘れない**: `src/` を編集したら `npm run sync:dogfood` を実行
- **CI/CD での整合性チェック**: プルリクエスト時に `npm run check:sync` を実行して差分がないことを確認
- **マイグレーション実行前は必ずバックアップ**: `npm run migrate:structure:dry` でDry-runを実行してから本番実行
- **ビルドエラーは即座に修正**: `npm run build` でエラーが出た場合は、同期前に修正すること

## トラブルシューティング

### CLIが起動しない

1. `npm run build`でビルドエラーがないか確認
2. `.env`ファイルが正しく設定されているか確認
3. `npm run dev`で詳細なエラーログを確認

### データベースエラー

1. `.takumi/takumi.db`が破損している可能性 → 削除して`npm run db:migrate`で再初期化
2. マイグレーションの順序エラー → マイグレーションファイルの連番を確認

### GitHub API エラー

- 401 Unauthorized が出た場合、トークンが無効。`.env`の GITHUB_TOKEN を再設定すること
- 403 Forbidden が出た場合、スコープが不足。Fine-grained PAT に`repo`, `project`スコープを追加すること
- 404 Not Found が出た場合、リポジトリ・Project が存在しない。owner/repo を確認すること

### ソースコード同期エラー

**症状:** スラッシュコマンドが古い動作をする

**原因:** `src/` の変更が `.takumi/` に反映されていない

**解決策:**

```bash
# 1. 差分確認
npm run check:sync

# 2. 同期実行
npm run sync:dogfood

# 3. 整合性再確認
npm run check:sync
```

**症状:** `npm run check:sync` で差分が検出される

**原因:** `src/` と `.takumi/` のファイルハッシュが一致していない

**解決策:**

```bash
# src/ と .takumi/ のファイルハッシュを比較
md5sum src/commands/status.ts .takumi/commands/status.ts

# 一致していない場合は同期
npm run sync:dogfood
```

**症状:** マイグレーション実行時に競合エラー

**原因:** `src/commands/` または `src/slash-commands/` が既に存在する

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
- [MIGRATION_FROM_MCP.md](./docs/MIGRATION_FROM_MCP.md) - MCP からの移行ガイド
- [QUICK_START.md](./docs/QUICK_START.md) - クイックスタートガイド
