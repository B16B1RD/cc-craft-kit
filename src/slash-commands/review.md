---
description: "コードレビュー支援（code-review/lint-check/refactor）"
argument-hint: "<subcommand> [args...]"
---

# コードレビュー支援コマンド

コード品質チェックとレビュー支援を行う統合コマンドです。

## サブコマンド

| サブコマンド | 説明 | 使用例 |
|-------------|------|--------|
| `code-review` | コードレビューを実行 | `/cft:review code-review <file-pattern>` |
| `lint-check` | TypeScript/ESLint チェック | `/cft:review lint-check` |
| `refactor` | リファクタリング支援 | `/cft:review refactor <file-pattern>` |

---

## サブコマンド: code-review

指定したファイルパターンに対してコードレビューを実行します。

### 引数

- `$2` (必須): ファイルパターン（glob 形式）

### 実行フロー

#### Step 1: 対象ファイル特定

Glob ツールでファイルを特定:

```
パターン: $2
例: src/**/*.ts, src/core/*.ts
```

#### Step 2: code-reviewer サブエージェント実行

Task ツールで `code-reviewer` サブエージェントを起動:

```
プロンプト:
以下のファイルに対して包括的なコードレビューを実行してください。

対象ファイル:
[Glob 結果のファイル一覧]

レビュー観点:
1. コード品質
   - 命名規則の一貫性
   - 関数・クラスの責務分離
   - 重複コードの検出

2. セキュリティ
   - 入力検証
   - 認証・認可
   - インジェクション脆弱性

3. パフォーマンス
   - 非効率な処理
   - メモリリーク可能性
   - N+1 問題

4. 保守性
   - テスタビリティ
   - 依存関係の明確さ
   - ドキュメント・コメントの適切さ

出力形式:
- 重要度別（Critical/High/Medium/Low）に分類
- 具体的なファイル名・行番号を含める
- 修正提案を具体的に示す
```

#### Step 3: 結果表示

```
📋 コードレビュー結果

対象: $2 (N ファイル)

## Critical Issues (N 件)
[サブエージェントの出力]

## High Priority Issues (N 件)
[サブエージェントの出力]

## Medium Priority Issues (N 件)
[サブエージェントの出力]

## Low Priority Issues (N 件)
[サブエージェントの出力]

## 推奨アクション
[サブエージェントの出力]

次のステップ:
- リファクタリング: /cft:review refactor $2
- 型・リントチェック: /cft:review lint-check
```

---

## サブコマンド: lint-check

TypeScript 型チェックと ESLint を実行します。

### 引数

なし（プロジェクト全体をチェック）

### 実行フロー

#### Step 1: TypeScript 型チェック

```bash
npm run typecheck 2>&1
```

#### Step 2: ESLint チェック

```bash
npm run lint 2>&1
```

#### Step 3: 結果集計

**両方成功の場合:**

```
✓ 品質チェック完了

TypeScript: ✓ 型エラーなし
ESLint: ✓ 警告/エラーなし

コードは品質基準を満たしています。
```

**エラーがある場合:**

```
❌ 品質チェック失敗

## TypeScript 型エラー (N 件)

[npm run typecheck の出力]

## ESLint エラー/警告 (N 件)

[npm run lint の出力]

## 修正ガイダンス

1. 型エラーの修正:
   - エラーメッセージの該当ファイル・行を確認
   - 型定義を追加/修正

2. ESLint エラーの自動修正:
   npm run lint -- --fix

次のステップ:
- 自動修正を試す: npm run lint -- --fix
- コードレビュー: /cft:review code-review <file-pattern>
```

---

## サブコマンド: refactor

リファクタリング支援を行います。

### 引数

- `$2` (必須): ファイルパターン（glob 形式）

### 実行フロー

#### Step 1: 対象ファイル特定

Glob ツールでファイルを特定。

#### Step 2: refactoring-assistant サブエージェント実行

Task ツールで `refactoring-assistant` サブエージェントを起動:

```
プロンプト:
以下のファイルに対してリファクタリングを実行してください。

対象ファイル:
[Glob 結果のファイル一覧]

リファクタリング観点:
1. 構造改善
   - 長いメソッドの分割
   - クラス責務の分離
   - モジュール構成の最適化

2. DRY 原則違反の修正
   - 重複コードの抽出・共通化
   - ユーティリティ関数の作成

3. パフォーマンス改善
   - 不要な処理の削除
   - 効率的なアルゴリズムへの置換

4. 可読性向上
   - 変数名・関数名の改善
   - コメント・ドキュメントの追加

実行条件:
- 既存のテストが通ることを確認
- 破壊的変更を避ける
- 段階的に変更を適用

出力形式:
- 変更箇所と理由を明記
- Before/After のコード例を示す
```

#### Step 3: 変更確認

AskUserQuestion ツールで確認:

```
リファクタリング提案を適用しますか？

オプション:
- はい、適用する
- 一部のみ適用
- キャンセル
```

#### Step 4: 結果表示

```
✓ リファクタリングを完了しました

対象: $2 (N ファイル)

変更内容:
[サブエージェントの変更サマリー]

次のステップ:
- 型・リントチェック: /cft:review lint-check
- テスト実行: npm test
```

---

## エラーハンドリング

### ファイルが見つからない

```
❌ 指定されたパターンに一致するファイルがありません: $PATTERN

確認事項:
- パターンが正しいか
- ファイルが存在するか

例:
  /cft:review code-review "src/**/*.ts"
  /cft:review refactor "src/core/*.ts"
```

### npm コマンドが失敗

```
❌ コマンド実行に失敗しました

エラー: [エラーメッセージ]

確認事項:
- package.json に該当スクリプトが定義されているか
- 依存関係がインストールされているか (npm install)
```

---

## 使用例

```bash
# コードレビュー
/cft:review code-review "src/**/*.ts"
/cft:review code-review "src/core/workflow/*.ts"

# 型・リントチェック
/cft:review lint-check

# リファクタリング
/cft:review refactor "src/core/*.ts"
/cft:review refactor "src/integrations/**/*.ts"
```
