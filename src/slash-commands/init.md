---
description: "cc-craft-kitプロジェクトを初期化します"
argument-hint: "<project-name> [description]"
---

# cc-craft-kitプロジェクト初期化

指定されたプロジェクト名で cc-craft-kit プロジェクトを初期化します。

## 引数

- `$1` (必須): プロジェクト名
- `$2` (オプション): プロジェクトの説明

## 実行内容

1. `.cc-craft-kit`ディレクトリの作成
2. 設定ファイル(`config.json`)の生成
3. データベースの初期化

## 使用例

```bash
/cft:init my-awesome-app
```

---

以下のコマンドを実行してプロジェクトを初期化してください。

```bash
npx tsx .cc-craft-kit/commands/init.ts "$1"
```

初期化が完了したら、結果を要約して表示し、必要に応じて次のアクションを案内してください。

- GitHub 統合の設定: `/cft:github-init <owner> <repo>`
- プロジェクト状況の確認: `/cft:status`
- 新規仕様書の作成: `/cft:spec-create "<name>" [description]`
