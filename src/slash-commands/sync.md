---
description: "同期コマンド（整合性チェック/修復）"
argument-hint: "<subcommand>"
---

# 同期管理

仕様書ファイルと GitHub Issue 間の整合性チェック・修復を行う統合コマンドです。

## サブコマンド

| サブコマンド | 説明 | 引数 |
|-------------|------|------|
| `check` | 整合性をチェック | なし |
| `repair` | 整合性を修復 | なし |

## 使用例

```bash
# 整合性チェック
/cft:sync check

# 整合性修復
/cft:sync repair
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: サブコマンドの解析

`$1` を解析し、以下のいずれかに分岐:

| 入力 | サブコマンド |
|------|-------------|
| `check`, `c`, `chk`, `status` | check |
| `repair`, `r`, `fix`, `sync` | repair |

サブコマンドが指定されていない場合:

```
❌ サブコマンドを指定してください

使用可能なサブコマンド:
- check: 仕様書ファイルと GitHub Issue 間の整合性をチェック
- repair: 整合性を自動修復

使用例:
/cft:sync check
/cft:sync repair
```

処理を中断。

---

## サブコマンド: check

仕様書ファイル (`.cc-craft-kit/specs/*.md`) と GitHub Issue 間の整合性をチェックします。

### 実行フロー

#### Step C1: 仕様書ファイル一覧取得

Glob ツールで仕様書ファイルを取得:

```
パターン: .cc-craft-kit/specs/*.md
```

#### Step C2: 各仕様書の YAML フロントマター解析

各ファイルを Read ツールで読み込み、YAML フロントマターを解析:

```yaml
---
id: "uuid"
name: "仕様書名"
phase: "implementation"
branch_name: "feature/xxx"
github_issue_number: 123
pr_url: "https://..."
created_at: "2025-01-01T00:00:00Z"
updated_at: "2025-01-01T00:00:00Z"
---
```

以下を集計:

```
SPECS_TOTAL = 仕様書ファイル総数
SPECS_WITH_ISSUE = github_issue_number が設定されている仕様書
SPECS_WITHOUT_ISSUE = github_issue_number が null/未設定の仕様書
SPECS_WITH_BRANCH = branch_name が設定されている仕様書
SPECS_WITHOUT_BRANCH = branch_name が null/未設定の仕様書
```

#### Step C3: GitHub Issue 状態確認（github_issue_number がある仕様書）

`gh` CLI で Issue の状態を確認:

```bash
gh issue view $GITHUB_ISSUE_NUMBER --json number,state,title -q '"\(.number)|\(.state)|\(.title)"'
```

以下を分類:

```
ISSUES_OPEN = state が OPEN の Issue
ISSUES_CLOSED = state が CLOSED の Issue
ISSUES_NOT_FOUND = 存在しない Issue 番号
```

#### Step C4: フェーズと Issue 状態の整合性チェック

| 仕様書フェーズ | 期待される Issue 状態 | 不整合フラグ |
|--------------|---------------------|-------------|
| requirements | OPEN | Issue が CLOSED なら不整合 |
| design | OPEN | Issue が CLOSED なら不整合 |
| implementation | OPEN | Issue が CLOSED なら不整合 |
| review | OPEN | Issue が CLOSED なら不整合 |
| completed | CLOSED | Issue が OPEN なら不整合 |

#### Step C5: ブランチ存在確認

```bash
git branch --list "$BRANCH_NAME"
```

ローカルブランチが存在しない場合:

```bash
git ls-remote --heads origin "$BRANCH_NAME"
```

#### Step C6: 結果表示

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 整合性チェック結果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## サマリー

| 項目 | 件数 |
|------|-----:|
| 仕様書ファイル総数 | {SPECS_TOTAL} |
| Issue 紐付け済み | {SPECS_WITH_ISSUE} |
| Issue 未作成 | {SPECS_WITHOUT_ISSUE} |
| ブランチ紐付け済み | {SPECS_WITH_BRANCH} |

{不整合がない場合}
✓ すべての仕様書が正常です

{不整合がある場合}
## 不整合一覧

### フェーズと Issue 状態の不整合

| 仕様書 | フェーズ | Issue | Issue 状態 | 問題 |
|--------|---------|-------|-----------|------|
{不整合の仕様書リスト}

### 存在しない Issue

| 仕様書 | 設定された Issue 番号 |
|--------|---------------------|
{存在しない Issue のリスト}

### 存在しないブランチ

| 仕様書 | 設定されたブランチ名 |
|--------|---------------------|
{存在しないブランチのリスト}

## 次のアクション

修復が必要な場合:
/cft:sync repair
```

---

## サブコマンド: repair

仕様書ファイルと GitHub Issue 間の整合性を自動修復します。

### 修復ルール

| 問題 | 修復アクション |
|------|---------------|
| completed フェーズで Issue が OPEN | Issue をクローズ |
| 非 completed フェーズで Issue が CLOSED | 仕様書のフェーズを completed に更新 |
| 存在しない Issue 番号 | github_issue_number を削除 |
| 存在しないブランチ | branch_name を削除（警告表示） |

### 実行フロー

#### Step R1: 整合性チェック実行

check サブコマンドと同様の処理で不整合を検出。

#### Step R2: 修復実行

**Issue クローズ（completed フェーズで OPEN の場合）:**

```bash
gh issue close $GITHUB_ISSUE_NUMBER --comment "✅ 仕様が完了したためクローズします"
```

**仕様書フェーズ更新（非 completed で CLOSED の場合）:**

Edit ツールで YAML フロントマターの `phase:` を `completed` に更新。

**無効な Issue 番号削除:**

Edit ツールで YAML フロントマターの `github_issue_number:` 行を削除。

**無効なブランチ名削除:**

Edit ツールで YAML フロントマターの `branch_name:` 行を削除。

#### Step R3: 自動コミット

```bash
git add ".cc-craft-kit/specs/*.md"
git commit -m "chore: 仕様書の整合性を修復"
```

#### Step R4: 結果表示

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 同期修復結果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 修復アクション

| アクション | 件数 |
|----------|-----:|
| Issue クローズ | {N} |
| フェーズ更新 | {N} |
| 無効な Issue 番号削除 | {N} |
| 無効なブランチ名削除 | {N} |

{修復内容の詳細リスト}

## 修復後の状態

✓ すべての仕様書が正常になりました

## 次のアクション

- 整合性を再確認: /cft:sync check
- 仕様書一覧: /cft:spec list
```

---

## エラーハンドリング

### specs ディレクトリが存在しない場合

```
⚠️ 仕様書ディレクトリが見つかりません

ディレクトリ: .cc-craft-kit/specs/

cc-craft-kit を初期化してください:
/cft:init
```

### gh CLI が利用できない場合

```
❌ gh CLI が見つかりません

インストール方法:
- macOS: brew install gh
- Ubuntu: sudo apt install gh
- Windows: winget install GitHub.cli

認証: gh auth login
```

### gh CLI が認証されていない場合

```
❌ GitHub 認証が必要です

以下のコマンドで認証してください:
gh auth login
```

---

## 補足

### ファイル優先の理由

整合性修復時にファイルのデータを優先する理由:

1. **バージョン管理**: 仕様書ファイルは Git で管理されており、履歴を追跡可能
2. **可読性**: Markdown ファイルは人間が直接編集・確認しやすい
3. **Single Source of Truth**: ファイルを正とすることで、データの一貫性を保証

### 定期的なチェック推奨

以下のタイミングで整合性チェックを推奨:

- Git ブランチ切り替え後
- 仕様書ファイルの手動編集後
- GitHub Issue の手動操作後
- チーム間での作業同期時
