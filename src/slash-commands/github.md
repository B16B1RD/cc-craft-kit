---
description: "GitHub 統合（init/issue/sync/cleanup）"
argument-hint: "<subcommand> [args...]"
---

# GitHub 統合コマンド

GitHub との連携を管理する統合コマンドです。`gh` CLI を使用して GitHub 操作を行います。

## 前提条件

- `gh` CLI がインストールされていること
- `gh auth login` で認証済みであること

```bash
# インストール確認
gh --version

# 認証確認
gh auth status
```

## サブコマンド

| サブコマンド | 説明 | 使用例 |
|-------------|------|--------|
| `init` | GitHub 統合を初期化 | `/cft:github init <owner> <repo>` |
| `issue` | 仕様書から Issue を作成 | `/cft:github issue <spec-id>` |
| `sync` | 仕様書と Issue を同期 | `/cft:github sync <direction> <spec-id>` |
| `cleanup` | PR マージ後のクリーンアップ | `/cft:github cleanup <spec-id>` |

---

## 共通: gh CLI 確認

各サブコマンド実行前に以下を確認:

```bash
# gh CLI 存在確認
if ! command -v gh &> /dev/null; then
  echo "❌ gh CLI がインストールされていません"
  echo ""
  echo "インストール方法:"
  echo "  macOS: brew install gh"
  echo "  Linux: https://github.com/cli/cli#installation"
  echo "  Windows: winget install GitHub.cli"
  exit 1
fi

# 認証確認
if ! gh auth status &> /dev/null; then
  echo "❌ gh CLI が認証されていません"
  echo ""
  echo "認証方法:"
  echo "  gh auth login"
  exit 1
fi
```

---

## サブコマンド: init

GitHub リポジトリとの連携を設定します。

### 引数

- `$2` (必須): GitHub オーナー名（ユーザー名または組織名）
- `$3` (必須): リポジトリ名

### 実行フロー

#### Step 1: gh CLI 確認

上記の共通確認を実行。

#### Step 2: リポジトリ存在確認

```bash
gh repo view "$2/$3" --json name -q '.name'
```

#### Step 3: config.json 更新

Read ツールで `.cc-craft-kit/config.json` を読み込み、Edit ツールで更新:

```json
{
  "github": {
    "owner": "$2",
    "repo": "$3"
  }
}
```

ファイルが存在しない場合は Write ツールで新規作成。

#### Step 4: 結果表示

```
✓ GitHub 統合を初期化しました

リポジトリ: $2/$3
認証状態: ✓ 認証済み

次のステップ:
- 仕様書から Issue 作成: /cft:github issue <spec-id>
- 仕様書一覧: /cft:spec list
```

---

## サブコマンド: issue

仕様書の内容から GitHub Issue を作成します。

### 引数

- `$2` (必須): 仕様書 ID（部分一致可、最低 8 文字）

### 実行フロー

#### Step 1: 仕様書解決

Glob + Read で仕様書ファイルを特定し、YAML フロントマターを解析。

#### Step 2: 既存 Issue 確認

YAML の `github_issue_number` が null でない場合:

```
⚠️ この仕様書には既に Issue #$GITHUB_ISSUE_NUMBER が関連付けられています

既存 Issue を更新する場合:
  /cft:github sync to-github $SPEC_ID

新規 Issue を作成する場合、まず既存の関連を解除してください。
```

処理を中断。

#### Step 3: config.json から owner/repo 取得

```bash
cat .cc-craft-kit/config.json
```

JSON から `github.owner` と `github.repo` を抽出。

#### Step 4: Issue 本文作成

仕様書の YAML フロントマター以降の本文を Issue body として使用。

#### Step 5: ラベル決定

フェーズに応じたラベル:

| フェーズ | ラベル |
|---------|--------|
| requirements | `phase:requirements` |
| design | `phase:design` |
| implementation | `phase:implementation` |
| review | `phase:review` |
| completed | `phase:completed` |

#### Step 6: Issue 作成

```bash
gh issue create \
  --title "$SPEC_NAME" \
  --body "$(cat <<'EOF'
$ISSUE_BODY
EOF
)" \
  --label "$PHASE_LABEL"
```

出力から Issue 番号を抽出。

#### Step 7: 仕様書更新

Edit ツールで YAML フロントマターを更新:

```
github_issue_number: null → github_issue_number: $ISSUE_NUMBER
updated_at: <old> → updated_at: <current ISO8601>
```

#### Step 8: 自動コミット

```bash
git add "$SPEC_PATH"
git commit -m "feat: $SPEC_NAME の GitHub Issue を作成 (#$ISSUE_NUMBER)"
```

#### Step 9: 結果表示

```
✓ GitHub Issue を作成しました

Issue: #$ISSUE_NUMBER
URL: https://github.com/$OWNER/$REPO/issues/$ISSUE_NUMBER
仕様書: $SPEC_NAME
フェーズラベル: $PHASE_LABEL

次のステップ:
- Issue を確認: gh issue view $ISSUE_NUMBER
- 仕様書を更新後に同期: /cft:github sync to-github $SPEC_ID
- 設計フェーズへ: /cft:spec phase $SPEC_ID design
```

---

## サブコマンド: sync

仕様書と GitHub Issue を同期します。

### 引数

- `$2` (必須): 同期方向 (`to-github` または `from-github`)
- `$3` (必須): 仕様書 ID（部分一致可、最低 8 文字）

### 実行フロー（to-github）

仕様書の内容で Issue を更新します。

#### Step 1: 仕様書解決

Glob + Read で仕様書ファイルを特定。

#### Step 2: Issue 番号確認

YAML の `github_issue_number` が null の場合:

```
❌ この仕様書には GitHub Issue が関連付けられていません

Issue を作成してください:
  /cft:github issue $SPEC_ID
```

#### Step 3: Issue 本文更新

```bash
gh issue edit $ISSUE_NUMBER --body "$(cat <<'EOF'
$SPEC_BODY
EOF
)"
```

#### Step 4: ラベル更新

```bash
# 既存のフェーズラベルを削除
gh issue edit $ISSUE_NUMBER --remove-label "phase:requirements,phase:design,phase:implementation,phase:review,phase:completed"

# 現在のフェーズラベルを追加
gh issue edit $ISSUE_NUMBER --add-label "phase:$PHASE"
```

#### Step 5: 同期コメント追加

```bash
gh issue comment $ISSUE_NUMBER --body "🔄 仕様書から同期しました ($(date '+%Y-%m-%d %H:%M:%S'))"
```

#### Step 6: 結果表示

```
✓ 仕様書を GitHub Issue に同期しました

Issue: #$ISSUE_NUMBER
仕様書: $SPEC_NAME
フェーズ: $PHASE

同期内容:
- Issue 本文を更新
- フェーズラベルを更新

次のステップ:
- Issue を確認: gh issue view $ISSUE_NUMBER
```

### 実行フロー（from-github）

Issue の状態を仕様書に反映します。

#### Step 1: 仕様書解決

#### Step 2: Issue 情報取得

```bash
gh issue view $ISSUE_NUMBER --json state,body,labels
```

#### Step 3: チェックボックス同期

Issue body のチェックボックス状態を仕様書に反映。

1. Issue body からチェックボックス行を抽出
2. 仕様書の対応するチェックボックスを Edit ツールで更新

#### Step 4: Issue クローズ時の処理

Issue state が `CLOSED` の場合:

- 仕様書のフェーズを `completed` に更新
- 更新日時を更新

#### Step 5: 結果表示

```
✓ GitHub Issue から仕様書を同期しました

Issue: #$ISSUE_NUMBER
仕様書: $SPEC_NAME
状態: $STATE

同期内容:
- チェックボックス: N 件更新
- フェーズ: [更新された場合のみ表示]

次のステップ:
- 仕様書を確認: /cft:spec get $SPEC_ID
```

---

## サブコマンド: cleanup

PR マージ後のクリーンアップを実行します。

### 引数

- `$2` (必須): 仕様書 ID（部分一致可、最低 8 文字）

### 実行フロー

#### Step 1: 仕様書解決

Glob + Read で仕様書ファイルを特定。

#### Step 2: ブランチ削除（ローカル）

```bash
git branch -d "$BRANCH_NAME" 2>/dev/null || echo "ローカルブランチは存在しません"
```

#### Step 3: ブランチ削除（リモート）

```bash
git push origin --delete "$BRANCH_NAME" 2>/dev/null || echo "リモートブランチは存在しません"
```

#### Step 4: Issue クローズ

```bash
gh issue close $ISSUE_NUMBER --comment "✅ PR がマージされました。この Issue をクローズします。"
```

#### Step 5: 仕様書フェーズ更新

Edit ツールで YAML フロントマターを更新:

```
phase: <current> → phase: completed
updated_at: <old> → updated_at: <current ISO8601>
```

#### Step 6: 結果表示

```
✓ クリーンアップが完了しました

仕様書: $SPEC_NAME
フェーズ: $OLD_PHASE → completed

実行内容:
- ローカルブランチ削除: $BRANCH_NAME
- リモートブランチ削除: $BRANCH_NAME
- Issue クローズ: #$ISSUE_NUMBER

次のステップ:
- プロジェクト状態確認: /cft:status
- 仕様書一覧: /cft:spec list
```

---

## エラーハンドリング

### gh CLI が見つからない

```
❌ gh CLI がインストールされていません

cc-craft-kit は GitHub 操作に gh CLI を使用します。

インストール方法:
- macOS: brew install gh
- Linux: https://github.com/cli/cli#installation
- Windows: winget install GitHub.cli

インストール後:
  gh auth login
```

### 認証エラー

```
❌ gh CLI が認証されていません

認証方法:
  gh auth login

認証状態確認:
  gh auth status
```

### リポジトリが見つからない

```
❌ リポジトリが見つかりません: $OWNER/$REPO

確認事項:
- リポジトリ名が正しいか
- アクセス権限があるか
- プライベートリポジトリの場合、認証スコープが適切か
```

### Issue 操作エラー

```
❌ Issue 操作に失敗しました

エラー: $ERROR_MESSAGE

確認事項:
- Issue 番号が正しいか
- Issue が存在するか
- 編集権限があるか
```

---

## 使用例

```bash
# GitHub 統合初期化
/cft:github init myorg myrepo

# Issue 作成
/cft:github issue abc12345

# 仕様書 → GitHub 同期
/cft:github sync to-github abc12345

# GitHub → 仕様書 同期
/cft:github sync from-github abc12345

# PR マージ後クリーンアップ
/cft:github cleanup abc12345
```
