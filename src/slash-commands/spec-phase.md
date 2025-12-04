---
description: "仕様書のフェーズを更新します"
argument-hint: "<spec-id> <phase>"
---

# 仕様書フェーズ更新

仕様書を次のフェーズに移行します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$2` (必須): 新しいフェーズ（完全形または省略形）

### フェーズ名マッピング

| 入力 | 正規化後 | 備考 |
|------|----------|------|
| req, reqs | requirements | |
| des | design | |
| task | tasks | ⚠️ 非推奨 |
| impl, imp | implementation | |
| rev | review | PR 作成後のレビュー待ち |
| comp, done | completed | |

> **注意**: 5 フェーズモデル（requirements → design → implementation → review → completed）を推奨します。
> tasks フェーズは非推奨であり、design フェーズでタスク分割が自動実行されます。

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: フェーズ名の正規化

`$2` を上記マッピングテーブルに従って正規化します。
正規化後のフェーズを `NEW_PHASE` として記録してください。

### Step 2: 仕様書 ID の解決

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/spec/resolve-id.ts "$1"
```

出力（JSON）を解析し、以下を記録:

- `SPEC_ID`: 完全な仕様書 ID (`spec.id`)
- `SPEC_NAME`: 仕様書名 (`spec.name`)
- `CURRENT_PHASE`: 現在のフェーズ (`spec.phase`)
- `BRANCH_NAME`: 関連ブランチ名 (`spec.branch_name`)
- `SPEC_PATH`: 仕様書ファイルパス (`spec.spec_path`)
- `GITHUB_ISSUE_NUMBER`: GitHub Issue 番号 (`spec.github_issue_number`)

エラーの場合（`success: false`）:

- エラーメッセージを表示して処理を中断

### Step 3: ブランチ切り替え

`BRANCH_NAME` が null でない場合、以下の処理を実行:

#### 3.1 ベースブランチの取得

Bash ツールで `.env` から `BASE_BRANCH` を取得:

```bash
grep '^BASE_BRANCH=' .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "develop"
```

#### 3.2 ブランチ存在確認・自動作成

Bash ツールで実行:

```bash
# ブランチが存在するか確認
if git rev-parse --verify "$BRANCH_NAME" > /dev/null 2>&1; then
  echo "✓ ブランチ '$BRANCH_NAME' が見つかりました"
else
  echo "⚠️ ブランチ '$BRANCH_NAME' が見つかりません。自動作成を試みます..."

  # ベースブランチの存在確認
  if ! git rev-parse --verify "$BASE_BRANCH" > /dev/null 2>&1; then
    echo "❌ ベースブランチ '$BASE_BRANCH' が見つかりません"
    exit 1
  fi

  # ベースブランチから自動作成
  if git branch "$BRANCH_NAME" "$BASE_BRANCH"; then
    echo "✓ ブランチを作成しました: $BRANCH_NAME (from $BASE_BRANCH)"
  else
    echo "❌ ブランチ作成に失敗しました"
    exit 1
  fi
fi

# ブランチに切り替え
git checkout "$BRANCH_NAME"
```

**エラーハンドリング:**

- **ブランチが存在しない + 自動作成成功**: 処理続行
- **ベースブランチが存在しない**: 以下のエラーメッセージを表示して処理中断

```
❌ ブランチ操作に失敗しました

ブランチ: $BRANCH_NAME
ベースブランチ: $BASE_BRANCH (存在しません)

対処方法:
1. .env の BASE_BRANCH 設定を確認
2. ベースブランチをフェッチ: git fetch origin $BASE_BRANCH:$BASE_BRANCH
3. 再実行: /cft:spec-phase $SPEC_ID $NEW_PHASE
```

- **ブランチ作成失敗**: 以下のエラーメッセージを表示して処理中断

```
❌ ブランチ作成に失敗しました

ブランチ: $BRANCH_NAME

対処方法:
1. 同名ブランチが存在しないか確認: git branch -a | grep "$BRANCH_NAME"
2. 手動でブランチを作成: git branch "$BRANCH_NAME" "$BASE_BRANCH"
3. 再実行: /cft:spec-phase $SPEC_ID $NEW_PHASE
```

- **ブランチ切り替え失敗**: 以下のエラーメッセージを表示して処理中断

```
❌ ブランチ切り替えに失敗しました

ブランチ: $BRANCH_NAME

対処方法:
1. 未コミットの変更を確認: git status
2. 変更をスタッシュ: git stash
3. 手動で切り替え: git checkout "$BRANCH_NAME"
4. 再実行: /cft:spec-phase $SPEC_ID $NEW_PHASE
```

#### 3.3 ブランチ切り替え成功確認

Bash ツールで以下を実行:

```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" = "$BRANCH_NAME" ]; then
  echo "✓ ブランチを切り替えました: $CURRENT_BRANCH"
  echo ""
  echo "以下の仕様書ファイルを読み込みます:"
  echo "  $SPEC_PATH"
else
  echo "❌ ブランチの切り替えに失敗しました"
  echo ""
  echo "期待するブランチ: $BRANCH_NAME"
  echo "実際のブランチ: $CURRENT_BRANCH"
  exit 1
fi
```

**エラー時メッセージ:**

```
❌ ブランチ切り替え後の状態確認に失敗しました

ブランチ: $BRANCH_NAME
現在のブランチ: $CURRENT_BRANCH

対処方法:
1. 手動でブランチを確認: git branch -v
2. 手動で切り替え: git checkout "$BRANCH_NAME"
3. 再実行: /cft:spec-phase $SPEC_ID $NEW_PHASE
```

### Step 3.5: GitHub Issue 連携状態確認

`GITHUB_ISSUE_NUMBER` を確認し、GitHub Issue との連携状態を検証します。

**判定ロジック:**

```
GITHUB_ISSUE_NUMBER が null の場合:
  → 警告を表示し、処理を継続するか確認

GITHUB_ISSUE_NUMBER が null でない場合:
  → Step 4 へ進む
```

**警告メッセージ（GITHUB_ISSUE_NUMBER が null の場合）:**

```
⚠️ 警告: この仕様書には GitHub Issue が関連付けられていません

仕様書: $SPEC_NAME
現在のフェーズ: $CURRENT_PHASE → $NEW_PHASE

GitHub Issue を作成すると、以下の機能が利用できます:
  - フェーズ移行時の自動ラベル更新
  - 進捗・エラー・Tips の自動コメント追加
  - completed フェーズでの自動クローズ
  - GitHub Projects との連携

対処方法:
1. GitHub Issue を作成: /cft:github-issue-create $SPEC_ID
2. GitHub 統合を初期化（未設定の場合）: /cft:github-init <owner> <repo>
```

**AskUserQuestion:**

- question: "GitHub Issue なしで $NEW_PHASE フェーズに移行しますか？"
- header: "Issue"
- options:
  - label: "このまま続行"
    description: "GitHub Issue 連携なしでフェーズを移行します"
  - label: "中断して Issue を作成"
    description: "/cft:github-issue-create を実行してから再度移行します"
- multiSelect: false

**ユーザー選択:**

- 「このまま続行」: Step 4 へ進む
- 「中断して Issue を作成」: 処理を中断し、以下のメッセージを表示:

```
処理を中断しました。

GitHub Issue を作成してから再実行してください:
  /cft:github-issue-create $SPEC_ID
  /cft:spec-phase $SPEC_ID $NEW_PHASE
```

### Step 4: バリデーション（プロンプト内実行）

Read ツールで仕様書ファイル (`SPEC_PATH`) を読み込み、以下を検証:

#### requirements → design の場合

1. 以下のセクションが存在し、プレースホルダー（"記述してください"、"TODO"、"TBD" など）がないこと:
   - `## 1. 背景と目的`
   - `## 2. 対象ユーザー`
   - `## 3. 受け入れ基準`

2. バリデーションエラー時:
   - エラーメッセージを表示
   - Task ツールで Explore サブエージェント (thoroughness: "medium") を実行して関連情報を収集
   - AskUserQuestion または Edit ツールで不足セクションを補完
   - 補完後、このコマンドを再実行（`/cft:spec-phase $1 design`）
   - **処理を中断**

#### design → tasks の場合（非推奨）

> ⚠️ **非推奨警告**: tasks フェーズは非推奨です。
> design フェーズでタスク分割が自動的に実行されるため、直接 implementation フェーズへ移行してください。
> `/cft:spec-phase $SPEC_ID impl`

以下の警告メッセージを表示してから処理を継続:

```
⚠️ 警告: tasks フェーズは非推奨です

design フェーズでタスク分割が自動的に実行されるようになりました。
推奨される次のステップ:
- 実装開始: /cft:spec-phase $SPEC_ID impl

tasks フェーズへの移行を続行しますか？
```

AskUserQuestion ツールで確認:
- 続行する場合: 従来通りの処理を実行
- 中断する場合: 処理を中止し、implementation フェーズへの移行を案内

1. 以下のセクションが存在すること:
   - `## 7. 設計詳細`
   - 7.x. アーキテクチャ設計（サブセクション）
   - 7.x. テスト戦略（サブセクション）

2. バリデーションエラー時:
   - エラーメッセージを表示
   - Task ツールで Explore サブエージェント (thoroughness: "medium") を実行
   - Edit ツールで設計詳細セクションを自動生成
   - 補完後、このコマンドを再実行
   - **処理を中断**

### Step 4.5: 品質チェック（review フェーズ移行時のみ）

`NEW_PHASE` が `review` の場合のみ、以下の品質チェックを実行します。

> **目的**: PR 作成前に TypeScript 型チェックと ESLint を実行し、CI が失敗する PR の作成を防止します。

#### 4.5.1 品質チェック実行

Skill ツールで `typescript-eslint` スキルを実行します。

スキル実行後、以下のコマンドを並列で実行:

```bash
# TypeScript 型チェック
npm run typecheck 2>&1

# ESLint チェック
npm run lint 2>&1
```

#### 4.5.2 TypeScript・ESLint 結果判定

**両方のチェックが成功した場合（終了コード 0）:**

→ Step 4.5.3 へ進む。

**いずれかのチェックが失敗した場合:**

```
❌ 品質チェック失敗 - PR 作成をスキップします

仕様書: $SPEC_NAME
フェーズ遷移: implementation → review （中断）

=== エラー内容 ===

[TypeScript エラーがある場合]
📋 TypeScript 型エラー:
[npm run typecheck の出力]

[ESLint エラーがある場合]
📋 ESLint エラー:
[npm run lint の出力]

=== 修正ガイダンス ===

以下の手順でエラーを修正してください:

1. 型エラーの修正:
   - エラーメッセージの該当ファイル・行を確認
   - 型定義を追加/修正

2. ESLint エラーの自動修正（可能な場合）:
   npm run lint -- --fix

3. 修正後、再度 review フェーズへ移行:
   /cft:spec-phase $SPEC_ID review

注意: 品質チェックが成功するまで PR は作成されません。
これにより CI が失敗する PR の作成を防止しています。
```

**処理を中断**（DB 更新・pr-creator 呼び出しをスキップ）

#### 4.5.3 テスト実行

TypeScript・ESLint チェック成功後、テストを実行します:

```bash
# テスト実行
npm test 2>&1
```

> **注意**: `npm test` コマンドが存在しない場合やテストが設定されていない場合は、このステップをスキップして Step 4.5.4 へ進みます。

#### 4.5.4 最終結果判定と分岐

**すべてのチェックが成功した場合:**

```
✓ 品質チェック完了

TypeScript: ✓ 型エラーなし
ESLint: ✓ 警告/エラーなし
テスト: ✓ 全テスト合格

→ PR 作成に進みます...
```

Step 5 へ進む。

**テストが失敗した場合:**

```
❌ 品質チェック失敗 - PR 作成をスキップします

仕様書: $SPEC_NAME
フェーズ遷移: implementation → review （中断）

=== エラー内容 ===

📋 テスト失敗:
[npm test の出力]

=== 修正ガイダンス ===

以下の手順でテストを修正してください:

1. 失敗したテストの確認:
   - テスト出力のエラーメッセージを確認
   - 該当するテストファイルと行番号を特定

2. テストの修正:
   - 実装コードの修正（テストが正しい場合）
   - テストコードの修正（実装が正しい場合）

3. 修正後、再度 review フェーズへ移行:
   /cft:spec-phase $SPEC_ID review

注意: すべてのチェックが成功するまで PR は作成されません。
これにより CI が失敗する PR の作成を防止しています。
```

**処理を中断**（DB 更新・pr-creator 呼び出しをスキップ）

### Step 5: DB 更新 + イベント発火

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/spec/update-phase.ts "$SPEC_ID" "$NEW_PHASE"
```

出力（JSON）を解析:

- `success: true` の場合: 次のステップへ
- `success: false` の場合: エラーメッセージを表示して処理を中断

### Step 6: Markdown ファイル更新

Edit ツールで仕様書ファイル (`SPEC_PATH`) を更新:

1. フェーズ行を更新:
   - 検索: `**フェーズ:** <CURRENT_PHASE>`
   - 置換: `**フェーズ:** <NEW_PHASE>`

2. 更新日時を更新:
   - 検索: `**更新日時:** .*`
   - 置換: `**更新日時:** <現在日時（YYYY/MM/DD HH:mm:ss 形式）>`

### Step 7: 自動コミット

Bash ツールで以下を実行:

```bash
git add "$SPEC_PATH" && git commit -m "feat: $SPEC_NAME の$(NEW_PHASE の日本語名)を完了"
```

日本語名マッピング:

- requirements → 要件定義
- design → 設計
- tasks → タスク分解
- implementation → 実装開始
- review → レビュー待ち
- completed → 完了

### Step 8: フェーズ固有の後処理

#### tasks フェーズに移行した場合

1. 仕様書の「## 3. 受け入れ基準」セクションを解析
2. TodoWrite ツールでタスクリストを生成（各受け入れ基準を実装可能な単位に分解）
3. Edit ツールで仕様書の末尾に「## 8. 実装タスクリスト」セクションを追加
   - 各タスクをマークダウンのチェックボックス形式で記載

#### implementation フェーズに移行した場合

1. **実装タスクリスト読み込み**:
   - Read ツールで仕様書（`$SPEC_PATH`）を読み込み
   - 「## 8. 実装タスクリスト」セクションを抽出
   - セクションが存在しない場合:
     ```
     ⚠️ 警告: 実装タスクリストが見つかりません

     design フェーズでタスクリストが生成されていない可能性があります。
     推奨アクション: /cft:spec-phase $SPEC_ID design を再実行
     ```
     **処理を中断**

1.5. **タスク粒度バリデーション（ベストプラクティス）**:

   Long-running Agents のベストプラクティスに基づき、タスクの粒度を検証します。

   ##### 1.5.1 タスク数チェック

   タスクリストのチェックボックス（`- [ ]`）を数える。

   **タスク数が 3 未満の場合**:
   ```
   ⚠️ タスク粒度の警告: タスク数が少なすぎます

   現在のタスク数: {タスク数}
   推奨: 最低 3 タスク以上に分割

   段階的実装のベストプラクティス:
   - 一度にすべてを実装しようとせず、小さな単位に分割
   - 各タスクは 1-2 時間で完了できる粒度が理想

   タスクを分割しますか？
   ```

   AskUserQuestion ツールで確認:
   - **分割する**: `/cft:task-split` を案内して処理を中断
   - **このまま続行**: 警告を記録して続行

   ##### 1.5.2 曖昧表現チェック

   各タスク内容に以下の曖昧な表現が含まれていないかチェック:
   - 「全て実装」「完全に」「すべての」
   - 「〜など」「〜等」
   - 「その他」「残り」
   - 「全体を」「一通り」

   **曖昧表現が見つかった場合**:
   ```
   ⚠️ タスク粒度の警告: 曖昧な表現が含まれています

   問題のあるタスク:
   - タスク #{番号}: "{タスク内容}"
     → 「{曖昧表現}」は具体的な作業範囲が不明確です

   推奨:
   - 具体的なファイル名や機能名を指定
   - 1 タスク = 1 つの明確な成果物

   例:
   ❌ 「認証機能を全て実装」
   ✓ 「ログインフォームのUI作成」
   ✓ 「パスワードバリデーション実装」
   ✓ 「セッション管理の実装」

   タスクを修正しますか？
   ```

   AskUserQuestion ツールで確認:
   - **修正する**: Edit ツールでタスク内容を修正
   - **このまま続行**: 警告を記録して続行

   ##### 1.5.3 タスク粒度サマリー

   ```
   ✓ タスク粒度チェック完了

   タスク数: {タスク数}
   曖昧表現: {あり/なし}
   推定作業量: {タスク数 * 1-2 時間}
   ```

2. **タスク解析・進捗管理開始**:
   - マークダウンのチェックボックス形式（`- [ ]` / `- [x]`）を解析
   - TodoWrite ツールでタスクリストを登録:
     - 完了済み（`- [x]`）: status = "completed"
     - 未完了（`- [ ]`）: status = "pending"
   - 最初の未完了タスクを in_progress に設定

3. **設計詳細確認**:
   - 「## 7. 設計詳細 → 7.2 実装方針 → 修正対象ファイル」を確認
   - 修正対象ファイルの一覧を表示

4. **型チェック・リント実行**:
   - Skill ツールで `typescript-eslint` スキルを実行

5. **結果表示・ガイダンス**:

   エラーがない場合:
   ```
   ✓ 実装フェーズを開始しました

   仕様書: $SPEC_NAME
   フェーズ: $CURRENT_PHASE → implementation

   タスク進捗: X/Y 完了
   型チェック・リント: ✓ エラーなし

   修正対象ファイル:
   - [ファイル1]
   - [ファイル2]

   → 実装を自動開始します...
   ```

   エラーがある場合:
   ```
   ⚠️ 実装フェーズを開始しましたが、コード品質に問題があります

   [typescript-eslint の出力結果]

   推奨アクション:
   - 型エラーを修正してから実装を開始してください
   - npm run lint:fix で自動修正可能なエラーを修正
   ```

6. **実装自動開始**:

   > **重要**: このステップは型チェック・リントがエラーなしの場合のみ実行されます。
   > エラーがある場合は、上記のガイダンスを表示して**処理を中断**してください。

   型チェック・リントがクリーンな場合、以下の処理を**自動的に実行**してください:

   ##### 6.1 現在のタスク情報表示 + Sub Issue ステータス更新

   1. TodoWrite で in_progress に設定した最初のタスクの内容を表示:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📋 実装開始: タスク 1/{総タスク数}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   タスク内容:
   {最初のタスクの内容} (#{SUB_ISSUE_NUMBER})

   修正対象ファイル:
   - {修正対象ファイル1}
   - {修正対象ファイル2}
   ```

   2. **Sub Issue を In Progress に更新**:
      - タスク内容から Sub Issue 番号（`(#XXX)` 形式）を抽出
      - Bash ツールで以下を実行:
        ```bash
        npx tsx .cc-craft-kit/commands/task/start.ts {SUB_ISSUE_NUMBER}
        ```
      - `task.started` イベントが発火され、Projects ステータスが自動的に In Progress に更新される

   ##### 6.2 修正対象ファイル読み込み

   - Read ツールで「## 7. 設計詳細 → 7.2 実装方針 → 修正対象ファイル」に記載されたファイルを読み込み
   - 各ファイルの現在の実装内容を確認

   ##### 6.3 タスク実装実行

   > **重要**: ここから実際のコード実装を開始します。ユーザーの追加指示を待たずに実装を進めてください。

   1. 最初のタスクの内容に基づき、修正対象ファイルを Edit ツールで編集
   2. 実装中は以下の原則に従う:
      - プロンプトファースト原則: Claude Code ツールで完結できる処理はプロンプト層で実装
      - 既存のアーキテクチャパターン・コーディング規約を踏襲
      - 受け入れ基準を満たす実装を行う

   ##### 6.4 タスク完了処理

   タスクの実装が完了したら:

   1. **仕様書のタスクリスト更新**:
      - Edit ツールで仕様書（`$SPEC_PATH`）の「## 8. 実装タスクリスト」セクションを更新
      - 完了したタスクのチェックボックスを `- [x]` に変更

   2. **TodoWrite 更新**:
      - 完了したタスクを `completed` に設定
      - 次の未完了タスクを `in_progress` に設定

   3. **自動コミット**:
      - 変更したファイルをステージング
      - コミットメッセージ: `feat($SPEC_NAME): {タスク内容の要約}`

   4. **Sub Issue を Done に更新 + クローズ**:
      - 完了したタスクの Sub Issue 番号（`(#XXX)` 形式）を抽出
      - Bash ツールで以下を実行:
        ```bash
        npx tsx .cc-craft-kit/commands/task/done.ts {SUB_ISSUE_NUMBER}
        ```
      - `task.completed` イベントが発火され、以下が自動実行される:
        - Sub Issue がクローズ
        - Projects ステータスが Done に更新
        - 全 Sub Issue がクローズされた場合、親 Issue も自動クローズ

   5. **次のタスクへの遷移**:
      - 未完了タスクがある場合: Step 6.1 に戻り、次のタスクを開始
      - すべてのタスクが完了した場合: 完了ガイダンスを表示

   ##### 6.5 全タスク完了時のガイダンス

   すべてのタスクが完了したら:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✓ すべてのタスクが完了しました
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   仕様書: $SPEC_NAME
   完了タスク: {総タスク数}/{総タスク数}

   次のステップ:
   - 型チェック・リント再実行: npm run typecheck && npm run lint
   - テスト実行: npm test
   - レビューフェーズへ移行: /cft:spec-phase $SPEC_ID review
   ```

#### review フェーズに移行した場合

> **目的**: PR を作成し、コードレビューを受ける準備をします。

Skill ツールで `pr-creator` スキルを実行:

- 仕様書 ID: `$SPEC_ID`
- 仕様書パス: `$SPEC_PATH`
- 仕様書名: `$SPEC_NAME`
- GitHub Issue 番号: `$GITHUB_ISSUE_NUMBER`

PR 作成後のガイダンス:

```
✓ review フェーズに移行しました

仕様書: $SPEC_NAME
フェーズ: implementation → review

PR が作成されました。GitHub 上でコードレビューを受けてください。

次のステップ:
1. PR のレビューを依頼
2. レビューコメントに対応
3. PR を GitHub 上でマージ
4. 完了フェーズへ移行: /cft:spec-phase $SPEC_ID completed
```

#### completed フェーズに移行した場合

> **目的**: PR がマージされた後の後処理を実行します。
> このフェーズでは、ブランチ削除と Issue クローズが自動的に実行されます。

##### Step 8.0: 現在のブランチを確認

Bash ツールで以下を実行:

```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "現在のブランチ: $CURRENT_BRANCH"
echo "削除対象ブランチ: $BRANCH_NAME"
```

##### Step 8.1: 削除対象ブランチと同一か判定

現在のブランチ（`CURRENT_BRANCH`）と削除対象ブランチ（`BRANCH_NAME`）を比較:

- **同一の場合**: Step 8.2 へ進む
- **異なる場合**: Step 8.3 へ進む（ブランチ切り替え不要）

```bash
if [ "$CURRENT_BRANCH" = "$BRANCH_NAME" ]; then
  echo "⚠️ 現在のブランチが削除対象です。ベースブランチに切り替えます..."
  # Step 8.2 へ
else
  echo "✓ 別ブランチにいます。そのまま処理を続行します。"
  # Step 8.3 へ
fi
```

##### Step 8.2: ベースブランチへの自動切り替え

> **前提**: Step 8.1 で現在のブランチと削除対象が同一と判定された場合のみ実行

1. **未コミット変更チェック**:

   ```bash
   if [ -n "$(git status --porcelain)" ]; then
     echo "⚠️ 未コミットの変更があります"
     git status --short
     echo ""
     echo "変更を自動コミットします..."
     git add -A
     git commit -m "chore: completed フェーズ移行前の自動コミット"
   fi
   ```

2. **ベースブランチに切り替え**:

   ```bash
   git checkout "$BASE_BRANCH"
   ```

   **エラー時**:
   ```
   ❌ ベースブランチへの切り替えに失敗しました

   ベースブランチ: $BASE_BRANCH
   現在のブランチ: $CURRENT_BRANCH

   対処方法:
   1. ベースブランチの存在確認: git branch -a | grep "$BASE_BRANCH"
   2. 手動で切り替え: git checkout "$BASE_BRANCH"
   3. 再実行: /cft:spec-phase $SPEC_ID completed
   ```

3. **切り替え成功確認**:

   ```bash
   NEW_CURRENT=$(git rev-parse --abbrev-ref HEAD)
   if [ "$NEW_CURRENT" = "$BASE_BRANCH" ]; then
     echo "✓ $BASE_BRANCH に切り替えました"
   else
     echo "❌ ブランチ切り替えに失敗しました"
     exit 1
   fi
   ```

##### Step 8.3: 前提条件確認

1. PR が GitHub 上でマージ済みであること
2. PR がマージされていない場合は、以下のメッセージを表示して処理を中断:

```
❌ PR がマージされていません

completed フェーズに移行するには、PR が GitHub 上でマージされている必要があります。

対処方法:
1. GitHub で PR をマージ
2. 再度実行: /cft:spec-phase $SPEC_ID completed

または、review フェーズに戻る: /cft:spec-phase $SPEC_ID review
```

##### Step 8.4: 後処理実行

completed フェーズへの遷移時は、以下の処理が `github-integration.ts` で自動実行されます:

1. **pr-cleanup 処理**: ローカル/リモートブランチの削除、DB 更新
2. **GitHub Issue クローズ**: 完了コメント追加後にクローズ
3. **GitHub Projects ステータス更新**: Done に設定

ガイダンス:

```
✓ completed フェーズに移行しました

仕様書: $SPEC_NAME
フェーズ: review → completed

実行された処理:
- ベースブランチに切り替え: $BASE_BRANCH（削除対象ブランチにいた場合のみ）
- ローカルブランチ削除: $BRANCH_NAME
- リモートブランチ削除: $BRANCH_NAME
- GitHub Issue #$GITHUB_ISSUE_NUMBER をクローズ
- GitHub Projects ステータス: Done

おめでとうございます！この仕様書の実装が完了しました。
```

#### design フェーズに移行した場合

> **注意**: design フェーズでは詳細設計とタスク分割を同時に実行します。
> tasks フェーズは非推奨となり、design → implementation への直接遷移を推奨します。

1. **コードベース解析**:
   - Task ツールで Explore サブエージェントを実行（thoroughness: "medium"）
   - プロンプト:
     ```
     仕様書「$SPEC_NAME」の設計を行うため、以下の観点でコードベースを解析してください:

     ## 解析対象
     - 仕様書の「## 5. 依存関係」に記載されたファイル
     - 既存の類似機能の実装パターン
     - 関連するテストファイル

     ## 解析観点
     1. 修正対象ファイルの特定と現在の実装内容
     2. 既存のアーキテクチャパターン・設計規約
     3. 命名規則・コーディングスタイル
     4. 類似機能の実装例（参考にできるパターン）
     5. テスト戦略（既存テストの構成）

     ## 出力形式
     - 各ファイルの役割と現在の実装概要
     - 設計上の考慮点・制約
     - 推奨される実装アプローチ
     ```

2. **ユーザー確認**（不明点がある場合）:
   - 解析結果に基づき、以下のような不明点がある場合に AskUserQuestion ツールで問い合わせ:
     - アーキテクチャパターンの選択（複数の実装方法がある場合）
     - 実装方針の確認（既存パターンを踏襲するか、新しいアプローチを取るか）
     - 外部統合・依存関係の確認
   - 質問は最大 2-3 項目に絞る
   - 明確に判断できる場合は質問をスキップして次へ進む

3. **設計詳細セクション生成**:
   - Edit ツールで仕様書（`$SPEC_PATH`）に「## 7. 設計詳細」セクションを追加
   - 以下のサブセクションを含める:

   ```markdown
   ## 7. 設計詳細

   ### 7.1 アーキテクチャ設計

   #### 全体構成
   [コードベース解析結果に基づく全体構成図（テキストベース）]

   #### 設計方針
   [採用する設計パターン・アプローチの説明]

   #### 処理フロー詳細
   [主要な処理フローの説明（テキストベースの図を含む）]

   ### 7.2 実装方針

   #### 修正対象ファイル
   | ファイル | 変更内容 |
   |---------|---------|
   | [ファイルパス] | [変更内容の概要] |

   #### [追加のサブセクション（必要に応じて）]

   ### 7.3 機能マッピング

   | 機能 | 現在の実装 | 新しい実装 | 実装場所 |
   |-----|----------|----------|---------|
   | [機能名] | [現在の状態] | [新しい実装内容] | [ファイル・セクション] |

   ### 7.4 テスト戦略

   | テスト対象 | テスト内容 | 検証方法 |
   |----------|----------|---------|
   | [対象] | [内容] | [方法] |

   ### 7.5 移行計画

   #### Phase 1: [フェーズ名]
   1. [ステップ 1]
   2. [ステップ 2]

   #### Phase 2: [フェーズ名]
   [以下同様]
   ```

4. **タスクリスト生成**（design フェーズで統合実行）:
   - 仕様書の「## 3. 受け入れ基準」と「## 7. 設計詳細」セクションを解析
   - TodoWrite ツールでタスクリストを生成（各受け入れ基準・設計項目を実装可能な単位に分解）
   - Edit ツールで仕様書の末尾に「## 8. 実装タスクリスト」セクションを追加
     - 各タスクをマークダウンのチェックボックス形式で記載
     - Phase 単位でグループ化（設計詳細の移行計画に対応）

   ```markdown
   ## 8. 実装タスクリスト

   ### Phase 1: [フェーズ名]

   - [ ] [タスク 1: 具体的な実装内容]
   - [ ] [タスク 2: 具体的な実装内容]

   ### Phase 2: [フェーズ名]

   - [ ] [タスク 3: 具体的な実装内容]
   - [ ] [タスク 4: 具体的な実装内容]
   ```

5. **Sub Issue 自動作成**（GitHub Issue が存在する場合）:
   - `GITHUB_ISSUE_NUMBER` が null でない場合のみ実行
   - Bash ツールで以下を実行:
   ```bash
   npx tsx .cc-craft-kit/commands/github/create-sub-issues.ts "$SPEC_ID"
   ```
   - 出力（JSON）を解析し、作成された Sub Issue の一覧を取得
   - **タスクリストに Sub Issue 番号を追記**:
     - Edit ツールで「## 8. 実装タスクリスト」セクションの各タスクに Sub Issue 番号を追加
     - 形式: `- [ ] [タスク内容] (#XXX)`
     - 例: `- [ ] getSubIssueInfo で parent_spec_id を取得 (#485)`
   - エラー時は警告を表示し、手動での Sub Issue 作成を案内（処理は継続）

6. **設計追加の自動コミット**:
   - Bash ツールで以下を実行:
   ```bash
   git add "$SPEC_PATH" && git commit -m "feat: $SPEC_NAME の設計を完了"
   ```

7. **ガイダンスメッセージ表示**:
   ```
   ✓ 設計フェーズを完了しました

   仕様書: $SPEC_NAME
   フェーズ: $CURRENT_PHASE → design

   生成されたセクション:
   - 7.1 アーキテクチャ設計
   - 7.2 実装方針
   - 7.3 機能マッピング
   - 7.4 テスト戦略
   - 7.5 移行計画
   - 8. 実装タスクリスト

   [GitHub Issue が存在する場合]
   Sub Issue:
   - #XX: [タスク名]
   - #YY: [タスク名]
   ...

   次のステップ:
   - 設計内容を確認: /cft:spec-get $SPEC_ID
   - 実装開始: /cft:spec-phase $SPEC_ID impl
   ```

#### その他のフェーズ（requirements, testing）

ガイダンスメッセージを表示:

```
✓ フェーズを更新しました

仕様書: $SPEC_NAME
フェーズ: $CURRENT_PHASE → $NEW_PHASE

次のステップ:
- 仕様書の詳細確認: /cft:spec-get $SPEC_ID
- GitHub Issue 作成: /cft:github-issue-create $SPEC_ID
- 次のフェーズに移行: /cft:spec-phase $SPEC_ID <next-phase>
```

### Step 9: git status チェック（必須・自動実行）

Bash ツールで以下を実行:

```bash
git status --porcelain
```

#### 出力が空の場合

```
✓ すべての変更がコミット済みです。

フェーズ移行が正常に完了し、すべての変更が自動コミットされました。

次のステップ:
- GitHub Issue を更新: /cft:spec-update $SPEC_ID
- 仕様書の詳細確認: /cft:spec-get $SPEC_ID
- 次のフェーズに移行: /cft:spec-phase $SPEC_ID <next-phase>
```

#### 出力が空でない場合

```
⚠️ 警告: フェーズ移行後も未コミットファイルが残っています。

未コミットファイル一覧:
[git status --porcelain の出力]

説明:
自動コミットは仕様書ファイル (.cc-craft-kit/specs/<spec-id>.md) のみを対象としています。
その他のファイル（ソースコード、テストなど）は手動でコミットする必要があります。

推奨アクション:

1. 特定のファイルのみをコミットする場合:
   git add <file-path>
   git commit -m "適切なコミットメッセージ"

2. すべての変更をコミットする場合:
   git add .
   git commit -m "適切なコミットメッセージ"

3. 変更を破棄する場合:
   git restore <file-path>
```

---

## エラーハンドリング

### 仕様書が見つからない場合

```
❌ 仕様書が見つかりません: $1

確認事項:
- 仕様書 ID は最低 8 文字必要です
- /cft:spec-list で仕様書一覧を確認してください
```

### 無効なフェーズ名の場合

```
❌ 無効なフェーズ名: $2

有効なフェーズ（5 フェーズモデル）:
- requirements (req, reqs)
- design (des)
- implementation (impl, imp)
- review (rev)
- completed (comp, done)

非推奨フェーズ:
- tasks (task) ⚠️ design フェーズでタスク分割が自動実行されます
```

### Git 操作失敗時

- ブランチ切り替え失敗: エラーメッセージを表示し、手動でのブランチ切り替えを案内
- コミット失敗: エラーメッセージを表示し、手動でのコミットを案内

---

## 使用例

```bash
# 完全形
/cft:spec-phase f6621295 design

# 省略形
/cft:spec-phase f6621295 des
/cft:spec-phase f6621295 impl
/cft:spec-phase f6621295 rev
/cft:spec-phase f6621295 comp
```
