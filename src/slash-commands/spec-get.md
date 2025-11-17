---
description: "仕様書の詳細を表示します"
argument-hint: "<spec-id>"
---

# 仕様書の詳細表示

指定された仕様書の詳細情報を表示します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）

## 実行内容

1. 仕様書のメタデータ表示
2. 仕様書の全内容表示
3. GitHub Issue 情報の表示（存在する場合）

## 使用例

```bash
/takumi:spec-get f6621295
```

---

以下のコマンドを実行して仕様書の詳細を取得してください。

```bash
npx tsx .takumi/commands/spec/get.ts "$1"
```

結果を表示し、必要に応じて次のアクションを案内してください。

- フェーズ移行: `/takumi:spec-phase <spec-id> <phase>`
- GitHub Issue 作成: `/takumi:github-issue-create <spec-id>`
- GitHub 同期: `/takumi:github-sync <direction> <spec-id>`
