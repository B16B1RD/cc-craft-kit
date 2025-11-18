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
/cft:knowledge-progress f6621295 "認証機能の基本実装が完了しました"
```

---

以下のコマンドを実行して進捗を記録してください。

```bash
npx tsx .cc-craft-kit/commands/knowledge/progress.ts "$1" "$2"
```

記録が完了したら、Issue URL を表示し、必要に応じて次のアクションを案内してください。

- エラー解決策の記録: `/cft:knowledge-error <spec-id> "<error>" "<solution>"`
- Tips の記録: `/cft:knowledge-tip <spec-id> "<category>" "<tip>"`
- 仕様書の詳細確認: `/cft:spec-get <spec-id>`
