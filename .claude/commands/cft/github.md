# /cft:github - GitHub 統合コマンド

GitHub Issue/PR 操作の統合コマンド。

## 使用方法

```
/cft:github <subcommand> <args...>
```

## サブコマンド

| サブコマンド | 説明 | 使用例 |
|---|---|---|
| `init <owner> <repo>` | GitHub 統合を初期化 | `/cft:github init B16B1RD cc-craft-kit` |
| `issue-create <spec-id>` | 仕様書から Issue を作成 | `/cft:github issue-create abc123` |
| `sync <direction> <spec-id>` | Issue と仕様書を同期 | `/cft:github sync to-github abc123` |

---

## 実行手順

### 入力の解析

ユーザー入力: `$ARGUMENTS`

入力形式を解析:
- 第1引数: サブコマンド（init / issue-create / sync）
- 第2引数以降: サブコマンド固有の引数

---

## init サブコマンド

GitHub 統合を初期化します。

### 入力
- `<owner>`: リポジトリオーナー
- `<repo>`: リポジトリ名

### 実行手順

1. **gh CLI の確認**
   ```bash
   command -v gh && gh auth status
   ```

2. **リポジトリアクセス確認**
   ```bash
   gh repo view <owner>/<repo> --json name,owner
   ```

3. **config.json を更新**
   `.cc-craft-kit/config.json` の `github` セクションを更新:
   ```json
   {
     "github": {
       "owner": "<owner>",
       "repo": "<repo>"
     }
   }
   ```

4. **GitHub Projects 設定を解決**（オプション）

   `github.project_v2.id` が未設定で、環境変数 `GITHUB_PROJECT_NUMBER` がある場合:

   ```bash
   # Project Number から Project ID を取得
   gh api graphql -f query='
     query {
       user(login: "<owner>") {
         projectsV2(first: 100) {
           nodes { id number title }
         }
       }
     }
   ' --jq '.data.user.projectsV2.nodes[] | select(.number == <project_number>) | {id, number, title: .title}'
   ```

   取得結果を config.json の `github.project_v2` に保存:
   ```json
   {
     "github": {
       "project_v2": {
         "name": "<title>",
         "number": <number>,
         "id": "<id>",
         "cached_at": "<ISO8601>"
       }
     }
   }
   ```

5. **結果を報告**

---

## issue-create サブコマンド

仕様書から GitHub Issue を作成します。

### 入力
- `<spec-id>`: 仕様書ID（短縮形または完全形）

### 実行手順

1. **仕様書を特定**
   ```bash
   # spec-id から仕様書ファイルを検索
   ```
   Glob パターン: `.cc-craft-kit/specs/*<spec-id>*.md`

2. **仕様書を読み込み**
   - YAML フロントマターを解析
   - `github_issue_number` が既に設定されている場合は警告して終了

3. **GitHub 設定を取得**
   `.cc-craft-kit/config.json` から owner/repo を取得

4. **Issue を作成**
   ```bash
   gh issue create \
     --title "【SDD】<仕様書名>" \
     --body "<Issue 本文>" \
     --label "sdd,<phase>"
   ```

   Issue 本文テンプレート:
   ```markdown
   ## 仕様書情報

   | 項目 | 値 |
   |---|---|
   | 仕様書ID | `<id>` |
   | フェーズ | `<phase>` |
   | ブランチ | `<branch_name>` |

   ## 背景と目的

   <仕様書から抽出>

   ## 受け入れ基準

   <仕様書から抽出>

   ---
   *この Issue は cc-craft-kit により自動生成されました*
   ```

5. **仕様書を更新**
   作成された Issue 番号を YAML フロントマターの `github_issue_number` に設定

6. **GitHub Projects に追加**

   config.json の `github.project_v2.id` が設定されている場合のみ実行。

   ```bash
   # Issue の Global Node ID を取得
   ISSUE_NODE_ID=$(gh issue view <issue_number> --json id -q .id)

   # Project ID を取得
   PROJECT_V2_ID=<config.json の github.project_v2.id>

   # Projects に追加
   gh api graphql -f query='
     mutation($projectId: ID!, $contentId: ID!) {
       addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
         item { id }
       }
     }
   ' -f projectId="$PROJECT_V2_ID" -f contentId="$ISSUE_NODE_ID"
   ```

   **エラーハンドリング**:
   - `project_v2.id` が未設定: スキップ（警告なし）
   - GraphQL エラー: 警告を出力して続行（Issue 作成は成功扱い）
   ```
   ⚠️ GitHub Projects への追加に失敗しました（Issue #<number> は正常に作成されています）
   ```

7. **結果を報告**

---

## sync サブコマンド

仕様書と GitHub Issue を同期します。

### 入力
- `<direction>`: 同期方向（to-github / from-github）
- `<spec-id>`: 仕様書ID

### 実行手順

1. **仕様書を特定・読み込み**
   Glob + Read で仕様書ファイルを取得

2. **GitHub Issue を取得**
   ```bash
   gh issue view <issue_number> --json title,body,state,labels
   ```

3. **同期方向に応じて処理**

   **to-github** の場合:
   - 仕様書の内容で Issue を更新
   ```bash
   gh issue edit <issue_number> --title "<新タイトル>" --body "<新本文>"
   ```

   **from-github** の場合:
   - Issue の状態を仕様書に反映
   - Issue が closed なら phase を確認

4. **結果を報告**

---

## 共通: 仕様書の特定

仕様書IDから実際のファイルを特定する手順:

1. Glob で検索: `.cc-craft-kit/specs/*<spec-id>*.md`
2. 複数マッチした場合:
   - 完全一致を優先
   - なければエラー
3. 該当なしの場合: エラー

---

## エラーハンドリング

| エラー | 対処 |
|---|---|
| gh CLI 未インストール | インストール手順を案内 |
| 認証エラー | `gh auth login` を案内 |
| 仕様書が見つからない | ID を確認するよう案内 |
| Issue 既存 | 既存の Issue 番号を表示 |
| リポジトリアクセス不可 | 権限を確認するよう案内 |

---

## 出力形式

### 成功時
```
✅ <操作> が完了しました

| 項目 | 値 |
|---|---|
| 仕様書 | <name> |
| Issue | #<number> |
| URL | <issue_url> |
```

### 失敗時
```
❌ <操作> に失敗しました

原因: <エラー詳細>

対処方法:
- <具体的な対処手順>
```
