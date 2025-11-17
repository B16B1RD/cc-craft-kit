---
description: "開発TipsをGitHub Issueに記録します"
argument-hint: "<spec-id> <category> <tip>"
---

# Tips記録

開発中に得た知見や Tips を GitHub Issue コメントに記録し、ナレッジベース化します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$2` (必須): カテゴリー（例: performance, security, testing）
- `$3` (必須): Tips の内容

## 実行内容

1. Tips をカテゴリーとともにフォーマット
2. GitHub Issue にコメントを追加
3. データベースにログ記録

## 使用例

```bash
/takumi:knowledge-tip f6621295 "performance" "useMemo を使ってレンダリングを最適化"
```

---

以下のコマンドを実行して Tips を記録してください。

```bash
npx tsx .takumi/commands/knowledge/tip.ts "$1" "$2" "$3"
```

記録が完了したら、Issue URL を表示し、必要に応じて次のアクションを案内してください。

- 進捗の記録: `/takumi:knowledge-progress <spec-id> "<message>"`
- エラー解決策の記録: `/takumi:knowledge-error <spec-id> "<error>" "<solution>"`
- 仕様書の詳細確認: `/takumi:spec-get <spec-id>`
