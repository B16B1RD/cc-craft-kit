# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Phase 2: GitHub 統合 (Week 3-4) - 実装完了（動作確認待ち）

- GitHub REST API 統合
- GitHub GraphQL API 統合 (Projects v2)
- Issue 自動作成・更新機能
- Project Board 自動管理
- 双方向の同期機構（Takumi ⇄ GitHub）
- GitHub クライアント実装（`src/integrations/github/client.ts`）
- Issue ナレッジベース化（進捗記録、エラー解決策、Tips）
- MCP ツール追加:
  - `takumi:github_init` - GitHub 接続初期化
  - `takumi:sync_spec_to_github` - 仕様書→GitHub 同期
  - `takumi:record_progress` - 進捗記録
  - `takumi:record_error_solution` - エラー解決策記録

#### Phase 3: サブエージェント + スキル (Week 7-10) - 実装完了（動作確認待ち）

**7 つのコアサブエージェント実装**:

1. RequirementsAnalyzer - 要件分析エージェント
2. TaskBreakdowner - タスク分割エージェント
3. ArchitectDesigner - アーキテクト設計エージェント
4. CodeGenerator - コード生成エージェント
5. CodeReviewer - コードレビューエージェント
6. TestCreator - テスト作成エージェント
7. DocumentationWriter - ドキュメント作成エージェント

**5 つのコアスキル実装**:

1. RequirementsDocGenerator - 要件定義書の自動生成
2. ArchitectureDiagramGenerator - アーキテクチャ図生成
3. CodeQualityAnalyzer - コード品質解析（389 行）
4. TestCoverageReporter - テストカバレッジ レポート
5. GitHubIssueSync - GitHub Issue 同期スキル

**ワークフローシステム**:

- EventBus 実装（EventEmitter2 ベース、165 行）
- Story-to-Done パイプライン実装（165 行）
- イベント駆動アーキテクチャ完成

**テスト**:

- `tests/core/subagents/requirements-analyzer.test.ts`
- `tests/core/workflow/event-bus.test.ts`

#### Phase 4: プラグインシステム (Week 11-14) - 実装完了（動作確認待ち）

**プラグインアーキテクチャ**:

- プラグイン インターフェース定義（`src/core/plugins/types.ts`）
- プラグイン レジストリ実装（189 行）
- プラグイン ローダー実装（動的読み込み、ホットリロード対応）

**公式プラグイン**:

1. Backlog 統合プラグイン（178 行）
   - `takumi:backlog_create_issue` - Backlog 課題作成
   - `takumi:backlog_sync_spec` - 仕様書→Backlog 同期
   - `takumi:backlog_get_issues` - 課題一覧取得
   - イベント ハンドラー（spec:created, spec:approved, task:completed）
2. Slack 通知プラグイン
   - Slack Webhook 通知
   - Slack Blocks API 対応

#### Phase 5: 最適化・セキュリティ (Week 15+) - 実装完了（動作確認待ち）

**エラー ハンドリング**:

- 統一エラー ハンドリング システム（362 行）
- 7 種類のカスタム エラー クラス
  - TakumiError, DatabaseError, ValidationError, GitHubError
  - PluginError, ConfigurationError, WorkflowError
- エラー コード管理（E001〜E999）
- センシティブ情報のマスキング

**パフォーマンス最適化**:

- TTL 付きキャッシュ システム（256 行）
- LRU 削除戦略
- パフォーマンス プロファイラー実装
- キャッシュ ヒット率計測

**セキュリティ**:

- セキュリティ バリデーター（314 行）
- 12 種類の検証機能:
  - SQL インジェクション検出
  - XSS 防止
  - パス トラバーサル防止
  - コマンド インジェクション防止
  - センシティブ情報検出
  - 入力サニタイゼーション
  - ファイル パス検証
  - URL 検証
  - レート制限
  - CSRF 対策
  - 暗号化ユーティリティ
  - 入力長制限

**型安全性向上**:

- `any`型の完全排除（121 個 → 0 個）
- 共通型定義（`src/core/types/common.ts`, 88 行）
- MCP ツール型定義の一元化（`src/mcp/tools/types.ts`, 210 行）
- すべての MCP ツールに戻り値インターフェース追加

**ドキュメント品質向上**:

- textlint/markdownlint 自動化
- textlint warnings: 29 件 → 0 件
- 日本語スペース統一、Markdown テーブル形式統一

### Changed

- TypeScript strict mode 有効化
- ESLint グローバル オブジェクト拡張（performance, URL 等）
- Jest DB 競合回避設定（maxWorkers: 1）
- データベース スキーマに`testing`フェーズ追加

### v0.1.0 リリース条件

以下が完了後、v0.1.0 として初回リリース予定。

- [ ] すべてのユニット テストが成功すること
- [ ] GitHub Projects との統合テストが成功すること
- [ ] 実際の開発フローでの動作確認が完了すること
- [ ] ドキュメントが最新の状態に更新されていること

### Technical Details（実装状況）

#### 実装状況

| Phase                     | 状態 | 実装率 | テスト状況 |
| ------------------------- | ---- | ------ | ---------- |
| Phase 1: 基盤構築         | ✅   | 100%   | ✅         |
| Phase 2: GitHub 統合      | ✅   | 100%   | 🔄 待機中  |
| Phase 3: サブエージェント | ✅   | 100%   | 🔄 待機中  |
| Phase 4: プラグイン       | ✅   | 100%   | 🔄 待機中  |
| Phase 5: 最適化           | ✅   | 100%   | 🔄 待機中  |

#### 品質指標

- TypeScript strict mode: ✓
- `any`型: 0 個
- ESLint warnings: 0 個
- textlint warnings: 修正中
- セキュリティ チェック: 12 種類実装

#### アーキテクチャ

- モジュラー モノリス パターン
- イベント駆動アーキテクチャ（EventEmitter2）
- プラグイン システム（Registry + Loader）
- 依存性注入（TSyringe）
- Story-to-Done パイプライン

## [0.1.0] - 2025-11-15

### Added

#### Week 1: 初期プロジェクト構造

- プロジェクト初期化 (Git, npm, TypeScript)
- Kysely + SQLite データベース層実装
- 初期マイグレーション (`specs`, `tasks`, `logs`, `github_sync` テーブル)
- MCP サーバー骨組み実装
- 基本 MCP ツール:
  - `takumi:init_project` - プロジェクト初期化
  - `takumi:create_spec` - 仕様書作成
  - `takumi:list_specs` - 仕様書の一覧取得
  - `takumi:get_spec` - 仕様書の詳細取得
- ディレクトリ構造作成
- README.md 初版
- アーキテクチャドキュメント

#### Week 2: テンプレートエンジン+スラッシュコマンド

- Handlebars テンプレートエンジン統合
- 仕様書テンプレート:
  - `requirements.md.hbs` - 要件定義書
  - `design.md.hbs` - 設計書
  - `tasks.md.hbs` - タスク分解
- スラッシュコマンド:
  - `/cft:init` - プロジェクト初期化
  - `/cft:spec-create` - 仕様書作成
  - `/cft:spec-list` - 仕様書一覧
  - `/cft:status` - プロジェクト状況表示
- TemplateEngine クラス実装
- Handlebars ヘルパー (formatDate、inc、join、eq、priorityLabel)
- ドキュメント:
  - Quick Start Guide
  - MCP ツール API リファレンス
  - CHANGELOG.md

### Technical Details

#### 技術スタック

- TypeScript 5.7
- Node.js 18+
- Kysely 0.27 + SQLite (better-sqlite3)
- Handlebars 4.7
- MCP SDK 1.0
- Zod 3.24

#### データベーススキーマ

- `specs` - 仕様書管理
- `tasks` - タスク管理
- `logs` - アクションログ
- `github_sync` - GitHub 同期状態

#### アーキテクチャ

- モジュラーモノリスパターン
- MCP プロトコル統合
- イベント駆動準備 (EventEmitter2)
- DI 準備 (TSyringe)

### Development

#### ビルド

```bash
npm run build
```

#### テスト

```bash
npm test
```

#### マイグレーション

```bash
npm run db:migrate
```

#### MCPサーバー起動

```bash
npm run mcp:dev  # 開発モード
npm run mcp:build  # 本番モード
```

## [0.0.1] - 2025-11-14

### Added

- 初回コミット
- プロジェクト構想

---

**Note:** このプロジェクトは積極的に開発中です。
API は予告なく変更される可能性があります。
