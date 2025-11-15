---
description: "進捗をGitHub Issueに記録します"
argument-hint: "<spec-id> <message>"
---

# 進捗記録

作業進捗を GitHub Issue コメントに記録し、ナレッジベース化します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$2` (必須): 進捗メッセージ

## 実行内容

1. GitHub Issue にコメントを追加
2. データベースにログ記録
3. タイムスタンプの記録

## 使用例

```bash
/takumi:knowledge-progress f6621295 "認証機能の基本実装が完了しました"
```

---

以下のコマンドを実行して進捗を記録してください:

```bash
takumi knowledge progress "$1" "$2"
```

記録が完了したら、Issue URL と次のアクション（追加の記録、同期など）を案内してください。
