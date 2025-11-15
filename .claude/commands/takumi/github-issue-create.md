---
description: "仕様書からGitHub Issueを作成します"
argument-hint: "<spec-id>"
---

# GitHub Issue作成

仕様書の内容を元にGitHub Issueを作成します。

## 引数

- `$1` (必須): 仕様書ID（部分一致可、最低8文字）

## 実行内容

1. 仕様書のMarkdownファイルをIssue bodyとして使用
2. フェーズに応じたラベルを自動付与
3. データベースにIssue番号を記録
4. 同期ログの作成

## 使用例

```bash
/takumi:github-issue-create f6621295
```

---

以下のコマンドを実行してGitHub Issueを作成してください:

```bash
takumi github issue create "$1"
```

Issue作成が完了したら、Issue URLと次のアクション（同期、Project追加など）を案内してください。
