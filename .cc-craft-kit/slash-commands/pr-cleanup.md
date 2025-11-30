---
description: "PR マージ後のブランチ削除とデータベース更新を実行します"
argument-hint: "<spec-id>"
---

# PR マージ後処理

PR がマージされた後、ローカル・リモートブランチを削除し、データベースを更新します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）

## 実行内容

1. PR マージ状態を GitHub API で確認
2. ローカルブランチ削除 (`git branch -D <branch-name>`)
3. リモートブランチ削除 (`git push origin --delete <branch-name>`)
4. データベース更新 (`specs.branch_name = NULL`, `github_sync.pr_merged_at = NOW()`)
5. `spec.pr_merged` イベント発火

## 使用例

```bash
# PR マージ後処理を実行
/cft:pr-cleanup d3adac1c
```

## 注意事項

- PR がマージされていない場合はエラーが表示されます
- 保護ブランチ (main/develop) は削除できません
- ブランチ削除に失敗した場合は警告が表示されますが、処理は継続されます

---

以下のコマンドを実行して PR マージ後処理を実行してください。

```bash
npx tsx .cc-craft-kit/commands/github/pr-cleanup.ts "$1"
```
