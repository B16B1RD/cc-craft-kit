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
| comp, done | completed | |

> **注意**: 4 フェーズモデル（requirements → design → implementation → completed）を推奨します。
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

`BRANCH_NAME` が null でない場合、Bash ツールで実行:

```bash
git checkout "$BRANCH_NAME"
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
- testing → テスト
- completed → 実装

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

   修正対象ファイル:
   - [ファイル1]
   - [ファイル2]

   次のステップ:
   - タスク一覧確認: /cft:task-list $SPEC_ID
   - タスク開始: /cft:task-start <issue-number>
   - 実装完了後: /cft:spec-phase $SPEC_ID completed
   ```

   エラーがある場合:
   ```
   ⚠️ 実装フェーズを開始しましたが、コード品質に問題があります

   [typescript-eslint の出力結果]

   推奨アクション:
   - 型エラーを修正してから実装を開始してください
   - npm run lint:fix で自動修正可能なエラーを修正
   ```

#### completed フェーズに移行した場合

Skill ツールで `pr-creator` スキルを実行:

- 仕様書 ID: `$SPEC_ID`
- 仕様書パス: `$SPEC_PATH`
- 仕様書名: `$SPEC_NAME`
- GitHub Issue 番号: `$GITHUB_ISSUE_NUMBER`

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
   - 出力を確認し、作成された Sub Issue の一覧を表示
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

有効なフェーズ（4 フェーズモデル）:
- requirements (req, reqs)
- design (des)
- implementation (impl, imp)
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
/cft:spec-phase f6621295 comp
```
