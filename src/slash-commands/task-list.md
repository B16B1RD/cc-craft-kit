---
description: "Sub Issue 一覧表示コマンドを追加"
argument-hint: "<spec-id>"
---

# タスク一覧（Sub Issue）

仕様書に紐づく Sub Issue の一覧と進捗を表示します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）

## 使用例

```bash
/cft:task-list dd4f5124
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: 仕様書 ID の解決

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/spec/resolve-id.ts "$1"
```

出力（JSON）を解析し、以下を記録:

- `SPEC_ID`: 完全な仕様書 ID (`spec.id`)
- `SPEC_NAME`: 仕様書名 (`spec.name`)
- `GITHUB_ISSUE_NUMBER`: GitHub Issue 番号 (`spec.github_issue_number`)

エラーの場合（`success: false`）:

- エラーメッセージを表示して処理を中断

### Step 2: GitHub Issue の確認

`GITHUB_ISSUE_NUMBER` が null の場合:

```
⚠️ この仕様書には GitHub Issue が紐づいていません。

GitHub Issue を作成してください:
  /cft:github-issue-create $SPEC_ID
```

処理を中断。

### Step 3: Sub Issue 一覧の取得

Bash ツールで以下を実行（gh CLI を使用）:

```bash
gh issue view $GITHUB_ISSUE_NUMBER --json title,state,body,subIssues --repo "$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')"
```

出力を解析し、`subIssues` 配列を取得。

### Step 4: 結果の表示

```
# タスク一覧: $SPEC_NAME

親 Issue: #$GITHUB_ISSUE_NUMBER

## Sub Issues

| # | タイトル | ステータス |
|---|---------|-----------|
| #XX | タスク名 | open/closed |
| #YY | タスク名 | open/closed |
...

## 進捗サマリー

- 完了: X / Y
- 進捗率: XX%

## 次のアクション

- タスクを開始: /cft:task-start <issue-number>
- タスクを完了: /cft:task-done <issue-number>
- 仕様書詳細: /cft:spec-get $SPEC_ID
```

### Step 5: Sub Issue がない場合

```
ℹ️ Sub Issue はまだ作成されていません。

仕様書の「## 8. 実装タスクリスト」セクションを確認し、
design フェーズへ移行するか、手動で Sub Issue を作成してください。

推奨アクション:
- design フェーズへ移行: /cft:spec-phase $SPEC_ID design
- 手動で Sub Issue 作成: gh issue create --title "タスク名" ...
```

---

## エラーハンドリング

### 仕様書が見つからない場合

```
❌ 仕様書が見つかりません: $1

確認事項:
- 仕様書 ID は最低 8 文字必要です
- /cft:spec-list で仕様書一覧を確認してください
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
