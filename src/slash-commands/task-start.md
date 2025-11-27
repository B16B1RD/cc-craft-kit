---
description: "タスク開始コマンド（Sub Issue をアサイン＆ブランチ作成）"
argument-hint: "<issue-number>"
---

# タスク開始

Sub Issue をアサインし、作業用ブランチを作成します。

## 引数

- `$1` (必須): Sub Issue の番号（例: `123`）

## 使用例

```bash
/cft:task-start 123
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: 引数の検証

`$1` が数値でない場合:

```
❌ Issue 番号は数値で指定してください

使用例: /cft:task-start 123
```

処理を中断。

### Step 2: リポジトリ情報の取得

Bash ツールで以下を実行:

```bash
git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/'
```

出力を `REPO` として記録（例: `owner/repo`）。

### Step 3: Issue 情報の取得

Bash ツールで以下を実行:

```bash
gh issue view $1 --json number,title,state,assignees --repo "$REPO"
```

出力を解析し、以下を記録:

- `ISSUE_NUMBER`: Issue 番号
- `ISSUE_TITLE`: Issue タイトル
- `ISSUE_STATE`: Issue ステータス（open/closed）
- `ASSIGNEES`: アサイン済みユーザー

### Step 4: ステータス確認

`ISSUE_STATE` が `closed` の場合:

```
⚠️ Issue #$ISSUE_NUMBER は既にクローズされています

再開する場合:
  gh issue reopen $ISSUE_NUMBER --repo "$REPO"
```

処理を中断。

### Step 5: 現在のブランチを保存

Bash ツールで以下を実行:

```bash
git branch --show-current
```

出力を `ORIGINAL_BRANCH` として記録。

### Step 6: 作業ブランチの作成

ブランチ名を生成:

- フォーマット: `feature/issue-$ISSUE_NUMBER-<sanitized-title>`
- タイトルのサニタイズ: 英数字とハイフンのみ、30文字以内

Bash ツールで以下を実行:

```bash
git checkout -b "$BRANCH_NAME"
```

エラーの場合（ブランチ既存など）:

```
⚠️ ブランチ $BRANCH_NAME は既に存在します

既存ブランチに切り替えますか？
  git checkout $BRANCH_NAME
```

### Step 7: Issue のアサイン

Bash ツールで以下を実行:

```bash
gh issue edit $ISSUE_NUMBER --add-assignee @me --repo "$REPO"
```

### Step 8: Issue ステータスを In Progress に更新（オプション）

GitHub Projects が設定されている場合、ステータスを更新:

```bash
# Projects の設定確認（エラーは無視）
gh issue view $ISSUE_NUMBER --json projectItems --repo "$REPO" 2>/dev/null
```

### Step 9: 結果の表示

```
# タスク開始: #$ISSUE_NUMBER

$ISSUE_TITLE

## 作業環境

- ブランチ: $BRANCH_NAME
- アサイン: @me
- ステータス: In Progress

## 次のアクション

1. 実装を進める
2. コミット: git commit -m "feat: ..."
3. 完了時: /cft:task-done $ISSUE_NUMBER

## 便利なコマンド

- 差分確認: git diff
- ステータス: git status
- Issue 確認: gh issue view $ISSUE_NUMBER
```

---

## エラーハンドリング

### Issue が見つからない場合

```
❌ Issue #$1 が見つかりません

確認事項:
- Issue 番号が正しいか確認してください
- gh auth status で認証状態を確認してください
- リポジトリへのアクセス権があるか確認してください
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

### Git ワーキングディレクトリが汚れている場合

```
⚠️ コミットされていない変更があります

以下のいずれかを実行してください:
- 変更をコミット: git add . && git commit -m "wip"
- 変更を退避: git stash
- 変更を破棄: git checkout .
```

---

## 補足

### ブランチ命名規則

- プレフィックス: `feature/issue-`
- Issue 番号を含める
- タイトルから意味のある単語を抽出
- 30 文字以内に収める

例:
- Issue #123 "Add user authentication" → `feature/issue-123-add-user-auth`
- Issue #456 "Fix database connection leak" → `feature/issue-456-fix-db-conn`
