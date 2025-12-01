---
description: "新しい仕様書を作成します"
argument-hint: "<spec-name> [description]"
---

# 仕様書作成

新しい仕様書を作成し、Requirements フェーズから開始します。

## 引数

- `$1` (必須): 仕様書名
- `$2` (オプション): 仕様書の説明

## 使用例

```bash
/cft:spec-create "ユーザー認証機能" "メール/パスワード認証とOAuth2.0対応"
```

---

## 自動実行フロー

重要: コマンド実行後、ユーザーに確認を求めずに、以下の処理を**自動的に実行**してください。

### Step 1: UUID 生成

Bash ツールで UUID を生成します。

```bash
uuidgen | tr '[:upper:]' '[:lower:]'
```

生成された UUID を `SPEC_ID` として記録してください。

### Step 2: ブランチ名生成

仕様書名（`$1`）と説明（`$2`）を分析し、英語の kebab-case ブランチ名を生成します。

**生成規則:**

- 3〜5 単語程度の簡潔な英語フレーズ
- 小文字のみ使用
- 単語の区切りはハイフン（`-`）を使用
- Git 互換文字のみ（英数字、ハイフン、アンダースコア）
- 最大 40 文字程度

**例:**

- 日本語: "ブランチ名が適当な名前になっている" → `improve-branch-naming`
- 日本語: "データベース接続エラーを修正" → `fix-database-connection`
- 英語: "Add User Authentication" → `add-user-authentication`

生成したブランチ名を `BRANCH_SUFFIX` として記録してください。

### Step 3: 現在ブランチ確認

Bash ツールで現在のブランチ名を取得します。

```bash
git branch --show-current
```

取得したブランチ名を `ORIGINAL_BRANCH` として記録してください。

### Step 4: ブランチプレフィックス判定とブランチ名決定

仕様書名（`$1`）と説明（`$2`）を分析し、適切なブランチプレフィックスを決定します。

**プレフィックス判定ロジック:**

1. 仕様書名・説明に以下のキーワードが含まれる場合、対応するプレフィックスを使用:

| キーワード | プレフィックス | 例 |
|---|---|---|
| `バグ`, `修正`, `エラー`, `fix`, `bug` | `fix/` | `fix/spec-<短縮ID>-<BRANCH_SUFFIX>` |
| `ドキュメント`, `文書`, `README`, `docs` | `docs/` | `docs/spec-<短縮ID>-<BRANCH_SUFFIX>` |
| `リファクタ`, `リファクタリング`, `refactor` | `refactor/` | `refactor/spec-<短縮ID>-<BRANCH_SUFFIX>` |
| `テスト`, `test` | `test/` | `test/spec-<短縮ID>-<BRANCH_SUFFIX>` |
| 上記以外 | `feature/` | `feature/spec-<短縮ID>-<BRANCH_SUFFIX>` |

2. キーワードが複数該当する場合は、最も優先度の高いものを使用（優先度: fix > refactor > test > docs > feature）

**短縮 ID**: `SPEC_ID` の最初の 8 文字

決定したブランチ名を `BRANCH_NAME` として記録してください。

**例:**

- 仕様書名「GitHub Issue が作成されない」→ `fix/spec-12345678-github-issue-not-created`
- 仕様書名「ユーザー認証機能追加」→ `feature/spec-12345678-add-user-auth`
- 仕様書名「README を更新」→ `docs/spec-12345678-update-readme`

### Step 4.5: ベースブランチの決定

Bash ツールで `.env` から `BASE_BRANCH` を読み込みます。

```bash
grep '^BASE_BRANCH=' .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "develop"
```

出力を `BASE_BRANCH` として記録してください。

### Step 4.6: 実行元ブランチの確認と警告

現在のブランチ（`ORIGINAL_BRANCH`）がベースブランチ（`BASE_BRANCH`）以外の場合、警告を表示します。

**判定ロジック:**

```
ORIGINAL_BRANCH == BASE_BRANCH の場合:
  → 警告なし、Step 5 へ進む

ORIGINAL_BRANCH != BASE_BRANCH の場合:
  → 警告を表示し、AskUserQuestion ツールで確認
```

**警告メッセージ:**

```
⚠️ 警告: 現在のブランチは '$ORIGINAL_BRANCH' です

仕様書作成時は通常、ベースブランチ（$BASE_BRANCH）から実行することを推奨します。
現在のブランチから実行すると、作業ブランチが $BASE_BRANCH ではなく $ORIGINAL_BRANCH から派生します。

選択肢:
1. このまま続行（$ORIGINAL_BRANCH から派生）
2. ベースブランチに切り替えてから再実行
```

**AskUserQuestion:**

- question: "現在のブランチ '$ORIGINAL_BRANCH' から仕様書を作成しますか？"
- header: "Branch"
- options:
  - label: "このまま続行"
    description: "$ORIGINAL_BRANCH から派生してブランチを作成します"
  - label: "中断"
    description: "先にベースブランチに切り替えてから再実行します"
- multiSelect: false

**ユーザー選択:**

- 「このまま続行」: Step 5 へ進む
- 「中断」: 処理を中断し、以下のメッセージを表示:

```
処理を中断しました。

ベースブランチに切り替えてから再実行してください:
  git checkout $BASE_BRANCH
  /cft:spec-create "$1" "$2"
```

### Step 5: ブランチ作成・切り替え

Bash ツールでブランチを作成し、切り替えます。

```bash
# BASE_BRANCH の存在確認
if ! git rev-parse --verify "$BASE_BRANCH" > /dev/null 2>&1; then
  echo "❌ ベースブランチ '$BASE_BRANCH' が見つかりません"
  echo "   .env の BASE_BRANCH 設定を確認してください"
  exit 1
fi

# BASE_BRANCH からブランチを派生
git branch "$BRANCH_NAME" "$BASE_BRANCH"

# ブランチ切り替え
git checkout "$BRANCH_NAME"
```

**エラーハンドリング:**

- `BASE_BRANCH` が存在しない場合、エラーメッセージを表示して処理を中断
- ブランチ作成に失敗した場合、エラーメッセージを表示して処理を中断
- 既に同名のブランチが存在する場合、既存ブランチに切り替える

### Step 6: 仕様書ファイル作成

Write ツールで仕様書ファイルを作成します。

**ファイルパス:** `.cc-craft-kit/specs/$SPEC_ID.md`

**テンプレート内容:**

```markdown
# $1

**仕様書 ID:** $SPEC_ID
**フェーズ:** requirements
**作成日時:** (現在の日時を YYYY/MM/DD HH:mm:ss 形式で挿入)
**更新日時:** (現在の日時を YYYY/MM/DD HH:mm:ss 形式で挿入)

---

## 1. 背景と目的

### 背景

$2（または "(背景を記述してください)"）

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

ファイル作成後、パスを `SPEC_PATH` として記録してください。

### Step 7: コードベース解析

Task ツールで Explore サブエージェントを実行し、コードベース情報を収集します。

**実行条件:** なし（常に実行）

**サブエージェント指示:**

```text
仕様書「$1」の要件定義を支援するため、以下の観点でコードベースを解析してください。

thoroughness: "medium"

検索対象:
  - src/commands/**/*.ts
  - src/core/**/*.ts
  - CLAUDE.md
  - .cc-craft-kit/specs/*.md
除外: tests/**/*, node_modules/**/*

収集情報:
  - 関連する既存機能の実装場所
  - 技術スタック・設計パターン
  - 既存の類似実装（参考にできるコード）
  - 命名規則・コーディングスタイル

出力形式:
  - 関連ファイルの一覧と役割
  - 推奨される実装アプローチ
  - 制約条件・依存関係の候補
```

**成功時:** 解析結果を `ANALYSIS_RESULT` として記録し、Step 8 へ進む

**エラーハンドリング:**

- Explore が失敗した場合、`ANALYSIS_RESULT` を空として記録
- 警告メッセージを表示し、Step 8 へ進む（処理は継続）

### Step 8: 仕様書の自動完成

Edit ツールで仕様書を更新し、要件定義を自動生成します。

**実行条件:** なし（常に実行）

**更新内容:**

1. **背景セクション** の更新:
   - 検索: `(背景を記述してください)` または `$2`（ユーザー入力がプレースホルダーの場合）
   - 置換: ユーザー入力（`$2`）+ コードベース解析結果から推論した背景情報

2. **目的セクション** の更新:
   - 検索: `(この仕様の目的を記述してください)`
   - 置換: 仕様書名（`$1`）と説明（`$2`）から推論した目的

3. **対象ユーザーセクション** の更新:
   - 検索: `(この機能の対象ユーザーを記述してください)`
   - 置換: コードベース解析結果から推論した対象ユーザー（不明な場合は「cc-craft-kit を使用する開発者」）

4. **受け入れ基準セクション** の更新:
   - 検索: `(必須要件1)`, `(必須要件2)`, `(機能要件1)`, `(機能要件2)`, `(非機能要件1)`, `(非機能要件2)`
   - 置換: 仕様書名と説明から推論した具体的な要件

5. **制約条件セクション** の更新:
   - 検索: `(制約条件を記述してください)`
   - 置換: コードベース解析結果から抽出した技術スタック、設計パターンに基づく制約

6. **依存関係セクション** の更新:
   - 検索: `(依存する他の仕様やコンポーネントを記述してください)`
   - 置換: コードベース解析結果から抽出した関連モジュール・ファイル

**成功時:** `AUTO_COMPLETE_SUCCESS` を `true` として記録し、Step 9 へ進む

**エラーハンドリング:**

- Edit が失敗した場合、`AUTO_COMPLETE_SUCCESS` を `false` として記録
- 仕様書はテンプレート状態で保存され、Step 9 へ継続

### Step 9: DB 登録 + イベント発火

最小スクリプトを呼び出して、データベースに登録し、イベントを発火します。

```bash
npx tsx .cc-craft-kit/commands/spec/register.ts \
  --id "$SPEC_ID" \
  --name "$1" \
  --description "$2" \
  --branch-name "$BRANCH_NAME" \
  --spec-path "$SPEC_PATH"
```

**出力の確認:**

- `success: true` の場合、Step 10 へ進む
- `success: false` の場合、エラーメッセージを表示し、ロールバック処理を実行

**ロールバック処理（エラー時）:**

1. 仕様書ファイル削除: `rm "$SPEC_PATH"`
2. ブランチ削除: `git checkout "$ORIGINAL_BRANCH" && git branch -D "$BRANCH_NAME"`

### Step 9.5: 仕様書ファイルの自動コミット

仕様書ファイルをステージングし、コミットします。

**実行:**

```bash
# 仕様書ブランチに切り替え（Step 9 の後、元ブランチに戻る前に実行）
git checkout "$BRANCH_NAME"

# 仕様書ファイルをステージング
git add "$SPEC_PATH"

# コミット
git commit -m "feat: $1 の仕様書を作成"
```

**成功時:** Step 10 へ進む

**エラーハンドリング:**

- ブランチ切り替えに失敗した場合、警告メッセージを表示し、手動でのコミットを案内
- ステージングまたはコミットに失敗した場合:
  - 警告メッセージを表示
  - 手動でのコミットを案内:
    ```
    ⚠️ 自動コミットに失敗しました

    手動でコミットしてください:
      git checkout $BRANCH_NAME
      git add $SPEC_PATH
      git commit -m "feat: $1 の仕様書を作成"
    ```
  - Step 10 へ継続（処理は中断しない）

### Step 10: 元ブランチに復帰

Bash ツールで元のブランチに復帰します。

```bash
git checkout "$ORIGINAL_BRANCH"
```

**エラーハンドリング:**

- ブランチ復帰に失敗した場合、警告メッセージを表示
- 手動で `git checkout $ORIGINAL_BRANCH` を実行するよう案内

---

## 成功メッセージ

全ての処理が完了したら、`AUTO_COMPLETE_SUCCESS` の値に応じて異なるメッセージを表示してください。

### Case 1: 自動完成成功（`AUTO_COMPLETE_SUCCESS` = true）

```text
✓ 仕様書を作成しました（要件定義を自動生成）

仕様書 ID: $SPEC_ID
名前: $1
フェーズ: requirements
ファイル: $SPEC_PATH
ブランチ: $BRANCH_NAME
元のブランチ: $ORIGINAL_BRANCH

自動生成された内容:
  - 背景と目的
  - 対象ユーザー
  - 受け入れ基準
  - 制約条件
  - 依存関係

次のステップ:
  1. 自動生成された内容を確認・調整する: /cft:spec-get <短縮ID>
  2. 設計フェーズに移行: /cft:spec-phase <短縮ID> design
  3. ブランチに切り替え: git checkout $BRANCH_NAME
```

### Case 2: 自動完成失敗（`AUTO_COMPLETE_SUCCESS` = false）

```text
✓ 仕様書を作成しました

⚠️ 自動要件定義に失敗しました。手動で編集してください。

仕様書 ID: $SPEC_ID
名前: $1
フェーズ: requirements
ファイル: $SPEC_PATH
ブランチ: $BRANCH_NAME
元のブランチ: $ORIGINAL_BRANCH

次のステップ:
  1. 仕様書を編集して要件を定義する
  2. 仕様書を表示: /cft:spec-get <短縮ID>
  3. 設計フェーズに移行: /cft:spec-phase <短縮ID> design
  4. ブランチに切り替え: git checkout $BRANCH_NAME
```

---

## エラーハンドリングまとめ

| ステップ | エラー | 対処 |
|---|---|---|
| Step 1 | UUID 生成失敗 | `crypto.randomUUID()` にフォールバック |
| Step 4.5 | BASE_BRANCH 読み込み失敗 | デフォルト値 `develop` を使用 |
| Step 4.6 | ユーザーが中断を選択 | 処理中断、ベースブランチ切り替えを案内 |
| Step 5 | BASE_BRANCH が存在しない | 処理中断、.env の設定確認を案内 |
| Step 5 | ブランチ作成失敗 | 処理中断、エラーメッセージ表示 |
| Step 6 | ファイル作成失敗 | 処理中断、エラーメッセージ表示 |
| Step 7 | コードベース解析失敗 | `ANALYSIS_RESULT` を空として記録、Step 8 へ継続 |
| Step 8 | 自動完成失敗 | `AUTO_COMPLETE_SUCCESS` を false として記録、Step 9 へ継続 |
| Step 9 | DB 登録失敗 | ロールバック処理実行（ファイル削除、ブランチ削除） |
| Step 9.5 | 自動コミット失敗 | 警告表示、手動コミットを案内、Step 10 へ継続 |
| Step 10 | ブランチ復帰失敗 | 警告表示、手動復帰を案内 |

### BASE_BRANCH が存在しない場合

```
❌ ベースブランチ '$BASE_BRANCH' が見つかりません

.env の BASE_BRANCH 設定を確認してください。

確認事項:
- ブランチ名が正しいか（例: develop, main）
- ローカルリポジトリにブランチが存在するか（git branch -a で確認）
- リモートからフェッチが必要か（git fetch origin）

対処法:
1. .env ファイルの BASE_BRANCH を修正
2. または、ブランチをフェッチ: git fetch origin $BASE_BRANCH:$BASE_BRANCH
```
