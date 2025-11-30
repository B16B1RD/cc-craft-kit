---
description: "仕様書を削除します"
argument-hint: "<spec-id> [--yes] [--close-github-issue]"
---

# 仕様書削除

指定された仕様書をデータベースとファイルシステムから削除します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致対応、最小 8 文字）
- `--yes` または `-y` (オプション): 確認プロンプトをスキップ
- `--close-github-issue` (オプション): GitHub Issue を自動クローズ（デフォルト: 有効）

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。

### Step 1: 引数解析

引数から以下を解析します:

- `SPEC_ID_PREFIX`: `$1`（必須）
- `SKIP_CONFIRMATION`: `--yes` または `-y` フラグの有無
- `CLOSE_GITHUB_ISSUE`: `--close-github-issue` フラグの有無（デフォルト: true）

`$1` が未指定の場合:

```
❌ エラー: 仕様書 ID が指定されていません

使用法:
  /cft:spec-delete <spec-id> [--yes] [--close-github-issue]

例:
  /cft:spec-delete 5e034974
  /cft:spec-delete 5e034974 --yes
```

### Step 2: 削除対象情報の取得

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/spec/delete-query.ts "$SPEC_ID_PREFIX"
```

出力（JSON）を解析し、以下を記録:

- `SPEC_ID`: 完全な仕様書 ID (`spec.id`)
- `SPEC_NAME`: 仕様書名 (`spec.name`)
- `PHASE`: 現在のフェーズ (`spec.phase`)
- `BRANCH_NAME`: 関連ブランチ (`spec.branch_name`)
- `GITHUB_ISSUE_NUMBER`: GitHub Issue 番号 (`spec.github_issue_number`)
- `FILE_PATH`: ファイルパス (`spec.file_path`)

エラーの場合（`success: false`）:

```
❌ エラーメッセージ（JSON の error フィールド）

確認事項:
- 仕様書 ID は最低 8 文字必要です
- /cft:spec-list で仕様書一覧を確認してください
```

処理を**中断**してください。

### Step 3: 削除前の情報表示

```
⚠️ 削除対象:

| 項目 | 値 |
|------|-----|
| 仕様書 ID | $SPEC_ID |
| 名前 | $SPEC_NAME |
| フェーズ | $PHASE |
| ブランチ | $BRANCH_NAME |
| GitHub Issue | #$GITHUB_ISSUE_NUMBER（または "なし"）|
| ファイル | $FILE_PATH |

この操作は取り消せません。
```

### Step 4: ユーザー確認

`SKIP_CONFIRMATION` が **false** の場合:

AskUserQuestion ツールで確認:

```
質問: この仕様書を削除してもよろしいですか？
オプション:
  - はい、削除する
  - いいえ、キャンセル
```

「いいえ、キャンセル」が選択された場合:

```
✓ 削除をキャンセルしました
```

処理を**中断**してください。

`SKIP_CONFIRMATION` が **true** の場合:

Step 5 へ進みます。

### Step 5: 削除実行

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/spec/delete-execute.ts "$SPEC_ID" --close-github-issue=$CLOSE_GITHUB_ISSUE
```

出力（JSON）を解析:

- `success: true` の場合 → Step 6 へ
- `success: false` の場合 → エラーハンドリング

#### エラーハンドリング

`errorCode` に応じた処理:

| errorCode | 対応 |
|-----------|------|
| `NOT_FOUND` | 仕様書が見つからない旨を表示し、中断 |
| `AUTH_FAILED` | GitHub 認証エラー。GITHUB_TOKEN の確認を案内し、中断 |
| `RATE_LIMIT` | レート制限エラー。時間をおいて再試行を案内し、中断 |
| `API_ERROR` | GitHub API エラー。時間をおいて再試行を案内し、中断 |
| `DB_ERROR` | データベースエラー。詳細を表示し、中断 |
| `FILE_ERROR` | ファイル操作エラー。詳細を表示し、中断 |

```
❌ $error

復旧手順:
- [errorCode に応じた復旧手順]
```

### Step 6: 結果表示

`githubIssueStatus` に応じた表示:

| ステータス | 表示 |
|-----------|------|
| `closed` | ✓ GitHub Issue #N をクローズしました |
| `warning` | ⚠️ GitHub Issue #N のクローズに失敗しました（削除は完了） |
| `skipped` | （表示なし） |

```
✓ 仕様書を削除しました

| 項目 | 値 |
|------|-----|
| 仕様書 ID | $deletedSpecId |
| 名前 | $deletedSpecName |
| フェーズ | $deletedPhase |
| GitHub Issue | [githubIssueStatus に応じた表示] |

次のステップ:
- プロジェクト状態確認: /cft:status
- 仕様書一覧: /cft:spec-list
```

---

## 使用例

```bash
# 通常の削除（確認プロンプトあり）
/cft:spec-delete 5e034974

# 確認プロンプトをスキップ
/cft:spec-delete 5e034974 --yes

# GitHub Issue のクローズをスキップ
/cft:spec-delete 5e034974 --yes --close-github-issue=false
```

## 注意事項

- **この操作は取り消せません**
- データベースレコードと仕様書ファイルの両方が削除されます
- GitHub Issue はデフォルトで自動的にクローズされます
- GitHub Issue クローズに失敗しても、削除処理は続行されます（404 エラーの場合）
