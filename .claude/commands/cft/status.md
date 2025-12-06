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

**重要**: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: 基本情報の取得（並列実行可能）

以下の操作を**並列で**実行:

1. **Read ツール**: `.cc-craft-kit/config.json` を読み込み
   - `name`: プロジェクト名
   - `initialized_at`: 初期化日時
   - `github.owner`: GitHub オーナー
   - `github.repo`: GitHub リポジトリ名

2. **Glob ツール**: `.cc-craft-kit/specs/*.md` でファイル一覧を取得

3. **Bash**: `git branch --show-current` で現在のブランチ名を取得

4. **Bash**: `git for-each-ref --format='%(refname:short)' refs/heads/ | grep 'spec-'` で関連ブランチを取得

ファイルが存在しない場合は、エラーメッセージを表示して処理を中断。

### Step 2: 現在ブランチの仕様書を集計（並列実行可能）

以下の **Grep ツール**操作を**並列で**実行:

| フェーズ | pattern | path | output_mode |
|----------|---------|------|-------------|
| requirements | `^phase: "requirements"$` | `.cc-craft-kit/specs` | files_with_matches |
| design | `^phase: "design"$` | `.cc-craft-kit/specs` | files_with_matches |
| implementation | `^phase: "implementation"$` | `.cc-craft-kit/specs` | files_with_matches |
| review | `^phase: "review"$` | `.cc-craft-kit/specs` | files_with_matches |
| completed | `^phase: "completed"$` | `.cc-craft-kit/specs` | count |

**注意**: 行頭マッチ `^` を使用して YAML フロントマターのみを対象にすること。本文中の誤検出を防止。

### Step 3: 他ブランチの仕様書を取得

Step 1 で取得した `spec-` ブランチのうち、現在のブランチを除いた各ブランチについて:

1. **Bash**: `git ls-tree -r --name-only <branch> .cc-craft-kit/specs/ 2>/dev/null | grep '\.md$'` でファイル一覧取得

2. 各ファイルについて **Bash**: `git show <branch>:<file> 2>/dev/null | head -15` で YAML フロントマター取得

3. YAML フロントマターから以下を抽出:
   - `id`: 仕様書 ID
   - `name`: 仕様書名
   - `phase`: フェーズ（先頭15行のみを対象）
   - `branch_name`: ブランチ名
   - `github_issue_number`: GitHub Issue 番号
   - `updated_at`: 更新日時

**重要**: Bash の for/while ループは使用禁止。各ブランチ・ファイルに対して個別にツールを呼び出すこと。

#### 重複排除

同じ ID の仕様書が複数ブランチにある場合:
- 現在のブランチの仕様書を優先
- それ以外は `updated_at` が新しい方を採用

#### 集計

収集した仕様書を以下のように集計:
- `total`: 総件数（重複排除後）
- `byPhase`: フェーズごとの件数
- `otherBranchCount`: 他ブランチにある仕様書の件数（フェーズごと）
- `withoutIssue`: GitHub Issue が未作成の仕様書リスト
- `recent`: 最近更新された仕様書（最大 5 件）

### Step 3.5: 実装中仕様書の進捗バー表示

`specs.byPhase.implementation` が 1 件以上の場合、各仕様書の進捗バーを生成:

1. 各実装中仕様書のファイルを Read ツールで読み込み
2. 「## 8. 実装タスクリスト」セクションを解析
3. チェックボックスの状態を集計:
   - 完了タスク数（`- [x]`）
   - 総タスク数
   - 完了率 = 完了タスク数 / 総タスク数 * 100

4. 進捗バーを生成:
   ```
   進捗バー生成ルール:
   - 全体幅: 20 文字
   - 完了部分: █（完了率に応じた数）
   - 未完了部分: ░（残りの数）

   例: 40% の場合 → [████████░░░░░░░░░░░░] 40%
   ```

### Step 4: GitHub 連携状態の確認

`github` 設定が存在する場合、Bash ツールで以下を実行:

```bash
gh repo view {github.owner}/{github.repo} --json name,description,url --jq '.name + " (" + .url + ")"' 2>/dev/null || echo "GitHub CLI not configured"
```

### Step 5: 結果の表示

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

{github 設定がある場合}
- **リポジトリ**: {github.owner}/{github.repo}
- **プロジェクト番号**: #{github.project_number} (未設定の場合は "未設定")
- **認証状態**: GITHUB_TOKEN が設定されていれば ✓ 設定済み、なければ ✗ 未設定

{github 設定がない場合}
ℹ️ GitHub 連携は未設定です。設定するには: `/cft:github init <owner> <repo>`

## 仕様書状況

**合計**: {specs.total} 件

| フェーズ | 件数 | うち他ブランチ |
|---|---:|---:|
| requirements | {specs.byPhase.requirements} | {specs.otherBranchCount.requirements} |
| design | {specs.byPhase.design} | {specs.otherBranchCount.design} |
| implementation | {specs.byPhase.implementation} | {specs.otherBranchCount.implementation} |
| review | {specs.byPhase.review} | {specs.otherBranchCount.review} |
| completed | {specs.byPhase.completed} | {specs.otherBranchCount.completed} |

※「うち他ブランチ」は現在のブランチに存在しない仕様書の件数

{specs.withoutIssue が 1 件以上の場合}
### Issue 未作成の仕様書

| ID | 名前 | フェーズ |
|---|---|---|
{specs.withoutIssue の各仕様書を表形式で表示（最大 5 件）}

ヒント: `/cft:github issue-create <spec-id>` で Issue を作成できます。

{specs.byPhase.implementation が 1 件以上の場合}
## 実装進捗

{各実装中仕様書について}
### {仕様書名}

```
[████████░░░░░░░░░░░░] {完了率}% ({完了数}/{総数} タスク完了)
```

{specs.recent が 1 件以上の場合}
## 最近の仕様書

| ID | 名前 | フェーズ | ブランチ | GitHub | 進捗 |
|---|---|---|---|---|---|
{specs.recent の各仕様書を表形式で表示}

- ID は最初の 8 文字 + "..."
- ブランチは現在のブランチにある場合は "-"、他ブランチの場合はブランチ名（短縮形）
- GitHub は Issue 番号があれば "#番号"、なければ "-"
- PR があれば " (PR #番号)" を追加
- 進捗は implementation フェーズの場合のみ表示（例: "40%"）

## 次のアクション

{specs.total が 0 の場合}
- 最初の仕様書を作成: `/cft:spec create "<name>"`

{github 設定がない場合}
- GitHub 連携を設定: `/cft:github init <owner> <repo>`

{specs.withoutIssue が 1 件以上の場合}
- Issue 未作成の仕様書があります。Issue を作成してください: `/cft:github issue-create <spec-id>`

{specs.byPhase.implementation が 1 件以上の場合}
- 実装中の仕様書があります: `/cft:spec list implementation`

{上記以外の場合}
- 仕様書一覧を表示: `/cft:spec list`
- 新しい仕様書を作成: `/cft:spec create "<name>"`
```

---

## エラーハンドリング

### プロジェクトが初期化されていない場合

```
❌ プロジェクトが初期化されていません

cc-craft-kit を使用するには、まずプロジェクトを初期化してください:

/cft:init <project-name>
```

### 設定ファイルエラーの場合

```
❌ ステータス情報の取得に失敗しました

エラー: {エラーメッセージ}

対処法:
1. 設定ファイルを確認: `.cc-craft-kit/config.json`
2. 整合性チェック: `/cft:sync check`
```
