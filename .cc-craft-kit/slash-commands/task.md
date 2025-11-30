---
description: "タスク管理コマンド（一覧/開始/更新/完了/分割/レポート）"
argument-hint: "<subcommand> [args...]"
---

# タスク管理

タスク（Sub Issue）の管理を行う統合コマンドです。

## サブコマンド

| サブコマンド | 説明 | 引数 |
|-------------|------|------|
| `list` | Sub Issue 一覧表示 | `<spec-id>` |
| `start` | タスク開始（アサイン＆ブランチ作成） | `<issue-number>` |
| `update` | タスクステータス更新 | `<spec-id> <task-number> <status>` |
| `done` | タスク完了（クローズ＆PR作成） | `<issue-number>` |
| `split` | タスク分割 | `<spec-id> <task-number>` |
| `report` | テスト結果レポート | `[spec-id]` |

## 使用例

```bash
# タスク一覧
/cft:task list dd4f5124

# タスク開始
/cft:task start 123

# タスクステータス更新
/cft:task update f6621295 3 completed

# タスク完了
/cft:task done 123

# タスク分割
/cft:task split f6621295 3

# テストレポート
/cft:task report f6621295
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: サブコマンドの解析

`$1` を解析し、以下のいずれかに分岐:

| 入力 | サブコマンド |
|------|-------------|
| `list`, `l`, `ls` | list |
| `start`, `s` | start |
| `update`, `u`, `up` | update |
| `done`, `d`, `complete`, `finish` | done |
| `split`, `sp` | split |
| `report`, `r`, `test` | report |

サブコマンドが指定されていない場合:

```
❌ サブコマンドを指定してください

使用可能なサブコマンド:
- list <spec-id>: Sub Issue 一覧表示
- start <issue-number>: タスク開始
- update <spec-id> <task-number> <status>: ステータス更新
- done <issue-number>: タスク完了
- split <spec-id> <task-number>: タスク分割
- report [spec-id]: テストレポート

使用例:
/cft:task list dd4f5124
/cft:task start 123
```

処理を中断。

---

## サブコマンド: list

Sub Issue の一覧と進捗を表示します。

### 引数

- `$2` (必須): 仕様書 ID（部分一致可、最低 8 文字）

### 実行フロー

#### Step L1: 仕様書 ID の解決

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/spec/resolve-id.ts "$2"
```

出力（JSON）を解析し、以下を記録:

- `SPEC_ID`: 完全な仕様書 ID (`spec.id`)
- `SPEC_NAME`: 仕様書名 (`spec.name`)
- `GITHUB_ISSUE_NUMBER`: GitHub Issue 番号 (`spec.github_issue_number`)

エラーの場合（`success: false`）:

- エラーメッセージを表示して処理を中断

#### Step L2: GitHub Issue の確認

`GITHUB_ISSUE_NUMBER` が null の場合:

```
⚠️ この仕様書には GitHub Issue が紐づいていません。

GitHub Issue を作成してください:
  /cft:github-issue-create $SPEC_ID
```

処理を中断。

#### Step L3: Sub Issue 一覧の取得

Bash ツールで以下を実行（gh CLI を使用）:

```bash
gh issue view $GITHUB_ISSUE_NUMBER --json title,state,body,subIssues --repo "$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')"
```

出力を解析し、`subIssues` 配列を取得。

#### Step L4: 結果の表示

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

- タスクを開始: /cft:task start <issue-number>
- タスクを完了: /cft:task done <issue-number>
- 仕様書詳細: /cft:spec-get $SPEC_ID
```

#### Step L5: Sub Issue がない場合

```
ℹ️ Sub Issue はまだ作成されていません。

仕様書の「## 8. 実装タスクリスト」セクションを確認し、
design フェーズへ移行するか、手動で Sub Issue を作成してください。

推奨アクション:
- design フェーズへ移行: /cft:spec-phase $SPEC_ID design
- 手動で Sub Issue 作成: gh issue create --title "タスク名" ...
```

---

## サブコマンド: start

Sub Issue をアサインし、作業用ブランチを作成します。

### 引数

- `$2` (必須): Sub Issue の番号（例: `123`）

### 実行フロー

#### Step S1: 引数の検証

`$2` が数値でない場合:

```
❌ Issue 番号は数値で指定してください

使用例: /cft:task start 123
```

処理を中断。

#### Step S2: リポジトリ情報の取得

Bash ツールで以下を実行:

```bash
git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/'
```

出力を `REPO` として記録（例: `owner/repo`）。

#### Step S3: Issue 情報の取得

Bash ツールで以下を実行:

```bash
gh issue view $2 --json number,title,state,assignees --repo "$REPO"
```

出力を解析し、以下を記録:

- `ISSUE_NUMBER`: Issue 番号
- `ISSUE_TITLE`: Issue タイトル
- `ISSUE_STATE`: Issue ステータス（open/closed）
- `ASSIGNEES`: アサイン済みユーザー

#### Step S4: ステータス確認

`ISSUE_STATE` が `closed` の場合:

```
⚠️ Issue #$ISSUE_NUMBER は既にクローズされています

再開する場合:
  gh issue reopen $ISSUE_NUMBER --repo "$REPO"
```

処理を中断。

#### Step S5: 現在のブランチを保存

Bash ツールで以下を実行:

```bash
git branch --show-current
```

出力を `ORIGINAL_BRANCH` として記録。

#### Step S6: 作業ブランチの作成

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

#### Step S7: Issue のアサイン

Bash ツールで以下を実行:

```bash
gh issue edit $ISSUE_NUMBER --add-assignee @me --repo "$REPO"
```

#### Step S8: 結果の表示

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
3. 完了時: /cft:task done $ISSUE_NUMBER

## 便利なコマンド

- 差分確認: git diff
- ステータス: git status
- Issue 確認: gh issue view $ISSUE_NUMBER
```

---

## サブコマンド: update

仕様書内のタスクステータスを更新します。

### 引数

- `$2` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$3` (必須): タスク番号（1 から始まる番号）または タスク内容の一部（部分一致）
- `$4` (必須): 新しいステータス

### ステータス値

| 入力 | 正規化後 | 意味 |
|------|----------|------|
| pending, p, todo | pending | 未着手 |
| in_progress, ip, wip, doing | in_progress | 進行中 |
| completed, done, c, d | completed | 完了 |

### 実行フロー

#### Step U1: 引数の検証

1. `$2` が指定されていない場合:
   ```
   ❌ 仕様書 ID を指定してください

   使用例: /cft:task update <spec-id> <task-number> <status>
   ```
   処理を中断。

2. `$3` が指定されていない場合:
   ```
   ❌ タスク番号またはタスク内容を指定してください

   使用例: /cft:task update f6621295 3 completed
   ```
   処理を中断。

3. `$4` が指定されていない場合:
   ```
   ❌ 新しいステータスを指定してください

   有効なステータス:
   - pending (p, todo): 未着手
   - in_progress (ip, wip, doing): 進行中
   - completed (done, c, d): 完了
   ```
   処理を中断。

#### Step U2: ステータスの正規化

`$4` を以下のマッピングに従って正規化:

```
pending, p, todo → pending
in_progress, ip, wip, doing → in_progress
completed, done, c, d → completed
```

正規化後のステータスを `NEW_STATUS` として記録。

#### Step U3: 仕様書 ID の解決

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/spec/resolve-id.ts "$2"
```

出力（JSON）を解析し、以下を記録:
- `SPEC_ID`: 完全な仕様書 ID
- `SPEC_NAME`: 仕様書名
- `SPEC_PATH`: 仕様書ファイルパス

#### Step U4: タスクの特定

Read ツールで仕様書ファイル（`SPEC_PATH`）を読み込み:

1. 「## 8. 実装タスクリスト」セクションを抽出
2. チェックボックス形式（`- [ ]` または `- [x]`）のタスクを解析
3. 各タスクに番号（1 から）を割り当て
4. `$3` が数値の場合は指定番号、文字列の場合は部分一致検索

#### Step U5: 仕様書ファイルの更新

Edit ツールで仕様書ファイルを更新:

- completed に変更: `- [ ]` → `- [x]`
- pending/in_progress に変更: `- [x]` → `- [ ]`

#### Step U6: 自動コミット

Bash ツールで以下を実行:

```bash
git add "$SPEC_PATH" && git commit -m "chore: タスク #{TASK_NUMBER} を {NEW_STATUS} に更新"
```

#### Step U7: 結果の表示

```markdown
# タスクステータス更新

## 更新内容

- **仕様書**: {SPEC_NAME}
- **タスク #{TASK_NUMBER}**: {TASK_CONTENT}
- **ステータス**: {CURRENT_STATUS} → {NEW_STATUS}

## タスク進捗

[████████░░░░░░░░░░░░] {完了率}% ({完了数}/{総数} タスク完了)

## 次のアクション

- タスク一覧を確認: /cft:task list {SPEC_ID}
```

---

## サブコマンド: done

Sub Issue をクローズし、必要に応じて Pull Request を作成します。

### 引数

- `$2` (必須): Sub Issue の番号（例: `123`）
- `--no-pr` (任意): PR を作成しない
- `--draft` (任意): ドラフト PR を作成

### 実行フロー

#### Step D1: 引数の検証

`$2` が数値でない場合:

```
❌ Issue 番号は数値で指定してください

使用例: /cft:task done 123
```

処理を中断。

#### Step D2: リポジトリ情報の取得

Bash ツールで以下を実行:

```bash
git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/'
```

#### Step D3: Issue 情報の取得

Bash ツールで以下を実行:

```bash
gh issue view $2 --json number,title,state,body --repo "$REPO"
```

#### Step D4: ステータス確認

`ISSUE_STATE` が `closed` の場合:

```
ℹ️ Issue #$ISSUE_NUMBER は既にクローズされています
```

処理を中断。

#### Step D5: 未コミットの変更を確認

Bash ツールで以下を実行:

```bash
git status --porcelain
```

出力がある場合:

```
⚠️ コミットされていない変更があります

以下の変更をコミットしてから再実行してください:
[git status の出力]
```

処理を中断。

#### Step D6: テスト自動実行

変更ファイルを特定し、関連テストを実行:

```bash
git diff --name-only HEAD~5 | grep -E '\.(ts|tsx|js|jsx)$' | head -10
```

対応するテストファイルが存在する場合、テストを実行。
テスト失敗時は AskUserQuestion で続行/中断を確認。

#### Step D7: リモートへのプッシュ

Bash ツールで以下を実行:

```bash
git push -u origin $(git branch --show-current)
```

#### Step D8: Pull Request の作成

`--no-pr` フラグがない場合、PR を作成:

```bash
gh pr create --title "$ISSUE_TITLE" --body "Closes #$ISSUE_NUMBER" --repo "$REPO"
```

`--draft` フラグがある場合は `--draft` オプションを追加。

#### Step D9: Issue のクローズ

Bash ツールで以下を実行:

```bash
gh issue close $ISSUE_NUMBER --repo "$REPO" --comment "Completed in $PR_URL"
```

#### Step D10: イベント発火

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/task/done.ts $ISSUE_NUMBER
```

#### Step D11: 結果の表示

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

- タスク一覧: /cft:task list <spec-id>
- 次のタスクを開始: /cft:task start <issue-number>
```

---

## サブコマンド: split

大きなタスクを小さな実装可能な単位に分割します。

### 引数

- `$2` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$3` (必須): 分割対象のタスク番号

### 実行フロー

#### Step SP1: 引数の検証

1. `$2` が指定されていない場合:
   ```
   ❌ 仕様書 ID を指定してください

   使用例: /cft:task split <spec-id> <task-number>
   ```
   処理を中断。

2. `$3` が指定されていないか数値でない場合:
   ```
   ❌ タスク番号（数値）を指定してください

   タスク一覧を確認:
   /cft:task list $2
   ```
   処理を中断。

#### Step SP2: 仕様書 ID の解決

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/spec/resolve-id.ts "$2"
```

#### Step SP3: 対象タスクの特定

Read ツールで仕様書ファイルを読み込み、`$3` 番目のタスクを特定。

#### Step SP4: コードベース解析

Task ツールで Explore サブエージェント（thoroughness: "medium"）を実行:

```
タスク「{TARGET_TASK_CONTENT}」を小さな実装単位に分割するため、以下を解析してください:

## 解析対象
- 仕様書の設計詳細セクション
- 関連するコードファイル

## 出力形式
以下の形式でサブタスクを提案:
1. [サブタスク1]: 具体的な実装内容（見積: X時間）
2. [サブタスク2]: 具体的な実装内容（見積: X時間）
```

#### Step SP5: 分割案の提示と確認

AskUserQuestion ツールで分割案を確認:

- **承認**: 分割を適用
- **修正**: 分割内容を調整
- **キャンセル**: 分割を中止

#### Step SP6: 仕様書の更新

Edit ツールで仕様書ファイルを更新し、元タスクをサブタスクに置換。

#### Step SP7: 自動コミット

Bash ツールで以下を実行:

```bash
git add "$SPEC_PATH" && git commit -m "refactor: タスク #{TARGET_TASK_NUMBER} を {サブタスク数} 個に分割"
```

#### Step SP8: 結果の表示

```markdown
# タスク分割完了

## 分割結果

### 元のタスク
#{TARGET_TASK_NUMBER}: {TARGET_TASK_CONTENT}

### 分割後のサブタスク
{サブタスク数} 個のサブタスクに分割しました

## 次のアクション

- タスク一覧を確認: /cft:task list {SPEC_ID}
- 最初のサブタスクを開始: /cft:task start <issue-number>
```

---

## サブコマンド: report

テストを実行し、結果を GitHub Issue にレポートとして記録します。

### 引数

- `$2` (任意): 仕様書 ID（部分一致可、最低 8 文字）
  - 省略した場合: 現在のブランチに紐づく仕様書を自動検出

### 実行フロー

#### Step R1: 仕様書の特定

`$2` が指定されている場合は仕様書を解決、省略時は現在のブランチから自動検出。

#### Step R2: テスト実行

Bash ツールで以下を実行:

```bash
npm test -- --passWithNoTests --json --outputFile=.cc-craft-kit/test-results.json 2>&1
```

#### Step R3: テスト結果の解析

`.cc-craft-kit/test-results.json` を読み込み、結果を解析。

#### Step R4: カバレッジ取得（任意）

```bash
npm test -- --coverage --coverageReporters=json-summary --passWithNoTests 2>&1 || true
```

#### Step R5: レポート生成

```markdown
## テスト結果レポート

**実行日時**: {現在日時}

### サマリー

| 項目 | 件数 |
|------|-----:|
| 成功 | {PASSED_TESTS} |
| 失敗 | {FAILED_TESTS} |
| スキップ | {PENDING_TESTS} |
| **合計** | **{TOTAL_TESTS}** |

### カバレッジ

| 種別 | カバレッジ |
|------|----------:|
| 行 | {LINE_COVERAGE}% |
| 関数 | {FUNCTION_COVERAGE}% |
| 分岐 | {BRANCH_COVERAGE}% |
```

#### Step R6: GitHub Issue への記録

`GITHUB_ISSUE_NUMBER` が存在する場合、gh CLI でコメント追加。

#### Step R7: 結果の表示

```markdown
# テストレポート

{レポート内容}

## 次のステップ

{失敗がある場合}
- 失敗したテストを修正してください

{カバレッジが低い場合}
- テスト生成: /cft:test-generate <file-pattern>

{成功の場合}
- タスク完了: /cft:task done <issue-number>
```

---

## エラーハンドリング

### 仕様書が見つからない場合

```
❌ 仕様書が見つかりません: $SPEC_ID

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

### Issue が見つからない場合

```
❌ Issue #$ISSUE_NUMBER が見つかりません

確認事項:
- Issue 番号が正しいか確認してください
- gh auth status で認証状態を確認してください
```
