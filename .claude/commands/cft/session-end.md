---
description: "セッション終了プロトコルを実行します"
argument-hint: "[spec-id]"
---

# セッション終了

Claude 4 / Long-running Agents のベストプラクティスに基づくセッション終了プロトコルを実行します。
現在の作業状態を保存し、次回セッションへの引継ぎ情報を記録します。

## 引数

- `$1` (任意): 仕様書 ID（部分一致可、最低 8 文字）
  - 省略した場合: 現在のブランチに紐づく仕様書を自動検出

## 使用例

```bash
# 仕様書 ID を指定して終了
/cft:session-end f6621295

# 現在のブランチから自動検出
/cft:session-end
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: 仕様書の特定

`/cft:session-start` の Step 2 と同様の方法で仕様書を特定。

結果を記録:
- `SPEC_ID`: 仕様書 ID
- `SPEC_NAME`: 仕様書名
- `SPEC_PHASE`: 現在のフェーズ
- `SPEC_BRANCH`: 関連ブランチ
- `SPEC_PATH`: 仕様書ファイルパス
- `GITHUB_ISSUE_NUMBER`: GitHub Issue 番号

仕様書が見つからない場合:
```
ℹ️ アクティブな仕様書が見つかりません

セッション情報を保存できませんが、一般的な終了処理を実行します。
```
Step 2.5 へスキップ。

### Step 2: 進捗ファイルの読み込み

Read ツールで進捗ファイルを読み込み:

```
.cc-craft-kit/session/specs/<SPEC_ID>.json
```

存在しない場合は新規作成として扱う。

### Step 2.5: 未コミット変更の確認

Bash ツールで以下を実行:

```bash
git status --porcelain
```

結果を `GIT_STATUS` として記録。

#### 未コミット変更がある場合

```
⚠️ コミットされていない変更があります

[git status の出力]

推奨アクション:
1. 変更をコミット:
   git add .
   git commit -m "wip: 作業中の変更を保存"

2. 変更をスタッシュ:
   git stash push -m "session-end: 作業中の変更"

3. 変更を破棄:
   git restore .
```

AskUserQuestion ツールで確認:
- **コミット**: 変更をコミットしてセッションを終了
- **スタッシュ**: 変更をスタッシュしてセッションを終了
- **そのまま終了**: 変更を残したままセッションを終了
- **中断**: セッション終了を中断

選択に応じて処理を実行。

### Step 3: 型チェック・テスト実行

Bash ツールで以下を並列実行:

```bash
# 型チェック
npm run typecheck 2>&1 || echo "TYPE_ERROR"

# テスト（失敗しても継続）
npm test -- --passWithNoTests 2>&1 || echo "TEST_ERROR"
```

結果を記録:
- `TYPE_CHECK_RESULT`: 型チェック結果（成功/失敗）
- `TEST_RESULT`: テスト結果（成功/失敗/スキップ）

### Step 4: 進捗状態の収集

#### 4.1 変更ファイルの収集

Bash ツールで以下を実行:

```bash
# 今回セッションで変更されたファイル
git diff --name-only HEAD~10 2>/dev/null || git diff --name-only HEAD
```

結果を `CHANGED_FILES` として記録。

#### 4.2 タスク進捗の収集

Read ツールで仕様書ファイル（`SPEC_PATH`）を読み込み:

1. 「## 8. 実装タスクリスト」セクションを解析
2. チェックボックスの状態を集計:
   - 完了タスク（`- [x]`）
   - 未完了タスク（`- [ ]`）
   - 進行中タスク（最初の未完了タスク）

#### 4.3 セッションサマリーの生成

収集した情報に基づき、AskUserQuestion ツールでセッションサマリーを確認:

```
セッションサマリーを入力してください（任意）:

自動生成案:
- 完了したタスク: [完了タスク数] 件
- 変更ファイル: [CHANGED_FILES の主要ファイル]
- 次のタスク: [進行中または次のタスク]

入力がない場合は自動生成案を使用します。
```

### Step 5: GitHub Issue への記録

`GITHUB_ISSUE_NUMBER` が存在する場合、Bash ツールで以下を実行:

```bash
# リポジトリ情報取得
REPO=$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')

# セッション終了サマリーをコメントとして追加
npx tsx .cc-craft-kit/commands/knowledge/progress.ts "$SPEC_ID" "セッション終了サマリー: $SESSION_SUMMARY"
```

### Step 5.5: ワークフロー状態の保存

フェーズが `implementation` の場合、Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/workflow/save-state.ts \
  --spec-id "$SPEC_ID" \
  --task-number "{現在進行中のタスク番号}" \
  --task-title "{現在進行中のタスクタイトル}" \
  --next-action "task_done" \
  --github-issue-number "{Sub Issue 番号（存在する場合）}"
```

**注意**:
- `--next-action` は以下のいずれかを指定:
  - `task_start`: タスクが開始前の場合
  - `task_done`: タスクが進行中の場合
  - `none`: 特定のアクションが不要な場合
- `--github-issue-number` は Sub Issue 番号で、親 Issue の番号ではない

保存成功時:
```
✓ ワークフロー状態を保存しました
  - 仕様書: {SPEC_NAME}
  - タスク: {タスク番号}. {タスクタイトル}
  - 次のアクション: {next_action}
```

これにより、セッション再開時に自動的にワークフロー状態が復元されます。

### Step 6: 進捗ファイルの更新

Write ツールで進捗ファイルを更新:

```json
{
  "version": "1.0.0",
  "specId": "{SPEC_ID}",
  "specName": "{SPEC_NAME}",
  "lastUpdated": "{現在日時（ISO 8601形式）}",
  "phase": "{SPEC_PHASE}",
  "branch": "{SPEC_BRANCH}",
  "tasks": [
    // 更新されたタスク一覧
    {
      "id": 1,
      "content": "タスク内容",
      "status": "completed",
      "completedAt": "..."
    },
    {
      "id": 2,
      "content": "現在のタスク",
      "status": "in_progress",
      "startedAt": "..."
    }
  ],
  "context": {
    "lastEditedFiles": [/* CHANGED_FILES */],
    "pendingIssues": [/* TYPE_CHECK や TEST の問題 */],
    "notes": "{SESSION_SUMMARY}"
  },
  "sessions": [
    // 既存のセッション履歴
    ...,
    {
      "startedAt": "{開始時刻}",
      "endedAt": "{現在日時}",
      "summary": "{SESSION_SUMMARY}"
    }
  ]
}
```

### Step 7: 結果の表示

以下のフォーマットで結果を表示:

```markdown
# セッション終了

## 仕様書情報

- **名前**: {SPEC_NAME}
- **ID**: {SPEC_ID}
- **フェーズ**: {SPEC_PHASE}

## セッションサマリー

{SESSION_SUMMARY}

## タスク進捗

```
[████████░░░░░░░░░░░░] {完了率}% ({完了数}/{総数} タスク完了)
```

### 完了したタスク（今回セッション）
{今回完了したタスクを箇条書きで表示}

### 次回の作業
{進行中または次のタスクを表示}

## コード状態

### 変更ファイル
{CHANGED_FILES を箇条書きで表示（最大 10 件）}

### 型チェック
{TYPE_CHECK_RESULT}

### テスト
{TEST_RESULT}

{pendingIssues がある場合}
### 未解決の問題
{pendingIssues を箇条書きで表示}

## GitHub Issue

{GITHUB_ISSUE_NUMBER が存在する場合}
✓ セッションサマリーを Issue #GITHUB_ISSUE_NUMBER に記録しました

{GITHUB_ISSUE_NUMBER が存在しない場合}
ℹ️ GitHub Issue が設定されていないため、サマリーはローカルのみに保存されました

## 次回セッション開始

次回作業を再開するには:
```bash
/cft:session-start {SPEC_ID}
```

または、ブランチ `{SPEC_BRANCH}` に切り替えてから:
```bash
/cft:session-start
```
```

---

## エラーハンドリング

### 進捗ファイルの書き込みに失敗した場合

```
⚠️ 進捗ファイルの保存に失敗しました

エラー: [エラーメッセージ]

対処法:
- ディレクトリが存在するか確認: mkdir -p .cc-craft-kit/session/specs
- 書き込み権限を確認
```

### gh CLI が利用できない場合

```
⚠️ gh CLI が見つかりません

GitHub Issue へのサマリー記録をスキップしました。
進捗はローカルの進捗ファイルに保存されています。
```

### 型チェック・テストに失敗した場合

```
⚠️ コード品質チェックで問題が検出されました

型チェック: {成功/失敗}
テスト: {成功/失敗}

これらの問題は次回セッションで対処が必要です。
問題点は進捗ファイルの pendingIssues に記録されました。
```

---

## 参考: Long-running Agents ベストプラクティス

このコマンドは以下のベストプラクティスに基づいています:

1. **クリーンな引き継ぎ基準**: マージ可能な品質維持、記述的コミットメッセージ
2. **進捗保存**: コンテキスト更新前に現在の進捗と状態を保存
3. **構造化セッションサマリー**: GitHub Issue への構造化記録

参照:
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices
- https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
