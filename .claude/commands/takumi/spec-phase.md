---
description: "仕様書のフェーズを更新します"
argument-hint: "<spec-id> <phase>"
---

# 仕様書フェーズ更新

仕様書を次のフェーズに移行します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$2` (必須): 新しいフェーズ (requirements/design/tasks/implementation/completed)

## 実行内容

1. データベースと Markdown ファイルのフェーズ更新
2. 更新日時の記録
3. フェーズ固有のガイダンス表示

## 使用例

```bash
/takumi:spec-phase f6621295 design
```

---

以下のコマンドを実行して仕様書のフェーズを更新してください:

```bash
takumi spec phase "$1" "$2"
```

フェーズ移行が完了したら、そのフェーズで実施すべき作業を案内してください。必要に応じて以下のアクションも提示してください:

- 仕様書の詳細確認: `/takumi:spec-get <spec-id>`
- GitHub Issue 作成: `/takumi:github-issue-create <spec-id>`
- 次のフェーズに移行: `/takumi:spec-phase <spec-id> <next-phase>`
