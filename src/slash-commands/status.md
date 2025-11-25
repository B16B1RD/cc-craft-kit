---
description: "プロジェクトの現在の状況を表示します"
---

# プロジェクト状況

cc-craft-kit プロジェクトの現在の状況を表示します。

## 使用例

```bash
/cft:status
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: プロジェクト情報の取得

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/status/info.ts
```

出力（JSON）を解析し、以下の情報を記録:

- `project`: プロジェクト情報
- `github`: GitHub 連携情報
- `specs`: 仕様書情報
- `logs`: ログ情報

エラーの場合は、エラーメッセージを表示して処理を中断。

### Step 2: GitHub 連携状態の確認

`github.configured` が `true` の場合、Bash ツールで以下を実行して追加情報を取得:

```bash
gh repo view {github.owner}/{github.repo} --json name,description,url --jq '.name + " (" + .url + ")"' 2>/dev/null || echo "GitHub CLI not configured"
```

### Step 3: DB 整合性チェック

Skill ツールで `database-schema-validator` スキルを実行し、DB 整合性を確認。

警告がある場合は、警告メッセージを記録。

### Step 4: 結果の表示

以下のフォーマットで結果を表示してください。

---

## 出力フォーマット

```markdown
# プロジェクト状況

## プロジェクト情報

- **名前**: {project.name}
- **ディレクトリ**: {project.directory}
- **初期化日時**: {project.initialized_at を日本語形式で表示}

## GitHub 連携

{github.configured が true の場合}
- **リポジトリ**: {github.owner}/{github.repo}
- **プロジェクト番号**: #{github.project_number} (未設定の場合は "未設定")
- **認証状態**: GITHUB_TOKEN が設定されていれば ✓ 設定済み、なければ ✗ 未設定

{github.configured が false の場合}
ℹ️ GitHub 連携は未設定です。設定するには: `/cft:github-init <owner> <repo>`

## 仕様書状況

**合計**: {specs.total} 件

| フェーズ | 件数 |
|---|---:|
| requirements | {specs.byPhase.requirements} |
| design | {specs.byPhase.design} |
| tasks | {specs.byPhase.tasks} |
| implementation | {specs.byPhase.implementation} |
| testing | {specs.byPhase.testing} |
| completed | {specs.byPhase.completed} |

{specs.withoutIssue が 1 件以上の場合}
### Issue 未作成の仕様書

| ID | 名前 | フェーズ |
|---|---|---|
{specs.withoutIssue の各仕様書を表形式で表示（最大 5 件）}

ヒント: `/cft:github-issue-create <spec-id>` で Issue を作成できます。

{specs.recent が 1 件以上の場合}
## 最近の仕様書

| ID | 名前 | フェーズ | GitHub |
|---|---|---|---|
{specs.recent の各仕様書を表形式で表示}
- ID は最初の 8 文字 + "..."
- GitHub は Issue 番号があれば "#番号"、なければ "-"
- PR があれば " (PR #番号)" を追加

{logs.errors が 1 件以上の場合}
## 最近のエラー/警告

| 時刻 | レベル | メッセージ |
|---|---|---|
{logs.errors の各ログを表形式で表示（最大 5 件）}
- 時刻は HH:mm:ss 形式
- メッセージは 60 文字で切り捨て

{logs.recent が 1 件以上の場合}
## 最近のアクティビティ

| 時刻 | レベル | メッセージ |
|---|---|---|
{logs.recent の各ログを表形式で表示}
- 時刻は HH:mm:ss 形式
- メッセージは 60 文字で切り捨て

## 次のアクション

{specs.total が 0 の場合}
- 最初の仕様書を作成: `/cft:spec-create "<name>"`

{github.configured が false の場合}
- GitHub 連携を設定: `/cft:github-init <owner> <repo>`

{specs.withoutIssue が 1 件以上の場合}
- Issue 未作成の仕様書があります。Issue を作成してください: `/cft:github-issue-create <spec-id>`

{specs.byPhase.implementation が 1 件以上の場合}
- 実装中の仕様書があります: `/cft:spec-list implementation`

{上記以外の場合}
- 仕様書一覧を表示: `/cft:spec-list`
- 新しい仕様書を作成: `/cft:spec-create "<name>"`
```

---

## エラーハンドリング

### プロジェクトが初期化されていない場合

```
❌ プロジェクトが初期化されていません

cc-craft-kit を使用するには、まずプロジェクトを初期化してください:

/cft:init <project-name>
```

### JSON パースエラーの場合

```
❌ ステータス情報の取得に失敗しました

エラー: {エラーメッセージ}

対処法:
1. データベースの状態を確認: `npx tsx .cc-craft-kit/scripts/repair-database.ts`
2. 設定ファイルを確認: `.cc-craft-kit/config.json`
```
