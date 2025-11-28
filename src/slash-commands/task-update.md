---
description: "タスクのステータスを更新します"
argument-hint: "<spec-id> <task-number> <status>"
---

# タスクステータス更新

仕様書内のタスクステータスを更新し、進捗ファイルと GitHub Issue を同期します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$2` (必須): タスク番号（1 から始まる番号）または タスク内容の一部（部分一致）
- `$3` (必須): 新しいステータス

### ステータス値

| 入力 | 正規化後 | 意味 |
|------|----------|------|
| pending, p, todo | pending | 未着手 |
| in_progress, ip, wip, doing | in_progress | 進行中 |
| completed, done, c, d | completed | 完了 |

## 使用例

```bash
# タスク番号で指定
/cft:task-update f6621295 3 completed

# タスク内容の一部で指定
/cft:task-update f6621295 "認証機能" done

# 省略形
/cft:task-update f6621295 3 c
/cft:task-update f6621295 3 ip
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: 引数の検証

1. `$1` が指定されていない場合:
   ```
   ❌ 仕様書 ID を指定してください

   使用例: /cft:task-update <spec-id> <task-number> <status>
   ```
   処理を中断。

2. `$2` が指定されていない場合:
   ```
   ❌ タスク番号またはタスク内容を指定してください

   使用例: /cft:task-update f6621295 3 completed
           /cft:task-update f6621295 "認証機能" done
   ```
   処理を中断。

3. `$3` が指定されていない場合:
   ```
   ❌ 新しいステータスを指定してください

   有効なステータス:
   - pending (p, todo): 未着手
   - in_progress (ip, wip, doing): 進行中
   - completed (done, c, d): 完了
   ```
   処理を中断。

### Step 2: ステータスの正規化

`$3` を以下のマッピングに従って正規化:

```
pending, p, todo → pending
in_progress, ip, wip, doing → in_progress
completed, done, c, d → completed
```

正規化後のステータスを `NEW_STATUS` として記録。

無効なステータスの場合:
```
❌ 無効なステータス: $3

有効なステータス:
- pending (p, todo): 未着手
- in_progress (ip, wip, doing): 進行中
- completed (done, c, d): 完了
```
処理を中断。

### Step 3: 仕様書 ID の解決

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/spec/resolve-id.ts "$1"
```

出力（JSON）を解析し、以下を記録:
- `SPEC_ID`: 完全な仕様書 ID
- `SPEC_NAME`: 仕様書名
- `SPEC_PATH`: 仕様書ファイルパス
- `GITHUB_ISSUE_NUMBER`: GitHub Issue 番号

エラーの場合（`success: false`）:
```
❌ 仕様書が見つかりません: $1

確認事項:
- 仕様書 ID は最低 8 文字必要です
- /cft:spec-list で仕様書一覧を確認してください
```
処理を中断。

### Step 4: タスクの特定

Read ツールで仕様書ファイル（`SPEC_PATH`）を読み込み:

1. 「## 8. 実装タスクリスト」セクションを抽出
2. チェックボックス形式（`- [ ]` または `- [x]`）のタスクを解析
3. 各タスクに番号（1 から）を割り当て

#### `$2` が数値の場合

指定された番号のタスクを選択。

タスクが存在しない場合:
```
❌ タスク番号 $2 が見つかりません

タスク一覧（{総数} 件）:
1. [ステータス] タスク内容1
2. [ステータス] タスク内容2
...
```
処理を中断。

#### `$2` が文字列の場合

タスク内容に `$2` を含むタスクを検索。

複数マッチした場合:
```
⚠️ 複数のタスクがマッチしました

マッチしたタスク:
2. [ステータス] タスク内容A（"$2" を含む）
5. [ステータス] タスク内容B（"$2" を含む）

タスク番号を指定して再実行してください:
/cft:task-update $1 2 $3
```
処理を中断。

マッチしない場合:
```
❌ "$2" を含むタスクが見つかりません

タスク一覧:
/cft:task-list $1
```
処理を中断。

選択されたタスクを記録:
- `TASK_NUMBER`: タスク番号
- `TASK_CONTENT`: タスク内容
- `CURRENT_STATUS`: 現在のステータス（`- [ ]` = pending/in_progress, `- [x]` = completed）

### Step 5: 仕様書ファイルの更新

Edit ツールで仕様書ファイルを更新:

#### completed に変更する場合

```
検索: - [ ] {TASK_CONTENT}
置換: - [x] {TASK_CONTENT}
```

#### pending/in_progress に変更する場合

```
検索: - [x] {TASK_CONTENT}
置換: - [ ] {TASK_CONTENT}
```

> **注意**: マークダウンのチェックボックスは completed と未完了（pending/in_progress）の 2 状態のみ。
> pending と in_progress の区別は進捗ファイルで管理。

### Step 6: 進捗ファイルの更新

Read ツールで進捗ファイルを読み込み:

```
.cc-craft-kit/session/specs/<SPEC_ID>.json
```

ファイルが存在しない場合は新規作成。

Write ツールで進捗ファイルを更新:

```json
{
  "tasks": [
    // 既存タスク...
    {
      "id": {TASK_NUMBER},
      "content": "{TASK_CONTENT}",
      "status": "{NEW_STATUS}",
      "startedAt": "{in_progress の場合、現在日時}",
      "completedAt": "{completed の場合、現在日時}"
    }
  ]
}
```

### Step 7: 自動コミット

Bash ツールで以下を実行:

```bash
git add "$SPEC_PATH" && git commit -m "chore: タスク #{TASK_NUMBER} を {NEW_STATUS} に更新"
```

### Step 8: GitHub Issue 同期（任意）

`GITHUB_ISSUE_NUMBER` が存在する場合:

```
ℹ️ GitHub Issue の同期が必要な場合は以下を実行:
/cft:github-sync to-github $SPEC_ID
```

### Step 9: 結果の表示

```markdown
# タスクステータス更新

## 更新内容

- **仕様書**: {SPEC_NAME}
- **タスク #{TASK_NUMBER}**: {TASK_CONTENT}
- **ステータス**: {CURRENT_STATUS} → {NEW_STATUS}

## タスク進捗

```
[████████░░░░░░░░░░░░] {完了率}% ({完了数}/{総数} タスク完了)
```

## 次のアクション

{NEW_STATUS が completed の場合}
- 次のタスクを開始: `/cft:task-start <issue-number>`
- タスク一覧を確認: `/cft:task-list {SPEC_ID}`

{NEW_STATUS が in_progress の場合}
- タスク完了時: `/cft:task-done <issue-number>`

{NEW_STATUS が pending の場合}
- タスクを再開: `/cft:task-update {SPEC_ID} {TASK_NUMBER} ip`
```

---

## エラーハンドリング

### 仕様書に実装タスクリストがない場合

```
❌ 実装タスクリストが見つかりません

仕様書に「## 8. 実装タスクリスト」セクションがありません。

対処法:
- design フェーズを完了: /cft:spec-phase $SPEC_ID design
- または手動でタスクリストセクションを追加
```

### Git コミットに失敗した場合

```
⚠️ 自動コミットに失敗しました

タスクステータスは更新されましたが、コミットされていません。

手動でコミット:
git add {SPEC_PATH}
git commit -m "chore: タスク更新"
```

---

## 一括更新

複数タスクを一度に更新する場合は、コマンドを複数回実行:

```bash
/cft:task-update f6621295 1 completed
/cft:task-update f6621295 2 completed
/cft:task-update f6621295 3 in_progress
```

または、仕様書ファイルを直接編集してチェックボックスを変更し、同期コマンドを実行:

```bash
/cft:github-sync to-github f6621295
```
