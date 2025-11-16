---
description: "仕様書の一覧を表示します"
argument-hint: "[phase] [limit]"
---

# 仕様書一覧

登録されている仕様書の一覧を表示します。フェーズでフィルタリング可能です。

## 引数

- `$1` (オプション): フェーズフィルター (requirements/design/tasks/implementation/completed)
- `$2` (オプション): 表示件数 (デフォルト: 20)

## 使用例

```bash
/takumi:spec-list
/takumi:spec-list requirements
/takumi:spec-list design 50
```

---

以下のコマンドを実行して仕様書一覧を取得してください:

```bash
takumi spec list "$1" "$2"
```

結果を要約して表示し、必要に応じて次のアクションを案内してください:

- 仕様書の詳細確認: `/takumi:spec-get <spec-id>`
- 新規仕様書作成: `/takumi:spec-create "<name>" [description]`
- フェーズでフィルタ: `/takumi:spec-list <phase>`
