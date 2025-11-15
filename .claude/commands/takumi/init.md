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
/takumi:init my-awesome-app
```

---

以下のコマンドを実行してプロジェクトを初期化してください:

```bash
takumi init "$1"
```

初期化が完了したら、結果を要約して表示してください。
