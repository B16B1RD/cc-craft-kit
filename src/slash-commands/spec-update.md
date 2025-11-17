---
description: 仕様書の更新通知をGitHub Issueに送信
tags: [project]
---

# 仕様書の更新通知

仕様書ファイルを編集した後、この更新を GitHub Issue に通知します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）

## 実行内容

1. データベースの `updated_at` を更新
2. `spec.updated` イベントを発火
3. GitHub Issue にコメントを追加（自動）

## 使用例

```bash
/takumi:spec-update f6621295
```

---

以下のコマンドを実行して仕様書の更新を通知してください。

```bash
npx tsx .takumi/commands/spec/update.ts "$1"
```

更新が完了したら、結果を要約して表示し、GitHub Issue のリンクを案内してください。
