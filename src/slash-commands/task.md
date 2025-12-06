---
description: "タスク管理コマンド（一覧/開始/更新/完了）"
argument-hint: "<subcommand> [args...]"
---

# タスク管理

仕様書のタスクリストと GitHub Sub Issue を管理する統合コマンドです。

## サブコマンド

| サブコマンド | 説明 | 引数 |
|-------------|------|------|
| `list` | タスク一覧表示 | `<spec-id>` |
| `start` | タスク開始 | `<issue-number>` |
| `update` | タスクステータス更新 | `<spec-id> <task-number> <status>` |
| `done` | タスク完了 | `<issue-number>` |

## 使用例

```bash
/cft:task list dd4f5124
/cft:task start 123
/cft:task update f6621295 3 completed
/cft:task done 123
```

---

## 自動実行フロー

### Step 1: サブコマンドの解析

| 入力 | サブコマンド |
|------|-------------|
| `list`, `l`, `ls` | list |
| `start`, `s` | start |
| `update`, `u`, `up` | update |
| `done`, `d`, `complete` | done |

---

## サブコマンド: list

仕様書のタスクリストと GitHub Sub Issue を表示します。

### 引数

- `$2` (必須): 仕様書 ID（部分一致可、最低 8 文字）

### 実行フロー

#### Step L1: 仕様書解決

Glob + Read で仕様書ファイルを特定し、YAML フロントマターを解析。

#### Step L2: タスクリスト抽出

仕様書の「## 8. 実装タスクリスト」セクションを解析:

- `- [x]` → 完了タスク
- `- [ ]` → 未完了タスク
- `(#XXX)` → Sub Issue 番号

#### Step L3: Sub Issue 情報取得（github_issue_number がある場合）

```bash
gh issue view $GITHUB_ISSUE_NUMBER --json subIssues -q '.subIssues[] | "\(.number)|\(.title)|\(.state)"'
```

#### Step L4: 結果表示

```
# タスク一覧: $SPEC_NAME

親 Issue: #$GITHUB_ISSUE_NUMBER

## タスクリスト

| # | 状態 | タスク | Sub Issue |
|---|------|--------|-----------|
| 1 | ✓ | タスク1 | #XX (closed) |
| 2 | → | タスク2 | #YY (open) |
| 3 |   | タスク3 | #ZZ (open) |

## 進捗サマリー

完了: X / Y (XX%)

次のアクション:
- タスク開始: /cft:task start <issue-number>
- タスク完了: /cft:task done <issue-number>
```

---

## サブコマンド: start

Sub Issue をアサインし、Projects ステータスを更新します。

### 引数

- `$2` (必須): Sub Issue の番号

### 実行フロー

#### Step S1: Issue 情報取得

```bash
gh issue view $2 --json number,title,state
```

#### Step S2: アサイン

```bash
gh issue edit $2 --add-assignee @me
```

#### Step S3: ステータス更新（gh CLI で Projects 更新）

```bash
# Projects のステータスを In Progress に更新
gh issue edit $2 --add-label "status:in-progress" 2>/dev/null || true
```

#### Step S4: 結果表示

```
✓ タスクを開始しました

Issue: #$2 - $TITLE
アサイン: @me
ステータス: In Progress

次のアクション:
- 実装を進める
- 完了時: /cft:task done $2
```

---

## サブコマンド: update

仕様書内のタスクステータスを更新します。

### 引数

- `$2` (必須): 仕様書 ID
- `$3` (必須): タスク番号
- `$4` (必須): 新しいステータス (pending/in_progress/completed)

### ステータス値

| 入力 | 正規化後 |
|------|----------|
| pending, p, todo | pending |
| in_progress, ip, wip | in_progress |
| completed, done, c, d | completed |

### 実行フロー

#### Step U1: 仕様書解決

Glob + Read で仕様書ファイルを特定。

#### Step U2: タスク特定

「## 8. 実装タスクリスト」セクションから `$3` 番目のタスクを特定。

#### Step U3: 仕様書更新

Edit ツールでチェックボックスを更新:

- completed: `- [ ]` → `- [x]`
- pending/in_progress: `- [x]` → `- [ ]`

#### Step U4: 自動コミット

```bash
git add "$SPEC_PATH" && git commit -m "chore: タスク #$3 を $4 に更新"
```

#### Step U5: 結果表示

```
✓ タスクステータスを更新しました

仕様書: $SPEC_NAME
タスク #$3: $TASK_CONTENT
ステータス: $OLD → $NEW

進捗: X/Y (XX%)
```

---

## サブコマンド: done

Sub Issue をクローズし、Projects ステータスを更新します。

### 引数

- `$2` (必須): Sub Issue の番号

### 実行フロー

#### Step D1: Issue 情報取得

```bash
gh issue view $2 --json number,title,state
```

#### Step D2: Issue クローズ

```bash
gh issue close $2 --comment "✅ タスク完了"
```

#### Step D3: ステータス更新

```bash
gh issue edit $2 --remove-label "status:in-progress" --add-label "status:done" 2>/dev/null || true
```

#### Step D4: 結果表示

```
✓ タスクを完了しました

Issue: #$2 - $TITLE
ステータス: Done (Closed)

次のアクション:
- 次のタスクを開始: /cft:task start <issue-number>
- タスク一覧: /cft:task list <spec-id>
```

---

## エラーハンドリング

### 仕様書が見つからない

```
❌ 仕様書が見つかりません: $SPEC_ID

確認事項:
- 仕様書 ID は最低 8 文字必要です
- /cft:spec list で一覧を確認
```

### Issue が見つからない

```
❌ Issue #$2 が見つかりません

確認事項:
- Issue 番号が正しいか
- gh auth status で認証を確認
```

### gh CLI が利用できない

```
❌ gh CLI が見つかりません

インストール方法:
- macOS: brew install gh
- Linux: https://github.com/cli/cli#installation
- 認証: gh auth login
```
