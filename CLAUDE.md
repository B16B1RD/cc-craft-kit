# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Takumi（匠）は、Claude Code 上で仕様駆動開発（SDD）、本質的 TDD、GitHub Projects/Issues 完全連携を実現する開発支援ツールキット。
MCP サーバー、カスタムスラッシュコマンド、サブエージェント、スキルの統合により、開発ワークフローを革新します。

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

### MCPサーバー

```bash
# MCPサーバー開発モード
npm run mcp:dev

# MCPサーバーをビルドして起動
npm run mcp:build
```

### データベース

```bash
# マイグレーション実行
npm run db:migrate
```

## アーキテクチャ

### モジュラーモノリスパターン

Takumi は**モジュラーモノリス**アーキテクチャを採用し、将来的なマイクロサービス化に備えています。

### レイヤー構造

```text
┌─────────────────────────────────────┐
│      MCP Server (src/mcp/)          │  ← Claude Codeとの統合
├─────────────────────────────────────┤
│   Integrations (src/integrations/)  │  ← GitHub統合（REST/GraphQL）
├─────────────────────────────────────┤
│   Core Modules (src/core/)          │  ← ドメインロジック
│   - subagents/                      │
│   - skills/                         │
│   - workflow/                       │
│   - database/                       │
│   - events/                         │
│   - templates/                      │
│   - plugins/                        │
├─────────────────────────────────────┤
│   Database Layer (Kysely + SQLite)  │  ← データ永続化
└─────────────────────────────────────┘
```

### イベント駆動アーキテクチャ

EventEmitter2 を使用したイベント駆動設計により、モジュール間の疎結合を実現しています。

**重要なイベントタイプ:**

- `spec:created` - 仕様書作成時
- `spec:approved` - 仕様書承認時（フェーズ移行）
- `task:created` - タスク作成時
- `task:started` - タスク開始時
- `task:completed` - タスク完了時
- `github:issue:created` - GitHub Issue 作成時
- `github:issue:updated` - GitHub Issue 更新時

新機能の実装時は、適切なイベントの発火と購読を忘れずに実装してください。

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

### MCPツール一覧

**プロジェクト管理:**

- `takumi:init_project` - プロジェクト初期化
- `takumi:create_spec` - 仕様書作成
- `takumi:list_specs` - 仕様書一覧
- `takumi:get_spec` - 仕様書取得

**GitHub統合:**

- `takumi:github_init` - GitHub 接続初期化
- `takumi:github_create_issue` - Issue 作成
- `takumi:sync_spec_to_github` - 仕様書→GitHub 同期
- `takumi:sync_github_to_spec` - GitHub→仕様書同期
- `takumi:add_spec_to_project` - Project ボードに Spec 追加

**ナレッジベース:**

- `takumi:record_progress` - 進捗記録
- `takumi:record_error_solution` - エラー解決策記録
- `takumi:record_tip` - Tips 記録

### カスタムスラッシュコマンド

- `/takumi:init <project-name> [description]` - プロジェクト初期化
- `/takumi:spec-create <name> [description]` - 仕様書作成
- `/takumi:spec-list [phase] [limit]` - 仕様書一覧
- `/takumi:status` - プロジェクト状況表示

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

- すべての MCP ツール引数は Zod スキーマで検証すること
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
3. 仕様書フェーズ移行 → Issue ステータス更新

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

## トラブルシューティング

### MCPサーバーが起動しない

1. `npm run build`でビルドエラーがないか確認
2. `.env`ファイルが正しく設定されているか確認
3. `npm run mcp:dev`で詳細なエラーログを確認

### データベースエラー

1. `.takumi/takumi.db`が破損している可能性 → 削除して`npm run db:migrate`で再初期化
2. マイグレーションの順序エラー → マイグレーションファイルの連番を確認

### GitHub API エラー

- 401 Unauthorized が出た場合、トークンが無効。`.env`の GITHUB_TOKEN を再設定すること
- 403 Forbidden が出た場合、スコープが不足。Fine-grained PAT に`repo`, `project`スコープを追加すること
- 404 Not Found が出た場合、リポジトリ・Project が存在しない。owner/repo を確認すること

## 参考ドキュメント

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - 詳細なアーキテクチャ設計
- [MCP_TOOLS.md](./docs/MCP_TOOLS.md) - MCP ツール API リファレンス
- [QUICK_START.md](./docs/QUICK_START.md) - クイックスタートガイド
