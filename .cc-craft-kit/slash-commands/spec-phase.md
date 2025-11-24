---
description: "仕様書のフェーズを更新します"
argument-hint: "<spec-id> <phase>"
---

# 仕様書フェーズ更新

仕様書を次のフェーズに移行します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$2` (必須): 新しいフェーズ（完全形または省略形）

### フェーズ名（完全形）

- `requirements` - 要件定義
- `design` - 設計
- `tasks` - タスク分解
- `implementation` - 実装
- `testing` - テスト
- `completed` - 完了

### フェーズ名（省略形）

ユーザーフレンドリーな省略形もサポートしています。

- `req`, `reqs` → requirements
- `des` → design
- `task` → tasks
- `impl`, `imp` → implementation
- `test` → testing
- `comp`, `done` → completed

## 実行内容

1. データベースと Markdown ファイルのフェーズ更新
2. 更新日時の記録
3. フェーズ固有のガイダンス表示

## 使用例

```bash
# 完全形
/cft:spec-phase f6621295 design

# 省略形
/cft:spec-phase f6621295 des
/cft:spec-phase f6621295 impl
/cft:spec-phase f6621295 comp
```

---

以下のコマンドを実行して仕様書のフェーズを更新してください。

```bash
npx tsx .cc-craft-kit/commands/spec/phase.ts "$1" "$2"
```

## フェーズ移行時の自動処理

### フェーズ移行前のバリデーションと自動補完

コマンド実行後、バリデーションエラーが表示された場合は、以下の処理を**自動的に実行**してください。

#### requirements → design への遷移でバリデーションエラーが出た場合

1. **仕様書ファイルを読み込む**: Read ツールで `.cc-craft-kit/specs/$1.md` を読み込む
2. **不足セクションを確認**: エラーメッセージから不足しているセクションを特定
3. **コードベース解析**: Task ツールで Explore サブエージェント (thoroughness: "medium") を実行
   - 関連する既存実装を調査
   - 類似機能のパターンを検索
4. **既存仕様書から学習**: Glob ツールで `.cc-craft-kit/specs/*.md` から類似仕様書を検索
5. **自動補完**:
   - 推論可能な情報（背景、目的、制約条件など）を Edit ツールで追記
   - 推論困難な情報（具体的な要件など）は AskUserQuestion ツールで質問（最大4つまで）
6. **再実行**: 補完完了後、`/cft:spec-phase $1 design` を再実行

#### design → tasks への遷移でバリデーションエラーが出た場合

1. **仕様書ファイルを読み込む**: Read ツールで `.cc-craft-kit/specs/$1.md` を読み込む
2. **設計詳細セクション (## 7. 設計詳細) の生成**:
   - 要件定義セクション (1-5) を分析
   - コードベース解析で既存アーキテクチャパターンを調査
   - 以下のサブセクションを自動生成:
     - 7.1. アーキテクチャ設計
     - 7.2. データモデル（該当する場合）
     - 7.3. API の仕様（該当する場合）
     - 7.4. セキュリティ考慮事項
     - 7.5. テスト戦略
3. **Edit ツールで仕様書を更新**
4. **再実行**: 補完完了後、`/cft:spec-phase $1 tasks` を再実行

### フェーズ移行後の自動処理

重要: フェーズ移行が完了したら、ユーザーに確認を求めずに、以下の処理を**自動的に実行**してください。

### tasks フェーズに移行した場合

1. **仕様書ファイルを読み込む**: Read ツールで `.cc-craft-kit/specs/$1.md` を読み込む
2. **受け入れ基準を解析**:「3. 受け入れ基準」セクションを確認し、実装すべき機能を理解する
3. **タスクリストを生成**: TodoWrite ツールで実装タスクリストを作成する
   - 各受け入れ基準を実装可能な単位に分解
   - 依存関係と優先度を設定
4. **仕様書にタスクセクションを追加**: Edit ツールで仕様書ファイルの末尾に「## 8. 実装タスクリスト」セクションを追加
5. **GitHub へ通知**: `/cft:spec-update $1` で GitHub Issue の更新を通知

### implementation フェーズに移行した場合

1. **仕様書ファイルを読み込む**: Read ツールで `.cc-craft-kit/specs/$1.md` を読み込む
2. **タスクリストを確認**:「8. 実装タスクリスト」セクションを確認
3. **TodoWrite でタスクを表示**: TodoWrite ツールでタスクリストを表示し、進捗管理を開始

#### 実装開始前の品質チェック（自動実行）

実装を開始する前に、以下の品質チェックを**自動的に実行**してください。

1. **TypeScript/ESLint スキルで既存コードをチェック**:
   - Skill ツールで `typescript-eslint` スキルを実行
   - 型エラーや ESLint 警告がある場合は、修正してから実装を開始
   - `npm run lint` と `npx tsc --noEmit` を実行して確認

#### 実装作業の開始

1. **最初のタスクを開始**: タスクリストの最初の未完了タスクを in_progress に設定
2. **実装を開始**:
   - 対象ファイルを Read ツールで読み込む
   - Edit ツールで必要な変更を実施
   - タスク完了後、以下の品質チェックを実行：
     - Task ツールで `test-generator` サブエージェントを実行し、単体テストを生成
     - Task ツールで `code-reviewer` サブエージェントを実行し、コード品質を検証
   - TodoWrite で completed に設定
   - 次のタスクへ自動的に移行

### completed フェーズに移行した場合

重要: コマンド実行後、ユーザーに確認を求めずに、以下の処理を**自動的に実行**してください。

#### Step 1: 未コミット変更確認

1. **未コミット変更検出**: Bash ツールで `git status --porcelain` 実行
2. **警告表示**:
   - 出力が空でない場合: 「未コミット変更があります。PR 作成前にコミットしてください」と警告表示
   - 出力が空の場合: 次のステップへ進む

#### Step 2: PR 作成準備

1. **仕様書読み込み**: Read ツールで `.cc-craft-kit/specs/$1.md` を読み込む
2. **PR タイトル生成**: 仕様書名から自動生成
   - 形式: `feat: <仕様書名> を実装完了`
3. **PR 本文生成**: 仕様書から抽出
   - Summary: 「1. 背景と目的」「3. 受け入れ基準」を要約
   - Test plan: 実装済みテスト概要を記載
   - 署名: "🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>"

#### Step 3: GitHub CLI 認証確認

1. **認証状態確認**: Bash ツールで `gh auth status` 実行
2. **エラーハンドリング**:
   - 認証失敗時: `gh auth login` を実行するよう案内し、処理を中断
   - 成功時: 次のステップへ進む

#### Step 4: ブランチリモートプッシュ

1. **現在のブランチ名取得**: Bash ツールで `git branch --show-current` 実行
2. **リモート追跡確認**: Bash ツールで `git branch -vv | grep '*'` 実行
3. **リモートプッシュ**:
   - リモート追跡がない場合: `git push -u origin <現在のブランチ>` 実行
   - リモート追跡がある場合: `git push` 実行（最新の変更をプッシュ）

#### Step 5: PR 作成

1. **PR 作成**: Bash ツールで `gh pr create` 実行
   ```bash
   gh pr create \
     --title "feat: <仕様書名> を実装完了" \
     --body "$(cat <<'EOF'
   ## Summary

   <「1. 背景と目的」と「3. 受け入れ基準」を要約>

   ## Test plan

   - [ ] 単体テスト実施
   - [ ] 統合テスト実施
   - [ ] コードレビュー完了

   ---

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

2. **PR URL 取得**: コマンド出力から URL を取得
   - 例: `https://github.com/owner/repo/pull/42`

3. **PR 番号抽出**: URL から PR 番号を抽出
   - 正規表現: `/pull/(\d+)$`

#### Step 6: PR 情報記録

1. **仕様書ファイル更新**: Edit ツールで仕様書の末尾に PR セクション追加
   ```markdown
   ## Pull Request

   **PR 番号:** #42
   **PR URL:** https://github.com/owner/repo/pull/42
   **PR 作成日時:** 2025/11/24 23:30:00
   ```

2. **github_sync テーブル更新**: Bash ツールで `update-pr.ts` 実行
   ```bash
   npx tsx .cc-craft-kit/commands/spec/update-pr.ts \
     <spec-id> \
     42 \
     "https://github.com/owner/repo/pull/42"
   ```

#### Step 7: 成功メッセージ表示

```
✓ Pull Request が正常に作成されました！

PR 番号: #42
PR URL: https://github.com/owner/repo/pull/42

次のステップ:
- PR をレビューしてください
- マージ後、/cft:pr-cleanup <spec-id> でブランチ削除
```

#### エラーハンドリング

- **GitHub CLI 未インストール**: `gh` コマンドが見つからない場合、インストール手順を案内
- **GitHub CLI 認証失敗**: `gh auth login` を実行するよう案内
- **ネットワークエラー**: エラーメッセージを表示し、手動でのリトライを案内
- **未コミット変更**: PR 作成前にコミットするよう警告

### その他のフェーズ

requirements, design, testing フェーズの場合は、従来通りガイダンスメッセージを表示してください。

- 仕様書の詳細確認: `/cft:spec-get <spec-id>`
- GitHub Issue 作成: `/cft:github-issue-create <spec-id>`
- 次のフェーズに移行: `/cft:spec-phase <spec-id> <next-phase>`

---

## フェーズ移行後の未コミットファイルチェック

**重要**: フェーズ移行コマンドが完了した後、以下の処理を**必ず自動的に実行**してください。**ユーザーに確認を求めずに、即座に実行すること。**

### 1. Git 状態確認（必須・自動実行）

**必ず実行**: Bash ツールで以下のコマンドを実行してください:

```bash
git status --porcelain
```

このコマンドは、フェーズ移行が成功した直後に**必ず実行**する必要があります。ユーザーに確認を求めたり、スキップしたりしないでください。

### 2. 未コミットファイルの検出と警告（必須・自動実行）

**重要**: `git status --porcelain` の出力を解析してください:

- **出力が空（長さ0）の場合**: セクション3の成功メッセージを表示
- **出力が空でない場合**: 未コミットファイルが存在 → 警告メッセージを表示

**警告メッセージの表示（未コミットファイルがある場合）**:

以下のフォーマットで警告を表示してください。`[ファイルリスト]` の部分には、`git status --porcelain` の実際の出力をそのまま挿入してください。

```
⚠️ 警告: フェーズ移行後も未コミットファイルが残っています。

未コミットファイル一覧:
[git status --porcelain の出力をここに貼り付け]

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

**重要**: この警告メッセージは、未コミットファイルが検出された場合に**必ず表示**してください。

### 3. 次のステップ案内（必須・自動実行）

**成功メッセージの表示（未コミットファイルがない場合）**:

`git status --porcelain` の出力が空の場合、以下のメッセージを表示してください:

```
✓ すべての変更がコミット済みです。

フェーズ移行が正常に完了し、すべての変更が自動コミットされました。

次のステップ:
- GitHub Issue を更新: /cft:spec-update $1
- 仕様書の詳細確認: /cft:spec-get $1
- 次のフェーズに移行: /cft:spec-phase $1 <next-phase>
```

**重要**: この成功メッセージは、未コミットファイルが検出されなかった場合に**必ず表示**してください。

---

## 実装上の注意事項

### git status チェックの確実な実行

このセクションで記載された `git status --porcelain` の実行は、**省略不可**です。以下のケースでも必ず実行してください:

- ✅ フェーズ移行が成功した場合 → **必ず実行**
- ✅ 自動コミットが実行された場合 → **必ず実行**
- ✅ エラーが発生しなかった場合 → **必ず実行**
- ❌ スキップや省略は**絶対に禁止**

### エラーハンドリング

`git status --porcelain` の実行が失敗した場合（Git リポジトリが存在しない、権限エラーなど）:

1. エラーメッセージを表示
2. ユーザーに Git 環境の確認を促す
3. フェーズ移行の成功メッセージは表示する（フェーズ移行自体は成功しているため）
