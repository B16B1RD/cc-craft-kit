---
description: "新しい仕様書を作成します"
argument-hint: "<spec-name> [description]"
---

# 仕様書作成

新しい仕様書を作成し、Requirements フェーズから開始します。

## 引数

- `$1` (必須): 仕様書名
- `$2` (オプション): 仕様書の説明

## 実行内容

1. データベースに仕様書レコードを作成
2. Requirements フェーズで初期化
3. 仕様書 ID の発行

## 使用例

```bash
/takumi:spec-create "ユーザー認証機能" "メール/パスワード認証とOAuth2.0対応"
```

---

以下のコマンドを実行して仕様書を作成してください。

```bash
npx tsx .takumi/commands/spec/create.ts "$1" "$2"
```

作成が完了したら、結果を要約して表示し、必要に応じて次のアクションを案内してください。

- 仕様書の詳細確認: `/takumi:spec-get <spec-id>`
- デザインフェーズに移行: `/takumi:spec-phase <spec-id> design`
