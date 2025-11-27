---
description: "タスク完了コマンド（Sub Issue をクローズ＆ PR 作成）"
argument-hint: "<issue-number>"
---

# タスク完了

Sub Issue をクローズし、必要に応じて Pull Request を作成します。

## 引数

- `$1` (必須): Sub Issue の番号（例: `123`）

## 使用例

```bash
/cft:task-done 123
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: 引数の検証

`$1` が数値でない場合:

```
❌ Issue 番号は数値で指定してください

使用例: /cft:task-done 123
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
gh issue view $1 --json number,title,state,body --repo "$REPO"
```

出力を解析し、以下を記録:

- `ISSUE_NUMBER`: Issue 番号
- `ISSUE_TITLE`: Issue タイトル
- `ISSUE_STATE`: Issue ステータス（open/closed）

### Step 4: ステータス確認

`ISSUE_STATE` が `closed` の場合:

```
ℹ️ Issue #$ISSUE_NUMBER は既にクローズされています

PR の確認:
  gh pr list --search "head:$(git branch --show-current)" --repo "$REPO"
```

処理を中断。

### Step 5: 未コミットの変更を確認

Bash ツールで以下を実行:

```bash
git status --porcelain
```

出力がある場合:

```
⚠️ コミットされていない変更があります

以下の変更をコミットしてから再実行してください:
[git status の出力]

コミット例:
  git add .
  git commit -m "feat: $ISSUE_TITLE"
```

処理を中断。

### Step 6: 現在のブランチを確認

Bash ツールで以下を実行:

```bash
git branch --show-current
```

出力を `CURRENT_BRANCH` として記録。

`CURRENT_BRANCH` が `main` または `develop` の場合:

```
⚠️ メインブランチで作業しています

作業ブランチを作成してからタスクを開始してください:
  /cft:task-start $ISSUE_NUMBER
```

処理を中断。

### Step 7: リモートへのプッシュ

Bash ツールで以下を実行:

```bash
git push -u origin $CURRENT_BRANCH
```

### Step 8: Pull Request の確認・作成

既存の PR を確認:

```bash
gh pr list --head "$CURRENT_BRANCH" --json number,url --repo "$REPO"
```

PR が存在しない場合、作成:

```bash
gh pr create --title "$ISSUE_TITLE" --body "$(cat <<'EOF'
## Summary

Closes #$ISSUE_NUMBER

## Changes

- [変更内容を記述]

## Test Plan

- [テスト方法を記述]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" --repo "$REPO"
```

PR URL を `PR_URL` として記録。

### Step 9: Issue のクローズ

Bash ツールで以下を実行:

```bash
gh issue close $ISSUE_NUMBER --repo "$REPO" --comment "Completed in $PR_URL"
```

### Step 9.5: task.completed イベント発火

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/task/done.ts $ISSUE_NUMBER
```

出力（JSON）を確認:

- `success: true` の場合: イベント発火成功、次のステップへ
- `eventEmitted: true` の場合: Sub Issue のステータスが自動的に更新される
- `success: false` の場合: エラーメッセージを表示（処理は継続）

> **注意**: このステップはイベント駆動アーキテクチャを通じて以下の処理を自動実行します:
> - Sub Issue のステータス更新（既に Step 9 でクローズ済みのため、同期処理）
> - GitHub Projects 上の Sub Issue ステータスを "Done" に更新

### Step 10: 結果の表示

```
# タスク完了: #$ISSUE_NUMBER

$ISSUE_TITLE

## 完了アクション

✓ ブランチをプッシュ: $CURRENT_BRANCH
✓ Pull Request を作成: $PR_URL
✓ Issue をクローズ: #$ISSUE_NUMBER

## 次のステップ

1. PR のレビューを依頼
2. CI チェックを確認
3. マージ後、ブランチを削除

## 他のタスクを確認

- タスク一覧: /cft:task-list <spec-id>
- 次のタスクを開始: /cft:task-start <issue-number>
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

### プッシュに失敗した場合

```
❌ リモートへのプッシュに失敗しました

以下を確認してください:
- git fetch && git rebase origin/develop
- コンフリクトがある場合は解消してください
- 認証情報が正しいか確認してください
```

### PR 作成に失敗した場合

```
❌ Pull Request の作成に失敗しました

手動で作成してください:
  gh pr create --title "$ISSUE_TITLE" --body "Closes #$ISSUE_NUMBER"

または GitHub Web UI から作成:
  https://github.com/$REPO/compare/$CURRENT_BRANCH
```

---

## オプション機能

### --no-pr フラグ（PR を作成しない）

PR を作成せずに Issue のみクローズする場合:

```bash
/cft:task-done 123 --no-pr
```

この場合、Step 8 をスキップし、Step 9 で PR URL なしでクローズ。

### --draft フラグ（ドラフト PR を作成）

ドラフト PR を作成する場合:

```bash
/cft:task-done 123 --draft
```

Step 8 で `gh pr create --draft` を使用。
