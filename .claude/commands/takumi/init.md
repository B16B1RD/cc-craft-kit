---
description: "Takumiプロジェクトを初期化します"
argument-hint: "<project-name> [description]"
---

# Takumiプロジェクト初期化

指定されたプロジェクト名で Takumi プロジェクトを初期化します。

## 引数

- `$1` (必須): プロジェクト名
- `$2` (オプション): プロジェクトの説明

## 実行内容

1. `.takumi`ディレクトリの作成
2. 設定ファイル(`config.json`)の生成
3. データベースの初期化

## 使用例

```bash
/takumi:init my-awesome-app "革新的なWebアプリケーション"
```

---

MCP ツール `takumi:init_project` を呼び出してプロジェクトを初期化してください。

引数は以下の通りです。

- projectName: $1
- description: $2 (指定されている場合)

初期化が完了したら、以下の情報を表示してください。

- プロジェクト名
- 作成されたディレクトリパス
- 設定ファイルの内容
- 次のステップ（仕様書作成の方法）
