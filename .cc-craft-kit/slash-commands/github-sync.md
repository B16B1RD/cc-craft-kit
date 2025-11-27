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

- 仕様書の内容で Issue 本文を**常に上書き**
- Issue 未作成の場合は新規作成
- フェーズラベルを自動更新
- 同期コメントを Issue に追加

**Source of Truth**: 仕様書ファイルが正

### from-github（GitHub→仕様書）

- Issue のステータスを仕様書に反映
- Issue クローズ時に仕様書を completed に移行
- **チェックボックス状態を仕様書に同期**
  - Issue で更新されたチェックボックスを検出
  - 同じテキストを持つチェックボックスの状態を更新

## チェックボックス同期の仕組み

1. 仕様書と Issue 両方のチェックボックスを解析
2. テキスト内容で照合（行番号ではなくテキスト一致）
3. 状態が異なる項目を検出して仕様書を更新

**例:**
```markdown
# Issue 側
- [x] 機能 A の実装  ← チェック済みに変更

# 仕様書側（from-github 実行後）
- [x] 機能 A の実装  ← 自動的に同期
```

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
