# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

cc-craft-kit は、Claude Code 上で仕様駆動開発（SDD）を実現する**ゼロ依存**の開発支援ツールキット。
詳細は README.md を参照。

## 設計原則

### プロンプトファースト

すべての機能はスラッシュコマンド（.md ファイル）で実装する。
TypeScript/npm は使用しない。

### Single Source of Truth

仕様書は YAML フロントマター形式の Markdown ファイルとして管理。
データベースは使用しない。

### gh CLI 活用

GitHub 操作はすべて `gh` CLI で実行。
Octokit は使用しない。

## ディレクトリ構成

```text
project-root/
├── .claude/                      # Claude Code 標準ディレクトリ
│   ├── commands/cft/             # スラッシュコマンド（12個）
│   │   ├── spec.md               # 仕様書管理（create/list/get/phase/delete）
│   │   ├── task.md               # タスク管理（list/start/done/update/split/report）
│   │   ├── github.md             # GitHub 統合（init/issue-create/sync）
│   │   ├── session.md            # セッション管理（start/end）
│   │   ├── knowledge.md          # ナレッジ（progress/error/tip）
│   │   ├── review.md             # コードレビュー
│   │   ├── test.md               # テスト生成（generate/coverage）
│   │   ├── status.md             # プロジェクト状態
│   │   ├── sync.md               # 整合性（check/repair）
│   │   ├── quality.md            # 品質管理（init/check/generate）
│   │   ├── custom-tools.md       # カスタムツール
│   │   └── init.md               # 初期化
│   ├── skills/                   # スキル（4個）
│   │   ├── pr-creator/
│   │   ├── typescript-eslint/
│   │   ├── database-schema-validator/
│   │   └── git-operations/
│   ├── agents/                   # サブエージェント（2個）
│   │   ├── requirements-analyzer.md
│   │   └── architect-designer.md
│   └── settings.json
│
├── .cc-craft-kit/                # プロジェクトデータ
│   ├── specs/                    # 仕様書（YAML フロントマター形式）
│   └── config.json               # プロジェクト設定
│
├── scripts/                      # ユーティリティスクリプト
│   ├── install.sh                # インストーラー
│   └── migrate-specs-to-yaml-frontmatter.sh  # 移行スクリプト
│
├── CLAUDE.md                     # このファイル
├── README.md                     # ユーザー向けドキュメント
└── package.json                  # npm パッケージメタデータのみ
```

## 仕様書フォーマット

```markdown
---
id: "uuid"
name: "仕様書名"
phase: "requirements|design|implementation|completed"
branch_name: "feature/spec-xxx-description"
github_issue_number: 123
pr_url: "https://github.com/..."
created_at: "ISO8601"
updated_at: "ISO8601"
---

# 仕様書名

## 1. 背景と目的
...
```

## スラッシュコマンド一覧

| コマンド | 説明 |
|---------|------|
| `/cft:init` | プロジェクト初期化 |
| `/cft:status` | プロジェクト状態表示 |
| `/cft:spec <subcommand>` | 仕様書管理 |
| `/cft:task <subcommand>` | タスク管理 |
| `/cft:github <subcommand>` | GitHub 統合 |
| `/cft:session <subcommand>` | セッション管理 |
| `/cft:knowledge <subcommand>` | ナレッジベース |
| `/cft:review <pattern>` | コードレビュー |
| `/cft:test <subcommand>` | テスト生成 |
| `/cft:sync <subcommand>` | 整合性チェック |
| `/cft:quality <subcommand>` | 品質管理 |
| `/cft:custom-tools <subcommand>` | カスタムツール |

## 開発ワークフロー

1. `.claude/commands/cft/` のスラッシュコマンドを直接編集
2. `.claude/skills/` のスキルを直接編集
3. `.claude/agents/` のサブエージェントを直接編集
4. Claude Code で `/cft:*` コマンドを実行して動作確認

## 仕様書の操作パターン

### 仕様書の特定

```
# Glob で検索
.cc-craft-kit/specs/*<spec-id>*.md

# 完全 ID または短縮 ID（先頭8文字）で検索
```

### YAML フロントマターの解析

```
# Read ツールでファイルを読み込み
# --- で囲まれた部分を YAML として解析
# 本文は --- 以降
```

### 仕様書の更新

```
# Edit ツールで YAML フロントマターを更新
# updated_at を現在時刻に更新
```

## GitHub 操作パターン

### Issue 作成

```bash
gh issue create --title "【SDD】<name>" --body "<body>" --label "sdd"
```

### Issue コメント

```bash
gh issue comment <number> --body "<comment>"
```

### Issue 状態取得

```bash
gh issue view <number> --json state,title,body
```

### PR 作成

```bash
gh pr create --title "<title>" --body "<body>" --base develop
```

## 注意事項

- TypeScript ファイルは存在しない（すべて削除済み）
- npm install は不要
- データベースは使用しない
- すべての操作は Glob + Read + Edit + gh CLI で実行
