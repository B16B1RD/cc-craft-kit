---
description: "セッション開始プロトコルを実行します"
argument-hint: "[spec-id]"
---

# セッション開始

Claude 4 / Long-running Agents のベストプラクティスに基づくセッション開始プロトコルを実行します。
前回セッションの状態を復元し、効率的に作業を再開できる環境を整えます。

## 引数

- `$1` (任意): 仕様書 ID（部分一致可、最低 8 文字）
  - 省略した場合: 現在のブランチに紐づく仕様書を自動検出

## 使用例

```bash
# 仕様書 ID を指定して開始
/cft:session-start f6621295

# 現在のブランチから自動検出
/cft:session-start
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: 環境情報の収集

Bash ツールで以下を並列実行:

```bash
# 現在のディレクトリ
pwd

# 現在のブランチ
git branch --show-current

# Git ステータス
git status --porcelain

# 最近のコミット（5件）
git log --oneline -5
```

結果を記録:
- `CURRENT_DIR`: 現在のディレクトリ
- `CURRENT_BRANCH`: 現在のブランチ
- `GIT_STATUS`: 未コミット変更の有無
- `RECENT_COMMITS`: 最近のコミット一覧

### Step 2: 仕様書の特定

#### `$1` が指定されている場合

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/spec/resolve-id.ts "$1"
```

出力（JSON）を解析し、以下を記録:
- `SPEC_ID`: 仕様書 ID
- `SPEC_NAME`: 仕様書名
- `SPEC_PHASE`: 現在のフェーズ
- `SPEC_BRANCH`: 関連ブランチ
- `SPEC_PATH`: 仕様書ファイルパス
- `GITHUB_ISSUE_NUMBER`: GitHub Issue 番号

#### `$1` が省略された場合

1. `CURRENT_BRANCH` が `feature/spec-*` 形式の場合:
   - ブランチ名から spec-id を抽出（`feature/spec-XXXXXXXX-*` → `XXXXXXXX`）
   - 上記の resolve-id.ts で仕様書情報を取得

2. それ以外の場合:
   - Bash ツールで以下を実行:
   ```bash
   npx tsx .cc-craft-kit/commands/status/info.ts
   ```
   - `specs.recent` から implementation フェーズの仕様書を優先的に選択
   - 該当なしの場合、最新の仕様書を選択

仕様書が見つからない場合:
```
ℹ️ アクティブな仕様書が見つかりません

新しいセッションを開始するには:
- 仕様書を作成: /cft:spec-create "<name>"
- 仕様書一覧を確認: /cft:spec-list
```
処理を中断。

### Step 3: 進捗ファイルの読み込み

Read ツールで進捗ファイルを読み込み:

```
.cc-craft-kit/session/specs/<SPEC_ID>.json
```

#### ファイルが存在する場合

JSON を解析し、以下を記録:
- `PREVIOUS_SESSION`: 前回セッション情報
- `TASKS`: タスク一覧と進捗
- `CONTEXT`: コンテキスト情報（編集中ファイル、メモなど）

#### ファイルが存在しない場合

新規セッションとして初期化:
```
ℹ️ 初回セッションです。進捗ファイルを作成します。
```

### Step 3.5: ワークフロー状態の復元

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/workflow/restore-state.ts --json
```

出力（JSON）が存在する場合、以下を記録:
- `WORKFLOW_STATE`: ワークフロー状態情報
  - `specId`: 仕様書 ID
  - `specName`: 仕様書名
  - `currentTaskNumber`: 現在のタスク番号
  - `currentTaskTitle`: タスクタイトル
  - `nextAction`: 次のアクション（`task_start` | `task_done` | `none`）
  - `githubIssueNumber`: Sub Issue 番号（存在する場合）

**重要**: ワークフロー状態が存在し、`nextAction` が `task_start` または `task_done` の場合、Step 8 の「推奨アクション」に該当するコマンドを追加してください。

### Step 4: GitHub Issue の確認

`GITHUB_ISSUE_NUMBER` が存在する場合、Bash ツールで以下を実行:

```bash
# リポジトリ情報取得
REPO=$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')

# Issue の最新コメント（5件）を取得
gh issue view $GITHUB_ISSUE_NUMBER --repo "$REPO" --comments --json comments --jq '.comments | .[-5:] | .[] | "[\(.createdAt | split("T")[0])] \(.body | split("\n")[0])"'
```

結果を `RECENT_COMMENTS` として記録。

### Step 5: ブランチ切り替え（必要な場合）

`SPEC_BRANCH` が `CURRENT_BRANCH` と異なる場合:

```bash
git checkout "$SPEC_BRANCH"
```

切り替え失敗時:
```
⚠️ ブランチの切り替えに失敗しました

原因: [エラーメッセージ]

対処法:
- 未コミット変更がある場合: git stash または git commit
- コンフリクトがある場合: git status で確認
```

### Step 6: 型チェック実行

Skill ツールで `typescript-eslint` スキルを実行。

結果を `LINT_RESULT` として記録:
- エラー数
- 警告数

### Step 7: 仕様書の読み込み

Read ツールで仕様書ファイル（`SPEC_PATH`）を読み込み:

1. 「## 8. 実装タスクリスト」セクションを解析
2. チェックボックスの状態を集計:
   - 完了タスク数（`- [x]`）
   - 未完了タスク数（`- [ ]`）
   - 現在進行中のタスク（最初の未完了タスク）

### Step 8: セッション情報の表示

以下のフォーマットで結果を表示:

```markdown
# セッション開始

## 仕様書情報

- **名前**: {SPEC_NAME}
- **ID**: {SPEC_ID}
- **フェーズ**: {SPEC_PHASE}
- **ブランチ**: {SPEC_BRANCH}
- **GitHub Issue**: #{GITHUB_ISSUE_NUMBER} (存在する場合)

## 前回セッションからの引継ぎ

{PREVIOUS_SESSION が存在する場合}
- **前回終了**: {PREVIOUS_SESSION.endedAt を日本語形式で表示}
- **サマリー**: {PREVIOUS_SESSION.summary}

### コンテキスト情報
{CONTEXT.notes が存在する場合}
{CONTEXT.notes}

{CONTEXT.pendingIssues が存在する場合}
### 未解決の問題
{CONTEXT.pendingIssues を箇条書きで表示}

{CONTEXT.lastEditedFiles が存在する場合}
### 前回編集したファイル
{CONTEXT.lastEditedFiles を箇条書きで表示}

{PREVIOUS_SESSION が存在しない場合}
ℹ️ 初回セッションです

## タスク進捗

```
[████████░░░░░░░░░░░░] {完了率}% ({完了数}/{総数} タスク完了)
```

### 次のタスク
{現在進行中または最初の未完了タスクを表示}

## コードベース状態

{GIT_STATUS が空でない場合}
### 未コミット変更
```
{GIT_STATUS}
```

### 型チェック結果
{LINT_RESULT.errors > 0 の場合}
⚠️ 型エラー: {LINT_RESULT.errors} 件

{LINT_RESULT.warnings > 0 の場合}
⚠️ 警告: {LINT_RESULT.warnings} 件

{LINT_RESULT がクリーンな場合}
✓ 型エラーなし

{RECENT_COMMENTS が存在する場合}
## GitHub Issue の最新コメント

{RECENT_COMMENTS を表示}

## 推奨アクション

{WORKFLOW_STATE が存在し、nextAction が 'task_start' の場合}
⚠️ **前回セッションの継続タスク**:
- タスク開始: `npx tsx .cc-craft-kit/commands/task/start.ts {WORKFLOW_STATE.githubIssueNumber}`
- その後、タスク「{WORKFLOW_STATE.currentTaskTitle}」の実装を続行

{WORKFLOW_STATE が存在し、nextAction が 'task_done' の場合}
⚠️ **前回セッションの継続タスク**:
- タスク「{WORKFLOW_STATE.currentTaskTitle}」の実装が完了している場合:
  `npx tsx .cc-craft-kit/commands/task/done.ts {WORKFLOW_STATE.githubIssueNumber}`
- 実装が未完了の場合、実装を続行してから上記コマンドを実行

{タスクが残っている場合}
1. 次のタスクを開始: `/cft:task-start <issue-number>`
2. タスク一覧を確認: `/cft:task-list {SPEC_ID}`

{GIT_STATUS が空でない場合}
- 未コミット変更をコミットまたはスタッシュ

{LINT_RESULT にエラーがある場合}
- 型エラーを修正: `npm run lint:fix`

{フェーズが implementation の場合}
- 実装を続行
- 完了時: `/cft:task-done <issue-number>`

{フェーズが design の場合}
- 設計を確認: `/cft:spec-get {SPEC_ID}`
- 実装開始: `/cft:spec-phase {SPEC_ID} impl`
```

### Step 9: 進捗ファイルの更新

Write ツールで進捗ファイルを更新（または作成）:

```json
{
  "version": "1.0.0",
  "specId": "{SPEC_ID}",
  "specName": "{SPEC_NAME}",
  "lastUpdated": "{現在日時（ISO 8601形式）}",
  "phase": "{SPEC_PHASE}",
  "branch": "{SPEC_BRANCH}",
  "tasks": [
    // 仕様書から解析したタスク一覧
  ],
  "context": {
    "lastEditedFiles": [],
    "pendingIssues": [],
    "notes": ""
  },
  "sessions": [
    // 既存のセッション履歴を保持
    {
      "startedAt": "{現在日時}",
      "endedAt": null,
      "summary": null
    }
  ]
}
```

---

## エラーハンドリング

### プロジェクトが初期化されていない場合

```
❌ プロジェクトが初期化されていません

cc-craft-kit を使用するには、まずプロジェクトを初期化してください:
/cft:init <project-name>
```

### 仕様書 ID が無効な場合

```
❌ 仕様書が見つかりません: $1

確認事項:
- 仕様書 ID は最低 8 文字必要です
- /cft:spec-list で仕様書一覧を確認してください
```

### Git リポジトリでない場合

```
❌ Git リポジトリが見つかりません

対処法:
- git init でリポジトリを初期化してください
- または、既存の Git リポジトリ内で実行してください
```

### gh CLI が利用できない場合

```
⚠️ gh CLI が見つかりません

GitHub Issue 連携機能は利用できませんが、セッションは開始できます。

gh CLI のインストール:
- macOS: brew install gh
- Ubuntu: sudo apt install gh
- Windows: winget install GitHub.cli
```

---

## 参考: Long-running Agents ベストプラクティス

このコマンドは以下のベストプラクティスに基づいています:

1. **セッション開始プロトコル**: ディレクトリ確認、進捗ファイル読み込み、Git 履歴確認
2. **構造化進捗管理**: JSON 形式の進捗ファイルで状態を管理
3. **コンテキスト復元**: 前回セッションの情報を自動的に復元
4. **品質チェック**: セッション開始時に型チェックを実行

参照:
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices
- https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
