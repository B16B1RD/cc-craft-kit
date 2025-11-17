---
description: "仕様書からGitHub Issueを作成します"
argument-hint: "<spec-id>"
---

# GitHub Issue作成

仕様書の内容を元に GitHub Issue を作成します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）

## 実行内容

1. 仕様書の Markdown ファイルを Issue body として使用
2. フェーズに応じたラベルを自動付与
3. データベースに Issue 番号を記録
4. 同期ログの作成

## 使用例

```bash
/takumi:github-issue-create f6621295
```

---

以下のコマンドを実行して GitHub Issue を作成してください:

```bash
npx tsx .takumi/commands/github/issue-create.ts "$1"
```

Issue 作成が完了したら、Issue URL を表示し、必要に応じて次のアクションを案内してください:

- GitHub Project に追加: `/takumi:github-project-add <spec-id> <project-number>`
- GitHub から同期: `/takumi:github-sync from-github <spec-id>`
- 仕様書の詳細確認: `/takumi:spec-get <spec-id>`
