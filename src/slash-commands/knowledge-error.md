---
description: "エラー解決策をGitHub Issueに記録します"
argument-hint: "<spec-id> <error> <solution>"
---

# エラー解決策記録

遭遇したエラーと解決策を GitHub Issue コメントに記録し、ナレッジベース化します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$2` (必須): エラー内容
- `$3` (必須): 解決策

## 実行内容

1. エラーと解決策をフォーマット
2. GitHub Issue にコメントを追加
3. データベースにログ記録

## 使用例

```bash
/cc-craft-kit:knowledge-error f6621295 "CORS エラーが発生" "Access-Control-Allow-Origin ヘッダーを追加"
```

---

以下のコマンドを実行してエラー解決策を記録してください。

```bash
npx tsx .cc-craft-kit/commands/knowledge/error.ts "$1" "$2" "$3"
```

記録が完了したら、Issue URL を表示し、必要に応じて次のアクションを案内してください。

- 進捗の記録: `/cc-craft-kit:knowledge-progress <spec-id> "<message>"`
- Tips の記録: `/cc-craft-kit:knowledge-tip <spec-id> "<category>" "<tip>"`
- 仕様書の詳細確認: `/cc-craft-kit:spec-get <spec-id>`
