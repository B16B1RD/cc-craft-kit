# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Phase 2 (予定)

- GitHub REST API 統合
- GitHub GraphQL API 統合 (Projects v2)
- Issue 自動作成・更新
- Project Board 自動管理
- 双方向の同期機構

### Phase 3 (予定)

- 7 つのサブエージェント実装
- 5 つのスキル実装
- イベント駆動ワークフロー
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
  - `/takumi:init` - プロジェクト初期化
  - `/takumi:spec-create` - 仕様書作成
  - `/takumi:spec-list` - 仕様書一覧
  - `/takumi:status` - プロジェクト状況表示
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
