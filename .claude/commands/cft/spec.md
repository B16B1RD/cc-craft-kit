---
description: "仕様書の管理（create/list/get/phase/delete）"
argument-hint: "<subcommand> [args...]"
---

# 仕様書管理コマンド

仕様書の作成、一覧表示、詳細取得、フェーズ更新、削除を行う統合コマンドです。

## サブコマンド

| サブコマンド | 説明 | 使用例 |
|-------------|------|--------|
| `create` | 新しい仕様書を作成 | `/cft:spec create "機能名" "説明"` |
| `list` | 仕様書一覧を表示 | `/cft:spec list [phase] [limit]` |
| `get` | 仕様書の詳細を表示 | `/cft:spec get <spec-id>` |
| `phase` | フェーズを更新 | `/cft:spec phase <spec-id> <phase>` |
| `delete` | 仕様書を削除 | `/cft:spec delete <spec-id> [--yes]` |

---

## 共通: YAML フロントマター形式

すべてのサブコマンドは以下の YAML フロントマター形式の仕様書を扱います。

```markdown
---
id: <uuid>
name: <仕様書名>
phase: <requirements|design|implementation|review|completed>
branch_name: <ブランチ名>
github_issue_number: <Issue番号|null>
created_at: <ISO8601形式>
updated_at: <ISO8601形式>
---

# <仕様書名>

## 1. 背景と目的
...
```

---

## 共通: 仕様書パース手順

各サブコマンドで使用する共通パターン:

### ID 解決パターン

1. Glob ツールで `.cc-craft-kit/specs/*.md` を検索
2. ファイル名から UUID を抽出し、部分 ID と照合
3. 一致するファイルを Read ツールで読み込み
4. YAML フロントマター（`---` で囲まれた部分）を解析

### YAML パース

ファイル先頭の `---` で囲まれた部分から各フィールドを抽出:

```
id: → SPEC_ID
name: → SPEC_NAME
phase: → PHASE
branch_name: → BRANCH_NAME
github_issue_number: → GITHUB_ISSUE_NUMBER
created_at: → CREATED_AT
updated_at: → UPDATED_AT
```

---

## サブコマンド: create

### 引数

- `$2` (必須): 仕様書名
- `$3` (オプション): 仕様書の説明

### 実行フロー

#### Step 1: UUID 生成

```bash
uuidgen | tr '[:upper:]' '[:lower:]'
```

結果を `SPEC_ID` として記録。

#### Step 2: ブランチ名生成

仕様書名と説明から英語 kebab-case ブランチ名を生成。

**プレフィックス判定:**

| キーワード | プレフィックス |
|-----------|---------------|
| バグ, 修正, エラー, fix, bug | `fix/` |
| ドキュメント, 文書, README, docs | `docs/` |
| リファクタ, refactor | `refactor/` |
| テスト, test | `test/` |
| その他 | `feature/` |

**形式:** `<prefix>spec-<短縮ID>-<英語kebab-case>`

#### Step 3: ベースブランチ取得

```bash
grep '^BASE_BRANCH=' .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "develop"
```

#### Step 4: ブランチ作成・切り替え

```bash
git branch "$BRANCH_NAME" "$BASE_BRANCH"
git checkout "$BRANCH_NAME"
```

#### Step 5: 仕様書ファイル作成

Write ツールで `.cc-craft-kit/specs/$SPEC_ID.md` を作成:

```markdown
---
id: $SPEC_ID
name: $2
phase: requirements
branch_name: $BRANCH_NAME
github_issue_number: null
created_at: <現在日時 ISO8601>
updated_at: <現在日時 ISO8601>
---

# $2

## 1. 背景と目的

### 背景

$3（または "背景を記述してください"）

### 目的

(この仕様の目的を記述してください)

---

## 2. 対象ユーザー

(この機能の対象ユーザーを記述してください)

---

## 3. 受け入れ基準

### 必須要件

- [ ] (必須要件1)
- [ ] (必須要件2)

### 機能要件

- [ ] (機能要件1)
- [ ] (機能要件2)

### 非機能要件

- [ ] (非機能要件1)
- [ ] (非機能要件2)

---

## 4. 制約条件

(制約条件を記述してください)

---

## 5. 依存関係

(依存する他の仕様やコンポーネントを記述してください)

---

## 6. 参考情報

- (参考資料やリンク)
```

#### Step 6: コードベース解析（オプション）

Task ツールで Explore サブエージェント（thoroughness: "medium"）を実行し、関連情報を収集。

#### Step 7: 仕様書の自動補完

Edit ツールでプレースホルダーを解析結果に基づいて更新。

#### Step 8: 自動コミット

```bash
git add ".cc-craft-kit/specs/$SPEC_ID.md"
git commit -m "feat: $2 の仕様書を作成"
```

#### Step 9: 元ブランチに復帰

```bash
git checkout "$ORIGINAL_BRANCH"
```

### 成功メッセージ

```
✓ 仕様書を作成しました

仕様書 ID: $SPEC_ID
名前: $2
フェーズ: requirements
ファイル: .cc-craft-kit/specs/$SPEC_ID.md
ブランチ: $BRANCH_NAME

次のステップ:
- 仕様書を確認: /cft:spec get <短縮ID>
- 設計フェーズへ: /cft:spec phase <短縮ID> design
- GitHub Issue 作成: /cft:github issue <短縮ID>
```

---

## サブコマンド: list

### 引数

- `$2` (オプション): フェーズフィルター (requirements/design/implementation/review/completed)
- `$3` (オプション): 表示件数 (デフォルト: 20)

### 実行フロー

#### Step 1: 全ブランチの仕様書ファイル一覧取得

**重要**: 現在のブランチだけでなく、すべてのローカルブランチから仕様書を収集する。

##### Step 1.1: 現在のブランチの仕様書を取得

Glob ツールで `.cc-craft-kit/specs/*.md` を取得し、各ファイルを Read ツールで読み込んで YAML フロントマターを解析。

##### Step 1.2: 仕様書関連ブランチを取得

Bash ツールで以下を実行:

```bash
git for-each-ref --format='%(refname:short)' refs/heads/ | grep 'spec-'
```

現在のブランチを除外し、`spec-` を含むブランチ一覧を取得。

##### Step 1.3: 各ブランチの仕様書を取得

各ブランチについて、Bash ツールで以下を実行:

```bash
git ls-tree -r --name-only <branch> .cc-craft-kit/specs/ 2>/dev/null | grep '\.md$'
```

各仕様書ファイルの YAML フロントマターを取得:

```bash
git show <branch>:<file> 2>/dev/null | head -15
```

YAML フロントマターから以下を抽出:

- `id`: 仕様書 ID
- `name`: 仕様書名
- `phase`: フェーズ（先頭15行のみを対象に抽出し、本文中のテンプレート記述を除外）
- `branch_name`: ブランチ名
- `github_issue_number`: GitHub Issue 番号
- `updated_at`: 更新日時

所属ブランチ情報も記録（現在のブランチにあるか、他ブランチにあるか）。

##### Step 1.4: 重複排除

同じ ID の仕様書が複数ブランチにある場合:

- 現在のブランチの仕様書を優先
- それ以外は `updated_at` が新しい方を採用

#### Step 2: 各ファイルのメタデータ抽出

上記 Step 1 で収集済み。

#### Step 3: フィルタリング

`$2` が指定されている場合、phase でフィルタリング。

#### Step 4: 結果表示

```text
📋 仕様書一覧 (フィルター: $2 または "すべて")

| ID (短縮) | 名前 | フェーズ | ブランチ | 更新日時 |
|-----------|------|---------|----------|----------|
| abc12345 | 機能A | design | - | 2025/12/06 |
| def67890 | 機能B | implementation | fix/spec-def... | 2025/12/05 |

合計: N 件 (うち他ブランチ: M 件)

次のステップ:
- 詳細確認: /cft:spec get <spec-id>
- 新規作成: /cft:spec create "名前" "説明"
```

- ブランチ列: 現在のブランチにある場合は "-"、他ブランチの場合はブランチ名（長い場合は先頭15文字 + "..."）

---

## サブコマンド: get

### 引数

- `$2` (必須): 仕様書 ID（部分一致可、最低 8 文字）

### 実行フロー

#### Step 1: ID 解決

Glob + Read で仕様書ファイルを特定。

#### Step 2: メタデータ表示

```
📄 仕様書詳細

| 項目 | 値 |
|------|-----|
| ID | $SPEC_ID |
| 名前 | $SPEC_NAME |
| フェーズ | $PHASE |
| ブランチ | $BRANCH_NAME |
| GitHub Issue | #$GITHUB_ISSUE_NUMBER または "なし" |
| 作成日時 | $CREATED_AT |
| 更新日時 | $UPDATED_AT |
```

#### Step 3: 仕様書本文表示

YAML フロントマター以降の本文を表示。

#### Step 4: 次のステップ案内

```
次のステップ:
- フェーズ更新: /cft:spec phase $短縮ID <phase>
- GitHub Issue 作成: /cft:github issue $短縮ID
- 削除: /cft:spec delete $短縮ID
```

---

## サブコマンド: phase

### 引数

- `$2` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$3` (必須): 新しいフェーズ

### フェーズ名マッピング

| 入力 | 正規化後 |
|------|----------|
| req, reqs | requirements |
| des | design |
| impl, imp | implementation |
| rev | review |
| comp, done | completed |

### 実行フロー

#### Step 1: フェーズ名正規化

#### Step 2: ID 解決

Glob + Read で仕様書ファイルを特定。

#### Step 3: ブランチ切り替え

```bash
git checkout "$BRANCH_NAME"
```

ブランチが存在しない場合は自動作成:

```bash
git branch "$BRANCH_NAME" "$BASE_BRANCH"
git checkout "$BRANCH_NAME"
```

#### Step 4: バリデーション

**requirements → design:**
- 背景と目的、対象ユーザー、受け入れ基準セクションが記述されていることを確認

**design → implementation:**
- 設計詳細セクションが存在することを確認

#### Step 5: 仕様書ファイル更新

Edit ツールで YAML フロントマターを更新:

```
phase: <old> → phase: <new>
updated_at: <old> → updated_at: <current ISO8601>
```

#### Step 6: 自動コミット

```bash
git add "$SPEC_PATH"
git commit -m "feat: $SPEC_NAME の<フェーズ日本語名>を完了"
```

#### Step 7: フェーズ固有の後処理

**design フェーズ:**
- Explore サブエージェントでコードベース解析
- 設計詳細セクション（7.1〜7.5）を自動生成
- タスクリストセクション（8）を自動生成
- GitHub Sub Issue 作成（`gh issue create`）

**implementation フェーズ:**
- タスクリストを TodoWrite に登録
- 型チェック・リント実行
- 最初のタスクから実装を自動開始

**review フェーズ:**
- 品質チェック（npm run typecheck && npm run lint && npm test）
- PR 作成（`gh pr create`）

**completed フェーズ:**

**重要**: 以下の順序で**必ず**実行すること。順序を変えてはならない。

#### ケース A: PR がマージ済みの場合

PR がマージ済みかどうかを確認:

```bash
gh pr view "$BRANCH_NAME" --json state -q '.state' 2>/dev/null
```

結果が `MERGED` の場合は以下を実行:

1. **ベースブランチに切り替え・最新化**:
   ```bash
   git checkout develop
   git pull origin develop
   ```
   ※ これにより、マージ済みの仕様書（completed 状態）が取得される

2. **ローカル作業ブランチを削除**:
   ```bash
   git branch -D "$BRANCH_NAME"
   ```

3. **GitHub Issue がある場合はクローズ**:
   ```bash
   gh issue close $GITHUB_ISSUE_NUMBER --comment "✅ 仕様書が完了しました"
   ```

#### ケース B: PR がマージされていない、または PR がない場合

1. **まず仕様書ファイルの変更をコミット**（Step 6 の実行を確認）:
   ```bash
   git add ".cc-craft-kit/specs/$SPEC_ID.md"
   git commit -m "feat: $SPEC_NAME を完了"
   ```
   ※ このコミットが完了するまで、次のステップに進んではならない。

2. **次にベースブランチに切り替え・最新化**:
   ```bash
   git checkout develop
   git pull origin develop
   ```

3. **最後にローカル作業ブランチを削除**:
   ```bash
   git branch -D "$BRANCH_NAME"
   ```

4. **GitHub Issue がある場合はクローズ**:
   ```bash
   gh issue close $GITHUB_ISSUE_NUMBER --comment "✅ 仕様書が完了しました"
   ```

### 成功メッセージ

```
✓ フェーズを更新しました

仕様書: $SPEC_NAME
フェーズ: $OLD_PHASE → $NEW_PHASE

次のステップ:
- [フェーズに応じた次のアクション]
```

---

## サブコマンド: delete

### 引数

- `$2` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `--yes` または `-y`: 確認スキップ
- `--close-github-issue`: GitHub Issue を自動クローズ（デフォルト: true）

### 実行フロー

#### Step 1: ID 解決・情報取得

Glob + Read で仕様書ファイルを特定し、メタデータを抽出。

#### Step 2: 削除前確認

`--yes` が指定されていない場合、AskUserQuestion で確認:

```
⚠️ 削除対象:

| 項目 | 値 |
|------|-----|
| ID | $SPEC_ID |
| 名前 | $SPEC_NAME |
| フェーズ | $PHASE |
| ブランチ | $BRANCH_NAME |
| GitHub Issue | #$GITHUB_ISSUE_NUMBER |

この操作は取り消せません。削除しますか？
```

#### Step 3: 削除実行

1. **仕様書ファイル削除:**
   ```bash
   rm ".cc-craft-kit/specs/$SPEC_ID.md"
   ```

2. **ブランチ削除（存在する場合）:**
   ```bash
   git branch -D "$BRANCH_NAME" 2>/dev/null || true
   ```

3. **GitHub Issue クローズ（`--close-github-issue` が true の場合）:**
   ```bash
   gh issue close $GITHUB_ISSUE_NUMBER --comment "仕様書が削除されたため、この Issue をクローズします。"
   ```

#### Step 4: 結果表示

```
✓ 仕様書を削除しました

| 項目 | 値 |
|------|-----|
| ID | $SPEC_ID |
| 名前 | $SPEC_NAME |
| GitHub Issue | #$GITHUB_ISSUE_NUMBER (クローズ済み)

次のステップ:
- 仕様書一覧: /cft:spec list
- 新規作成: /cft:spec create "名前" "説明"
```

---

## エラーハンドリング

### 仕様書が見つからない

```
❌ 仕様書が見つかりません: $SPEC_ID_PREFIX

確認事項:
- 仕様書 ID は最低 8 文字必要です
- /cft:spec list で仕様書一覧を確認してください
```

### 無効なフェーズ名

```
❌ 無効なフェーズ名: $PHASE

有効なフェーズ:
- requirements (req, reqs)
- design (des)
- implementation (impl, imp)
- review (rev)
- completed (comp, done)
```

### ブランチ操作失敗

```
❌ ブランチ操作に失敗しました

対処方法:
1. 未コミットの変更を確認: git status
2. 変更をスタッシュ: git stash
3. 手動で操作: git checkout $BRANCH_NAME
```

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

---

## 使用例

```bash
# 仕様書作成
/cft:spec create "ユーザー認証機能" "OAuth2.0対応の認証システム"

# 一覧表示
/cft:spec list
/cft:spec list design
/cft:spec list implementation 50

# 詳細表示
/cft:spec get abc12345

# フェーズ更新
/cft:spec phase abc12345 design
/cft:spec phase abc12345 impl
/cft:spec phase abc12345 review
/cft:spec phase abc12345 done

# 削除
/cft:spec delete abc12345
/cft:spec delete abc12345 --yes
```
