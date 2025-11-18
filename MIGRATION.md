# 移行ガイド: cc-craft-kit → cc-craft-kit

## 概要

このガイドは、cc-craft-kit（旧名称: cc-craft-kit）から cc-craft-kit への移行手順を説明します。

**変更日**: 2025-11-18
**変更バージョン**: v0.1.0 → v0.2.0（予定）

## 主な変更点

| 項目 | 旧 | 新 |
|---|---|---|
| プロジェクト名 | cc-craft-kit（匠） | cc-craft-kit |
| npm パッケージ名 | `takumi` | `cc-craft-kit` |
| スラッシュコマンド | `/takumi:*` | `/cft:*` |
| コマンドディレクトリ | `.claude/commands/takumi/` | `.claude/commands/cft/` |
| GitHub リポジトリ | `autum/takumi` | `autum/cc-craft-kit` |

## 対象ユーザー

- cc-craft-kit を既にインストールしているユーザー
- cc-craft-kit を使用した開発プロジェクトを持つユーザー

## 移行手順

### ステップ1: 既存のインストールをバックアップ

```bash
# .takumi ディレクトリのバックアップ（任意）
cp -r .takumi .takumi.backup

# Git で変更をコミット（作業中の変更がある場合）
git add .
git commit -m "backup: 移行前の状態を保存"
```

### ステップ2: 新バージョンのインストール

#### オプションA: npm 経由（推奨）

```bash
# 古いパッケージをアンインストール
npm uninstall -g takumi

# 新しいパッケージをインストール
npm install -g cc-craft-kit

# インストール確認
cc-craft-kit --version
```

#### オプションB: 手動インストール（開発者向け）

```bash
# リポジトリをクローン
git clone https://github.com/autum/cc-craft-kit.git
cd cc-craft-kit

# 依存関係をインストール
npm install

# ビルド
npm run build

# グローバルリンク
npm link
```

### ステップ3: プロジェクトの初期化（既存プロジェクトの場合）

```bash
# プロジェクトディレクトリで初期化
cd /path/to/your/project

# 古い .takumi ディレクトリを削除（バックアップ済みの場合のみ）
rm -rf .takumi

# 新しく初期化
cft:init my-project "プロジェクト説明"
```

### ステップ4: スラッシュコマンドの移行

**旧コマンド → 新コマンドの対応表:**

| 旧コマンド | 新コマンド | 説明 |
|---|---|---|
| `/takumi:init` | `/cft:init` | プロジェクト初期化 |
| `/takumi:status` | `/cft:status` | プロジェクト状態確認 |
| `/takumi:spec-create` | `/cft:spec-create` | 仕様書作成 |
| `/takumi:spec-list` | `/cft:spec-list` | 仕様書一覧 |
| `/takumi:spec-get` | `/cft:spec-get` | 仕様書詳細表示 |
| `/takumi:spec-phase` | `/cft:spec-phase` | フェーズ更新 |
| `/takumi:github-init` | `/cft:github-init` | GitHub 統合初期化 |
| `/takumi:github-issue-create` | `/cft:github-issue-create` | Issue 作成 |
| `/takumi:github-sync` | `/cft:github-sync` | GitHub 同期 |
| `/takumi:github-project-add` | `/cft:github-project-add` | Project 追加 |
| `/takumi:code-review` | `/cft:code-review` | コードレビュー |
| `/takumi:test-generate` | `/cft:test-generate` | テスト生成 |
| `/takumi:lint-check` | `/cft:lint-check` | Lint チェック |
| `/takumi:schema-validate` | `/cft:schema-validate` | スキーマ検証 |
| `/takumi:refactor` | `/cft:refactor` | リファクタリング |
| `/takumi:knowledge-progress` | `/cft:knowledge-progress` | 進捗記録 |
| `/takumi:knowledge-error` | `/cft:knowledge-error` | エラー記録 |
| `/takumi:knowledge-tip` | `/cft:knowledge-tip` | Tips 記録 |
| `/takumi:watch` | `/cft:watch` | ファイル監視 |

**使用例:**

```bash
# 旧: /takumi:spec-create "新機能" "新機能の説明"
# 新: /cft:spec-create "新機能" "新機能の説明"

# 旧: /takumi:spec-phase abc12345 implementation
# 新: /cft:spec-phase abc12345 implementation
```

### ステップ5: 動作確認

```bash
# ステータス確認
/cft:status

# 仕様書一覧表示
/cft:spec-list

# GitHub 統合確認（GitHub 統合を使用している場合）
/cft:github-sync pull <spec-id>
```

## トラブルシューティング

### 問題1: スラッシュコマンドが認識されない

**症状:**
```
Command '/cft:*' not found
```

**原因:** `.claude/commands/cft/` ディレクトリが存在しない、またはシンボリックリンクが切れている。

**解決方法:**

```bash
# シンボリックリンクを確認
ls -la .claude/commands/

# シンボリックリンクがない場合は再作成
ln -s ../../src/slash-commands .claude/commands/cft
```

### 問題2: 旧コマンドが残っている

**症状:**
```
/takumi:status が動作する
/cft:status が動作しない
```

**原因:** `.claude/commands/takumi/` ディレクトリが残っている。

**解決方法:**

```bash
# 旧ディレクトリを削除
rm -rf .claude/commands/takumi

# 新ディレクトリを確認
ls -la .claude/commands/cft
```

### 問題3: データベースが見つからない

**症状:**
```
Error: Database file not found
```

**原因:** `.takumi/takumi.db` が削除されている。

**解決方法:**

```bash
# プロジェクトを再初期化
/cft:init my-project "プロジェクト説明"

# または、バックアップから復元
cp .takumi.backup/takumi.db .takumi/takumi.db
```

### 問題4: GitHub 統合が動作しない

**症状:**
```
Error: GitHub token not found
```

**原因:** `.env` ファイルが削除されている、または GitHub トークンが無効。

**解決方法:**

```bash
# .env ファイルを確認
cat .env

# トークンが無効な場合は再設定
echo "GITHUB_TOKEN=ghp_your_token_here" > .env

# GitHub 統合を再初期化
/cft:github-init owner repo
```

## よくある質問（FAQ）

### Q1: 既存の仕様書データは引き継がれますか？

**A:** はい、`.takumi/` ディレクトリをバックアップして復元すれば、すべてのデータ（仕様書、タスク、ログ）が引き継がれます。

### Q2: 旧コマンドと新コマンドを併用できますか？

**A:** いいえ、旧コマンド（`/takumi:*`）は削除されているため、新コマンド（`/cft:*`）のみ使用してください。

### Q3: npm パッケージ名が変更された理由は？

**A:** 商標競合リスクを回避するため、cc-xxx-kit 形式の名称に変更しました。詳細は `docs/trademark-research-report.md` を参照してください。

### Q4: GitHub リポジトリのURLが変更されますか？

**A:** はい、`https://github.com/autum/takumi` から `https://github.com/autum/cc-craft-kit` に変更されます。旧 URL はリダイレクト設定されるため、しばらくは旧 URL でもアクセス可能です。

### Q5: 移行に失敗した場合、元に戻せますか？

**A:** はい、バックアップから復元すれば元に戻せます。

```bash
# バックアップから復元
rm -rf .takumi
cp -r .takumi.backup .takumi

# 旧バージョンを再インストール（必要に応じて）
npm install -g takumi@0.1.0
```

## サポート期間

- **旧名称（cc-craft-kit）のサポート終了日**: 2026-02-18（3 ヶ月後）
- **移行推奨期間**: 2025-11-18 ～ 2026-02-18
- **新名称（cc-craft-kit）のサポート開始日**: 2025-11-18

## 連絡先

移行に関する質問や問題が発生した場合は、以下にお問い合わせください。

- **GitHub Issues**: https://github.com/autum/cc-craft-kit/issues
- **ドキュメント**: https://github.com/autum/cc-craft-kit/blob/main/README.md
- **商標調査報告書**: `docs/trademark-research-report.md`

## 関連ドキュメント

- [README.md](./README.md) - プロジェクト概要
- [CLAUDE.md](./CLAUDE.md) - Claude Code 向けガイド
- [docs/QUICK_START.md](./docs/QUICK_START.md) - クイックスタートガイド
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - アーキテクチャ設計
- [docs/trademark-research-report.md](./docs/trademark-research-report.md) - 商標調査報告書

## 変更履歴

- **2025-11-18**: 初版公開（v0.1.0 → v0.2.0 移行ガイド）
