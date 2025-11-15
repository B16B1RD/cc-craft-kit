---
description: "仕様書のフェーズを更新します"
argument-hint: "<spec-id> <phase>"
---

# 仕様書フェーズ更新

仕様書を次のフェーズに移行します。

## 引数

- `$1` (必須): 仕様書ID（部分一致可、最低8文字）
- `$2` (必須): 新しいフェーズ (requirements/design/tasks/implementation/completed)

## 実行内容

1. データベースとMarkdownファイルのフェーズ更新
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

フェーズ移行が完了したら、次のステップ（そのフェーズで実施すべき作業）を案内してください。
