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
/cft:spec-list
/cft:spec-list requirements
/cft:spec-list design 50
```

---

以下のコマンドを実行して仕様書一覧を取得してください。

```bash
npx tsx .cc-craft-kit/commands/spec/list.ts "$1" "$2"
```

結果を要約して表示し、必要に応じて次のアクションを案内してください。

- 仕様書の詳細確認: `/cft:spec-get <spec-id>`
- 新規仕様書の作成: `/cft:spec-create "<name>" [description]`
- フェーズでフィルタ: `/cft:spec-list <phase>`
