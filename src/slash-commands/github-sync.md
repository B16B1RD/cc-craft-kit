---
description: "仕様書とGitHub Issueを同期します"
argument-hint: "<direction> <spec-id>"
---

# GitHub同期

仕様書と GitHub Issue の双方向同期を行います。

## 引数

- `$1` (必須): 同期方向（to-github または from-github）
- `$2` (必須): 仕様書 ID（部分一致可、最低 8 文字）

## 実行内容

### to-github（仕様書→GitHub）

- 仕様書の内容で Issue を更新
- Issue 未作成の場合は新規作成

### from-github（GitHub→仕様書）

- Issue のステータスを仕様書に反映
- Issue クローズ時に仕様書を completed に移行

## 使用例

```bash
/cft:github-sync to-github f6621295
/cft:github-sync from-github f6621295
```

---

以下のコマンドを実行して同期を実行してください。

```bash
npx tsx .cc-craft-kit/commands/github/sync.ts "$1" "$2"
```

同期が完了したら、結果を表示し、必要に応じて次のアクションを案内してください。

- 仕様書の詳細確認: `/cft:spec-get <spec-id>`
- 逆方向の同期: `/cft:github-sync <opposite-direction> <spec-id>`
- フェーズ移行: `/cft:spec-phase <spec-id> <phase>`
