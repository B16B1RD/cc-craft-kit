---
description: "新しい仕様書を作成します"
argument-hint: "<spec-name> [description]"
---

# 仕様書作成

新しい仕様書を作成し、Requirementsフェーズから開始します。

## 引数

- `$1` (必須): 仕様書名
- `$2` (オプション): 仕様書の説明

## 実行内容

1. データベースに仕様書レコードを作成
2. Requirementsフェーズで初期化
3. 仕様書IDの発行

## 使用例

```
/takumi:spec-create "ユーザー認証機能" "メール/パスワード認証とOAuth2.0対応"
```

---

MCPツール `takumi:create_spec` を呼び出して仕様書を作成してください。

引数:
- name: $1
- description: $2 (指定されている場合)

作成が完了したら、以下の情報を表示してください:
- 仕様書ID
- 仕様書名
- 現在のフェーズ (requirements)
- 次のステップ（Requirements定義の方法）

また、ユーザーに対してRequirements定義に必要な情報を質問してください:
- 機能概要
- 対象ユーザー
- 受け入れ基準
- 制約条件
- 依存関係
