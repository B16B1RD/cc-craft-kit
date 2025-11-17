---
description: "database-schema-validator スキルでスキーマを検証"
argument-hint: ""
---

# データベーススキーマ検証

`database-schema-validator` スキルを実行して、Kysely スキーマとマイグレーションを検証します。

## 引数

なし（プロジェクトのスキーマファイル全体を対象とします）

## 実行内容

1. Kysely スキーマ定義の検証
2. マイグレーションファイルの安全性チェック
3. 以下の観点で検証：
   - スキーマ型定義の整合性
   - 外部キー制約の正確性
   - インデックス設定の妥当性
   - マイグレーションの破壊的変更の検出

## 使用例

```bash
/takumi:schema-validate
```

---

以下のコマンドを実行してスキーマ検証を開始してください。

```bash
npx tsx .takumi/commands/quality/schema-validate.ts
```

## 自動実行フロー

**重要**: コマンド実行後、ユーザーに確認を求めずに、以下の処理を**自動的に実行**してください。

1. **database-schema-validator スキルの実行**:
   - Skill ツールで `database-schema-validator` スキルを起動

2. **スキーマファイルの検索**:
   - Glob ツールで `src/core/database/**/*.ts` を検索
   - スキーマ定義ファイル (`schema.ts`) を特定
   - マイグレーションファイル (`migrations/*.ts`) を特定

3. **スキーマ定義の検証**:
   - Read ツールでスキーマファイルを読み込む
   - 型定義の整合性をチェック
   - テーブル間の外部キー制約を検証
   - インデックス設定の妥当性を確認

4. **マイグレーションの検証**:
   - Read ツールでマイグレーションファイルを読み込む
   - 破壊的な変更（DROP TABLE、DROP COLUMN など）を検出
   - マイグレーションの順序整合性を確認
   - ロールバック処理の実装を確認

5. **レポート生成**:
   - 検証結果をカテゴリ別に整理
   - 重要度（Critical/High/Medium/Low）でソート
   - 修正すべき項目と推奨事項を提示

6. **修正案の提示**:
   - Critical/High の問題については、具体的な修正案を提示
   - ユーザーの承認を得た後、Edit ツールで修正を実施
