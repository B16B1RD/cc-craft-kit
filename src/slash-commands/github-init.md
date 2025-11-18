---
description: "GitHub統合を初期化します"
argument-hint: "<owner> <repo>"
---

# GitHub統合初期化

GitHub リポジトリとの連携を設定します。

## 引数

- `$1` (必須): GitHub オーナー名（ユーザー名または組織名）
- `$2` (必須): リポジトリ名

## 実行内容

1. `.cc-craft-kit/config.json`に GitHub 情報を保存
2. GITHUB_TOKEN 環境変数の確認
3. 必要な権限のチェック

## 環境変数

- `GITHUB_TOKEN`: Fine-grained Personal Access Token（Issues: Read/Write、Projects: Read/Write）

## 使用例

```bash
/cc-craft-kit:github-init myorg myrepo
```

---

以下のコマンドを実行して GitHub 統合を初期化してください。

```bash
npx tsx .cc-craft-kit/commands/github/init.ts "$1" "$2"
```

初期化が完了したら、必要に応じて次のアクションを案内してください。

- プロジェクト状況の確認: `/cc-craft-kit:status`
- 仕様書から Issue 作成: `/cc-craft-kit:github-issue-create <spec-id>`
- 新規仕様書の作成: `/cc-craft-kit:spec-create "<name>" [description]`
