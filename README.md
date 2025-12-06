# cc-craft-kit - 統合開発キット

Claude Code 上で**仕様駆動開発（SDD）**、**GitHub Projects/Issues 完全連携**を実現する開発支援ツールキット。

## コンセプト

cc-craft-kit は、Claude Code 上のカスタムスラッシュコマンドで動作する**ゼロ依存**の開発支援ツールキットです。

### 核心的特徴

- **TypeScript 不要**: スラッシュコマンド + スキル + サブエージェントのみで構成
- **ゼロ依存**: npm install 不要、Claude Code と gh CLI のみで動作
- **YAML フロントマター**: 仕様書は Markdown ファイルに YAML メタデータを埋め込み（Single Source of Truth）
- **GitHub 完全統合**: Issue、Projects v2、PR を `gh` CLI で操作
- **4フェーズモデル**: Requirements → Design → Implementation → Completed の構造化ワークフロー
- **ブランチ保護**: 統合ブランチ（main、develop など）での直接編集を防止

## クイックスタート

### 前提条件

- Claude Code CLI
- gh CLI（GitHub CLI）がインストール・認証済み

```bash
# gh CLI の確認
gh auth status
```

### インストール

```bash
# カレントディレクトリにインストール
curl -fsSL https://raw.githubusercontent.com/B16B1RD/cc-craft-kit/main/scripts/install.sh | sh

# 指定したディレクトリにインストール
curl -fsSL https://raw.githubusercontent.com/B16B1RD/cc-craft-kit/main/scripts/install.sh | sh -s -- /path/to/project

# 新規ディレクトリを作成してインストール
curl -fsSL https://raw.githubusercontent.com/B16B1RD/cc-craft-kit/main/scripts/install.sh | sh -s -- --project my-new-project
```

インストール後、Claude Code で `/cft:init` を実行してプロジェクトを初期化します。

### GitHub 統合の設定

```bash
# gh CLI で認証
gh auth login

# リポジトリの確認
gh repo view
```

### プロジェクト初期化

Claude Code のチャットで以下のスラッシュコマンドを実行します。

```sh
/cft:init
```

## 使い方

### 基本コマンド

すべてのコマンドは Claude Code のチャットからスラッシュコマンドで実行します。

```sh
# プロジェクト状態確認
/cft:status

# 仕様書作成
/cft:spec create "ユーザー認証機能" "メール/パスワード認証とOAuth2.0対応"

# 仕様書一覧
/cft:spec list
/cft:spec list requirements  # フェーズでフィルタ

# 仕様書詳細表示
/cft:spec get <spec-id>

# フェーズ移行
/cft:spec phase <spec-id> design
```

### GitHub 統合

```sh
# GitHub 初期化
/cft:github init <owner> <repo>

# Issue 作成
/cft:github issue-create <spec-id>

# 双方向同期
/cft:github sync to-github <spec-id>
/cft:github sync from-github <spec-id>
```

### タスク管理

```sh
# タスク一覧表示
/cft:task list <spec-id>

# タスク開始
/cft:task start <issue-number>

# タスク完了
/cft:task done <issue-number>

# タスク分割
/cft:task split <spec-id>

# 進捗レポート
/cft:task report <spec-id>
```

### ナレッジベース

```sh
# 進捗記録
/cft:knowledge progress <spec-id> "認証機能の基本実装が完了"

# エラー解決策記録
/cft:knowledge error <spec-id> "CORSエラーが発生" "Access-Control-Allow-Originヘッダーを追加"

# Tips 記録
/cft:knowledge tip <spec-id> "performance" "useMemoを使ってレンダリングを最適化"
```

### セッション管理

```sh
# セッション開始（コンテキスト確立）
/cft:session start [spec-id]

# セッション終了（進捗記録）
/cft:session end [spec-id]
```

### コードレビュー・テスト

```sh
# コードレビュー
/cft:review src/**/*.ts

# テスト生成
/cft:test generate src/utils/*.ts

# カバレッジ分析
/cft:test coverage src/
```

## 全コマンド一覧

cc-craft-kit v0.2.0 では、12 個の統合スラッシュコマンドで全機能を提供します。

### プロジェクト管理

| コマンド | 説明 |
|---------|------|
| `/cft:init` | プロジェクト初期化 |
| `/cft:status` | プロジェクト状態表示 |

### 仕様書管理（統合コマンド）

| コマンド | 説明 |
|---------|------|
| `/cft:spec create <name> [desc]` | 仕様書作成 |
| `/cft:spec list [phase] [limit]` | 仕様書一覧 |
| `/cft:spec get <spec-id>` | 仕様書詳細 |
| `/cft:spec phase <spec-id> <phase>` | フェーズ更新 |
| `/cft:spec delete <spec-id>` | 仕様書削除 |

### タスク管理（統合コマンド）

| コマンド | 説明 |
|---------|------|
| `/cft:task list <spec-id>` | タスク一覧 |
| `/cft:task start <issue-number>` | タスク開始 |
| `/cft:task done <issue-number>` | タスク完了 |
| `/cft:task update <issue-number> <status>` | 状態更新 |
| `/cft:task split <spec-id>` | タスク分割 |
| `/cft:task report <spec-id>` | 進捗レポート |

### GitHub 統合（統合コマンド）

| コマンド | 説明 |
|---------|------|
| `/cft:github init <owner> <repo>` | GitHub 初期化 |
| `/cft:github issue-create <spec-id>` | Issue 作成 |
| `/cft:github sync <direction> <spec-id>` | 双方向同期 |

### セッション管理（統合コマンド）

| コマンド | 説明 |
|---------|------|
| `/cft:session start [spec-id]` | セッション開始 |
| `/cft:session end [spec-id]` | セッション終了 |

### ナレッジベース（統合コマンド）

| コマンド | 説明 |
|---------|------|
| `/cft:knowledge progress <spec-id> <msg>` | 進捗記録 |
| `/cft:knowledge error <spec-id> <err> <sol>` | エラー記録 |
| `/cft:knowledge tip <spec-id> <cat> <tip>` | Tips 記録 |

### 品質管理（統合コマンド）

| コマンド | 説明 |
|---------|------|
| `/cft:review <file-pattern>` | コードレビュー |
| `/cft:test generate <file-pattern>` | テスト生成 |
| `/cft:test coverage <file-pattern>` | カバレッジ分析 |

### 同期・品質（統合コマンド）

| コマンド | 説明 |
|---------|------|
| `/cft:sync check` | 整合性チェック |
| `/cft:sync repair` | 整合性修復 |
| `/cft:quality init` | 品質ルール初期化 |
| `/cft:quality check` | 品質チェック |

### カスタムツール（統合コマンド）

| コマンド | 説明 |
|---------|------|
| `/cft:custom-tools skill list` | スキル一覧 |
| `/cft:custom-tools skill create <name>` | スキル作成 |
| `/cft:custom-tools agent list` | エージェント一覧 |
| `/cft:custom-tools agent create <name>` | エージェント作成 |

## アーキテクチャ

### ディレクトリ構造

```text
project-root/
├── .claude/                      # Claude Code 標準ディレクトリ
│   ├── commands/cft/             # スラッシュコマンド
│   │   ├── spec.md               # 仕様書管理
│   │   ├── task.md               # タスク管理
│   │   ├── github.md             # GitHub 統合
│   │   ├── session.md            # セッション管理
│   │   ├── knowledge.md          # ナレッジベース
│   │   ├── review.md             # コードレビュー
│   │   ├── test.md               # テスト生成
│   │   ├── status.md             # 状態表示
│   │   ├── sync.md               # 同期管理
│   │   ├── quality.md            # 品質管理
│   │   ├── custom-tools.md       # カスタムツール
│   │   └── init.md               # 初期化
│   ├── skills/                   # スキル
│   │   ├── pr-creator/           # PR 自動作成
│   │   ├── typescript-eslint/    # TypeScript/ESLint チェック
│   │   ├── database-schema-validator/  # スキーマ検証
│   │   └── git-operations/       # Git 操作ヘルパー
│   ├── agents/                   # サブエージェント
│   │   ├── requirements-analyzer.md
│   │   └── architect-designer.md
│   └── settings.json
│
├── .cc-craft-kit/                # プロジェクトデータ
│   ├── specs/                    # 仕様書（YAML フロントマター形式）
│   └── config.json               # プロジェクト設定
│
├── scripts/                      # ユーティリティスクリプト
│   └── install.sh                # インストーラー
│
└── README.md
```

### 仕様書フォーマット（YAML フロントマター）

仕様書は Markdown ファイルに YAML メタデータを埋め込んだ形式です。

```markdown
---
id: "abc123-def456-..."
name: "ユーザー認証機能"
phase: "implementation"
branch_name: "feature/spec-abc123-user-auth"
github_issue_number: 42
pr_url: null
created_at: "2025-01-01T00:00:00.000Z"
updated_at: "2025-01-02T00:00:00.000Z"
---

# ユーザー認証機能

## 1. 背景と目的

...
```

### 技術スタック

| カテゴリ | 技術 | 用途 |
|----------|------|------|
| CLI | Claude Code | AI アシスタント |
| GitHub | gh CLI | Issue/PR 操作 |
| ファイル | Glob/Read/Edit | ファイル操作 |
| 検索 | Grep | コンテンツ検索 |
| 設定 | JSON | プロジェクト設定 |
| 仕様書 | YAML + Markdown | メタデータ + 本文 |

## 開発（コントリビューター向け）

### リポジトリクローン

```bash
git clone https://github.com/B16B1RD/cc-craft-kit.git
cd cc-craft-kit
```

### ファイル構成の確認

```bash
# スラッシュコマンド一覧
ls -la .claude/commands/cft/

# スキル一覧
ls -la .claude/skills/

# 仕様書一覧
ls -la .cc-craft-kit/specs/
```

### テスト

手動テスト手順:

1. Claude Code でプロジェクトを開く
2. `/cft:status` で動作確認
3. `/cft:spec create "テスト機能" "テスト用"` で仕様書作成
4. `/cft:spec list` で一覧確認

## コントリビューション

コントリビューションを歓迎します。以下の手順でお願いします。

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### コミットメッセージ規約

Conventional Commits 形式を推奨します。

- `feat:` - 新機能
- `fix:` - バグ修正
- `refactor:` - リファクタリング
- `docs:` - ドキュメント変更
- `chore:` - 雑務

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。

## 謝辞

本プロジェクトは以下のプロジェクトから着想を得ています。

- **Kiro AI** - 仕様駆動 IDE のパイオニア
- **cc-sdd** - 構造化ワークフローの実装

---

**cc-craft-kit** - 匠の技で、開発ワークフローを磨き上げる。
