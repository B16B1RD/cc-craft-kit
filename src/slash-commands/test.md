---
description: "テスト支援（test-generate/schema-validate）"
argument-hint: "<subcommand> [args...]"
---

# テスト支援コマンド

テスト生成とスキーマ検証を行う統合コマンドです。

## サブコマンド

| サブコマンド | 説明 | 使用例 |
|-------------|------|--------|
| `test-generate` | テストコードを自動生成 | `/cft:test test-generate <file-pattern>` |
| `schema-validate` | データベーススキーマを検証 | `/cft:test schema-validate` |

---

## サブコマンド: test-generate

指定したファイルに対してユニットテストを自動生成します。

### 引数

- `$2` (必須): ファイルパターン（glob 形式）

### 実行フロー

#### Step 1: 対象ファイル特定

Glob ツールでファイルを特定:

```
パターン: $2
例: src/core/*.ts, src/services/*.ts
```

#### Step 2: test-generator サブエージェント実行

Task ツールで `test-generator` サブエージェントを起動:

```
プロンプト:
以下のファイルに対して包括的なユニットテストを生成してください。

対象ファイル:
[Glob 結果のファイル一覧]

テスト生成方針:
1. カバレッジ目標
   - 行カバレッジ: 80% 以上
   - 分岐カバレッジ: 70% 以上

2. テストケース
   - 正常系: 基本的な動作確認
   - 異常系: エラーハンドリング、境界値
   - エッジケース: null, undefined, 空配列など

3. テストフレームワーク
   - Jest を使用
   - describe/it ブロックで構造化
   - expect による検証

4. モック戦略
   - 外部依存はモック化
   - ファイルシステム、API 呼び出しをモック

出力形式:
- テストファイルを *.test.ts として作成
- 各テストケースにコメントで意図を記載
```

#### Step 3: テストファイル作成

Write ツールでテストファイルを作成。

ファイル配置規則:
- `src/core/foo.ts` → `src/core/foo.test.ts`
- `src/services/bar.ts` → `src/services/bar.test.ts`

#### Step 4: テスト実行確認

```bash
npm test -- --testPathPattern="$GENERATED_TEST_FILES"
```

#### Step 5: 結果表示

```
✓ テストを生成しました

対象: $2 (N ファイル)

生成されたテストファイル:
- src/core/foo.test.ts
- src/services/bar.test.ts

テスト実行結果:
- 合計: N テスト
- 成功: N
- 失敗: N

次のステップ:
- 全テスト実行: npm test
- カバレッジ確認: npm test -- --coverage
```

---

## サブコマンド: schema-validate

データベーススキーマと型定義の整合性を検証します。

### 引数

なし

### 実行フロー

#### Step 1: database-schema-validator スキル実行

Skill ツールで `database-schema-validator` スキルを実行。

#### Step 2: 検証項目

1. **Kysely 型定義の検証**
   - `src/core/database/schema.ts` の型定義を確認
   - テーブル名、カラム名、型の整合性

2. **マイグレーションの検証**
   - 未適用マイグレーションの検出
   - マイグレーション順序の確認

3. **実際の DB との比較**
   - `.cc-craft-kit/database.db` の構造を確認
   - スキーマ定義との差分検出

#### Step 3: 結果表示

**整合性がある場合:**

```
✓ スキーマ検証完了

検証項目:
- Kysely 型定義: ✓
- マイグレーション: ✓
- DB 構造: ✓

スキーマは整合性が取れています。
```

**問題がある場合:**

```
❌ スキーマ検証エラー

## 型定義エラー

[database-schema-validator の出力]

## マイグレーション問題

[未適用マイグレーションの一覧]

## DB 構造の差分

[差分詳細]

修正ガイダンス:
[具体的な修正手順]
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
  /cft:test test-generate "src/core/*.ts"
```

### テスト実行失敗

```
❌ テスト実行に失敗しました

エラー: [エラーメッセージ]

確認事項:
- Jest がインストールされているか
- テストファイルの構文が正しいか
```

### スキーマファイルが見つからない

```
❌ スキーマファイルが見つかりません

確認事項:
- src/core/database/schema.ts が存在するか
- .cc-craft-kit/database.db が存在するか
```

---

## 使用例

```bash
# テスト生成
/cft:test test-generate "src/core/*.ts"
/cft:test test-generate "src/services/**/*.ts"

# スキーマ検証
/cft:test schema-validate
```
