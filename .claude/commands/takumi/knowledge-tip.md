---
description: "開発TipsをGitHub Issueに記録します"
argument-hint: "<spec-id> <category> <tip>"
---

# Tips記録

開発中に得た知見やTipsをGitHub Issueコメントに記録し、ナレッジベース化します。

## 引数

- `$1` (必須): 仕様書ID（部分一致可、最低8文字）
- `$2` (必須): カテゴリー（例: performance, security, testing）
- `$3` (必須): Tipsの内容

## 実行内容

1. Tipsをカテゴリーとともにフォーマット
2. GitHub Issueにコメントを追加
3. データベースにログ記録

## 使用例

```bash
/takumi:knowledge-tip f6621295 "performance" "useMemo を使ってレンダリングを最適化"
```

---

以下のコマンドを実行してTipsを記録してください:

```bash
takumi knowledge tip "$1" "$2" "$3"
```

記録が完了したら、Issue URLと次のアクション（追加の記録など）を案内してください。
