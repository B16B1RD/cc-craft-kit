---
description: "typescript-eslint スキルでコード品質をチェック"
argument-hint: ""
---

# Lint チェック

`typescript-eslint` スキルを実行して、TypeScript コンパイルエラーと ESLint 警告をチェックします。

## 引数

なし（プロジェクト全体を対象とします）

## 実行内容

1. TypeScript コンパイラで型エラーをチェック (`npx tsc --noEmit`)
2. ESLint でコードスタイルとベストプラクティスをチェック (`npm run lint`)
3. 以下の観点で検証：
   - 型エラーの検出
   - 未使用変数・import の検出
   - コードスタイル違反の検出
   - ベストプラクティス違反の検出

## 使用例

```bash
/cft:lint-check
```

---

## 自動実行フロー

重要: コマンド実行後、ユーザーに確認を求めずに、以下の処理を**自動的に実行**してください。

1. **typescript-eslint スキルの実行**:
   - Skill ツールで `typescript-eslint` スキルを起動

2. **TypeScript コンパイルチェック**:
   - Bash ツールで `npx tsc --noEmit` を実行
   - 型エラーが検出された場合：
     - エラーの詳細を解析
     - ファイルごとにエラーをグループ化
     - 修正案を提示

3. **ESLint チェック**:
   - Bash ツールで `npm run lint` を実行
   - 警告が検出された場合：
     - ルール違反の詳細を解析
     - 自動修正可能なエラーは `npm run lint:fix` で修正
     - 手動修正が必要なエラーは修正案を提示

4. **レポート生成**:
   - チェック結果をカテゴリ別に整理
   - 重要度（Error/Warning）でソート
   - 修正すべき優先度を提示

5. **自動修正の実行**:
   - 自動修正可能なエラーについて、ユーザーの承認を得る
   - 承認された場合、`npm run lint:fix` を実行
   - 修正結果を報告
