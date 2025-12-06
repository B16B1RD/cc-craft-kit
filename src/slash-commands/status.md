---
description: "プロジェクトの現在の状況を表示します"
argument-hint: "[--verbose]"
---

# プロジェクト状況

cc-craft-kit プロジェクトの現在の状況を表示します。

## 引数

- `--verbose` または `-v` (任意): 詳細情報を表示

## 使用例

```bash
# 通常表示
/cft:status

# 詳細表示
/cft:status --verbose
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: 仕様書一覧の取得

Glob ツールで `.cc-craft-kit/specs/*.md` を取得。

各ファイルを Read ツールで読み込み、YAML フロントマターを解析:

- id
- name
- phase
- branch_name
- github_issue_number

フェーズ別に集計:

```
SPECS_BY_PHASE = {
  requirements: N,
  design: N,
  implementation: N,
  review: N,
  completed: N
}
SPECS_TOTAL = 合計数
SPECS_WITHOUT_ISSUE = github_issue_number が null の仕様書リスト
```

### Step 2: config.json から GitHub 設定取得

Read ツールで `.cc-craft-kit/config.json` を読み込み:

```json
{
  "github": {
    "owner": "...",
    "repo": "..."
  }
}
```

ファイルが存在しない場合は `GITHUB_CONFIGURED = false`。

### Step 3: GitHub 連携状態確認

`GITHUB_CONFIGURED` が true の場合:

```bash
gh auth status 2>&1 | head -1
```

認証状態を確認。

### Step 4: 実装中仕様書の進捗計算

`SPECS_BY_PHASE.implementation` が 1 以上の場合:

各実装中仕様書の「## 8. 実装タスクリスト」セクションを解析:
- 完了タスク数（`- [x]`）
- 総タスク数（`- [ ]` + `- [x]`）
- 完了率 = 完了タスク数 / 総タスク数 * 100

進捗バー生成:
```
全体幅: 20 文字
完了部分: █（完了率に応じた数）
未完了部分: ░（残りの数）

例: 40% → [████████░░░░░░░░░░░░] 40%
```

### Step 5: 結果表示

---

## 出力フォーマット

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 プロジェクト状況
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## GitHub 連携

{GITHUB_CONFIGURED が true の場合}
- リポジトリ: {owner}/{repo}
- 認証状態: ✓ 認証済み

{GITHUB_CONFIGURED が false の場合}
ℹ️ GitHub 連携は未設定です
設定するには: /cft:github init <owner> <repo>

## 仕様書状況

合計: {SPECS_TOTAL} 件

| フェーズ | 件数 |
|---------|-----:|
| requirements | {N} |
| design | {N} |
| implementation | {N} |
| review | {N} |
| completed | {N} |

{SPECS_WITHOUT_ISSUE が 1 件以上の場合}
### Issue 未作成の仕様書

| ID (短縮) | 名前 | フェーズ |
|-----------|------|---------|
{各仕様書を表形式で表示（最大 5 件）}

ヒント: /cft:github issue <spec-id> で Issue を作成

{SPECS_BY_PHASE.implementation が 1 件以上の場合}
## 実装進捗

{各実装中仕様書について}
### {仕様書名} ({短縮ID})

[████████░░░░░░░░░░░░] {完了率}% ({完了数}/{総数} タスク)

## 最近の仕様書

| ID (短縮) | 名前 | フェーズ | GitHub |
|-----------|------|---------|--------|
{更新日時順で最新 5 件を表示}

## 次のアクション

{SPECS_TOTAL が 0 の場合}
- 最初の仕様書を作成: /cft:spec create "名前"

{GITHUB_CONFIGURED が false の場合}
- GitHub 連携を設定: /cft:github init <owner> <repo>

{SPECS_WITHOUT_ISSUE が 1 件以上の場合}
- Issue を作成: /cft:github issue <spec-id>

{SPECS_BY_PHASE.implementation が 1 件以上の場合}
- 実装を続ける: /cft:session start <spec-id>

{上記以外}
- 仕様書一覧: /cft:spec list
- 新規作成: /cft:spec create "名前"
```

---

## --verbose オプション

追加で以下の情報を表示:

### 仕様書ファイル詳細

```bash
ls -la .cc-craft-kit/specs/*.md 2>/dev/null | wc -l
du -sh .cc-craft-kit/specs/ 2>/dev/null
```

### Git 状態

```bash
git status --short
git log --oneline -5
```

---

## エラーハンドリング

### 仕様書ディレクトリが存在しない

```
ℹ️ 仕様書が見つかりません

cc-craft-kit を使い始めるには:
  /cft:spec create "最初の仕様書"
```

### config.json が存在しない

```
ℹ️ 設定ファイルが見つかりません

GitHub 連携を設定するには:
  /cft:github init <owner> <repo>
```
