---
description: "仕様書をGitHub Projectボードに追加します"
argument-hint: "<spec-id> <project-number>"
---

# GitHub Project追加

仕様書に紐づく Issue を GitHub Projects v2 ボードに追加します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$2` (必須): Project 番号

## 前提条件

- 仕様書に GitHub Issue が紐づいていること
- GITHUB_TOKEN に Projects 権限があること

## 実行内容

1. 仕様書に紐づく Issue を取得
2. Project ID を取得
3. Issue を Project に追加
4. データベースに Project ID を記録

## 使用例

```bash
/takumi:github-project-add f6621295 1
```

---

以下のコマンドを実行して Project に追加してください:

```bash
takumi github project add "$1" "$2"
```

追加が完了したら、Project URL を表示し、必要に応じて次のアクションを案内してください:

- 仕様書の詳細確認: `/takumi:spec-get <spec-id>`
- GitHub から同期: `/takumi:github-sync from-github <spec-id>`
- プロジェクト状況の確認: `/takumi:status`
