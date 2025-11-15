---
description: "仕様書をGitHub Projectボードに追加します"
argument-hint: "<spec-id> <project-number>"
---

# GitHub Project追加

仕様書に紐づくIssueをGitHub Projects v2ボードに追加します。

## 引数

- `$1` (必須): 仕様書ID（部分一致可、最低8文字）
- `$2` (必須): Project番号

## 前提条件

- 仕様書にGitHub Issueが紐づいていること
- GITHUB_TOKENにProjects権限があること

## 実行内容

1. 仕様書に紐づくIssueを取得
2. Project IDを取得
3. IssueをProjectに追加
4. データベースにProject IDを記録

## 使用例

```bash
/takumi:github-project-add f6621295 1
```

---

以下のコマンドを実行してProjectに追加してください:

```bash
takumi github project add "$1" "$2"
```

追加が完了したら、Project URLと次のアクション（カンバンボードでの管理など）を案内してください。
