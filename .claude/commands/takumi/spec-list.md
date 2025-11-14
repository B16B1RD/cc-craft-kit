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

```
/takumi:spec-list
/takumi:spec-list requirements
/takumi:spec-list design 50
```

---

MCPツール `takumi:list_specs` を呼び出して仕様書一覧を取得してください。

引数:
- phase: $1 (指定されている場合)
- limit: $2 (指定されている場合、デフォルト: 20)
- offset: 0

仕様書一覧を以下の形式で表示してください:

## 仕様書一覧

| ID (省略形) | 名前 | フェーズ | 作成日時 | GitHub Issue |
|------------|------|---------|---------|--------------|
| xxx-xxx... | 仕様書A | requirements | 2025-11-15 | #123 |
| yyy-yyy... | 仕様書B | design | 2025-11-14 | #124 |

**総数:** X件
**表示:** Y件

各仕様書の詳細を見るには: `/takumi:spec-get <id>`
