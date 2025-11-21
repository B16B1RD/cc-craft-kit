---
name: pr-creator
description: Pull Request 自動作成スキル。completed フェーズ移行時に GitHub Pull Request を自動作成し、textlint および markdownlint で PR 本文の品質を保証します。
---

# Pull Request 自動作成スキル

このスキルは、仕様書の completed フェーズ移行時に、自動的に GitHub Pull Request を作成します。

## 機能概要

### 自動 PR 作成

- completed フェーズ移行時に自動実行
- 仕様書の内容を元に PR タイトルと本文を生成
- textlint および markdownlint で品質チェック
- GitHub CLI (`gh pr create`) で PR を作成

### PR 本文の構成

生成される PR 本文には以下のセクションが含まれます。

1. **概要**: 仕様書の背景と目的を要約
2. **変更内容**: 実装した機能の箇条書き
3. **テスト計画**: テスト項目のチェックリスト
4. **関連 Issue**: 仕様書に紐づく GitHub Issue へのリンク

### 品質保証

- textlint チェック: 日本語文章の校正（警告・エラー0 件を保証）
- markdownlint チェック: Markdown 構文の検証（警告・エラー0 件を保証）

## 使用方法

### 自動実行（推奨）

completed フェーズに移行すると、自動的に実行されます。

```bash
/cft:spec-phase <spec-id> completed
```

### 手動実行（デバッグ用）

スキルを直接実行することも可能です。

```bash
# Skill ツールで実行
# (Claude Code のツールとして実行)
```

## 実装フロー

### 1. 仕様書ファイルの読み込み

Read ツールで `.cc-craft-kit/specs/<spec-id>.md` を読み込みます。

```bash
# 仕様書ファイルのパス
.cc-craft-kit/specs/<spec-id>.md
```

### 2. PR タイトル生成

仕様書名から PR タイトルを生成します。

**フォーマット:**

```text
feat: <仕様書名> を実装完了
```

**制約:**

- 最大 256 文字
- 超過する場合は末尾を `...` で省略

### 3. PR 本文生成

仕様書の内容から PR 本文を生成します。

**テンプレート:**

```markdown
## 概要

<仕様書の「背景と目的」セクションを要約>

## 変更内容

- <実装した機能 1>
- <実装した機能 2>
- <実装した機能 3>

## テスト計画

- [ ] <テスト項目 1>
- [ ] <テスト項目 2>
- [ ] <テスト項目 3>

## 関連 Issue

Closes #<issue-number>
```

**制約:**

- 最大 65536 文字（GitHub API の制限）
- 超過する場合は「変更内容」セクションを要約

### 4. 品質チェック

一時ファイルに PR 本文を保存し、textlint および markdownlint でチェックします。

**textlint チェック:**

```bash
# 一時ファイル作成
echo "<PR本文>" > /tmp/pr-body.md

# textlint 実行
npm run textlint /tmp/pr-body.md

# 警告・エラー0 件を確認
# エラーがある場合は詳細を表示
```

**markdownlint チェック:**

```bash
# markdownlint 実行
npx markdownlint-cli2 /tmp/pr-body.md

# 警告・エラー0 件を確認
# エラーがある場合は詳細を表示
```

### 5. PR 作成

GitHub CLI で PR を作成します。

```bash
# ベースブランチ取得（環境変数または develop をデフォルト）
BASE_BRANCH=${DEFAULT_BASE_BRANCH:-develop}

# PR 作成
gh pr create \
  --title "<タイトル>" \
  --body "<本文>" \
  --base "$BASE_BRANCH"

# PR URL を取得
PR_URL=$(gh pr view --json url -q .url)
```

### 6. 仕様書に PR URL を記録

Edit ツールで仕様書ファイルに PR URL を追記します。

```markdown
## Pull Request

- <PR URL>
```

## エラーハンドリング

### GitHub CLI 未インストール

```bash
# チェック
if ! command -v gh &> /dev/null; then
  echo "⚠️  GitHub CLI (gh) がインストールされていません"
  echo "インストール手順: https://cli.github.com/"
  exit 0  # PR 作成をスキップ（completed フェーズ移行は成功）
fi
```

### GitHub トークン未設定

```bash
# チェック
if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN 環境変数が設定されていません"
  echo "手動で PR を作成してください: gh pr create"
  exit 0  # PR 作成をスキップ
fi
```

### textlint/markdownlint エラー

```bash
# textlint エラー時
if [ $? -ne 0 ]; then
  echo "❌ textlint チェックに失敗しました"
  echo "エラー箇所を修正後、再度実行してください"
  # エラー詳細を表示
  npm run textlint /tmp/pr-body.md
  exit 1
fi
```

### GitHub API レート制限

```bash
# リトライロジック（最大 3 回、指数バックオフ）
MAX_RETRIES=3
RETRY_COUNT=0
BACKOFF_SECONDS=5

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  gh pr create --title "$TITLE" --body "$BODY" --base "$BASE_BRANCH"

  if [ $? -eq 0 ]; then
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))

  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "⚠️  PR 作成失敗。${BACKOFF_SECONDS}秒後にリトライします（${RETRY_COUNT}/${MAX_RETRIES}）"
    sleep $BACKOFF_SECONDS
    BACKOFF_SECONDS=$((BACKOFF_SECONDS * 2))
  else
    echo "❌ PR 作成に失敗しました（最大リトライ回数を超過）"
    exit 1
  fi
done
```

## 制約事項

### GitHub API 制限

- PR タイトル: 最大 256 文字
- PR 本文: 最大 65536 文字
- API レート制限: 5,000 リクエスト/時（認証済み）

### 環境要件

- GitHub CLI (`gh`) 2.0 以上
- Node.js 20.x 以上
- textlint 設定ファイル (`.textlintrc.json`)
- markdownlint 設定ファイル (`.markdownlint.json`)

### Git リポジトリ要件

- Git リポジトリが初期化されていること
- 現在のブランチがリモートにプッシュされていること
- ベースブランチ（develop または main）が存在すること

## 設定

### 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | (必須) |
| `DEFAULT_BASE_BRANCH` | PR のベースブランチ | `develop` |

### 設定ファイル

**.textlintrc.json**

```json
{
  "rules": {
    "preset-ja-technical-writing": true
  }
}
```

**.markdownlint.json**

```json
{
  "MD013": false,
  "MD033": false
}
```

## トラブルシューティング

### PR 作成がスキップされる

**原因:** GitHub CLI がインストールされていない

**解決策:**

```bash
# macOS
brew install gh

# Linux
sudo apt install gh

# Windows
winget install GitHub.cli
```

### textlint チェックエラー

**原因:** PR 本文に日本語の校正エラーがある

**解決策:**

```bash
# エラー箇所を確認
npm run textlint /tmp/pr-body.md

# 自動修正を試行
npm run textlint:fix /tmp/pr-body.md
```

### markdownlint チェックエラー

**原因:** Markdown 構文エラーがある

**解決策:**

```bash
# エラー箇所を確認
npx markdownlint-cli2 /tmp/pr-body.md

# 自動修正を試行
npx markdownlint-cli2 --fix /tmp/pr-body.md
```

### API レート制限エラー

**原因:** GitHub API の 1 時間あたりのリクエスト制限（5,000 回）を超過

**解決策:**

```bash
# レート制限状態を確認
gh api rate_limit

# リセット時刻まで待機
# または手動で PR を作成
gh pr create --title "タイトル" --body "本文"
```

## ベストプラクティス

### PR 本文の品質向上

- 具体的な変更内容を箇条書きで記載
- テスト項目をチェックリストで明記
- スクリーンショットや動作 GIF を添付（必要に応じて）
- 関連 Issue や仕様書へのリンクを記載

### セキュリティ

- GITHUB_TOKEN を環境変数で管理（コードに直接記述しない）
- PR 本文にセンシティブ情報を含めない
- トークンのスコープは最小限に設定（`repo` スコープのみ）

### パフォーマンス

- PR 本文の生成は仕様書の要約のみ（全文コピーしない）
- textlint/markdownlint チェックは一時ファイルで実行（元ファイルを変更しない）
- リトライロジックで API レート制限エラーに対処

## 関連ドキュメント

- [GitHub CLI - PR 作成](https://cli.github.com/manual/gh_pr_create)
- [textlint](https://textlint.github.io/)
- [markdownlint](https://github.com/DavidAnson/markdownlint)
- [CLAUDE.md - スキルシステム](../../CLAUDE.md#サブエージェントとスキルの使用方針)
