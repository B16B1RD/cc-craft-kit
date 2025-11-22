---
description: "仕様書のフェーズを更新します"
argument-hint: "<spec-id> <phase>"
---

# 仕様書フェーズ更新

仕様書を次のフェーズに移行します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$2` (必須): 新しいフェーズ（完全形または省略形）

### フェーズ名（完全形）

- `requirements` - 要件定義
- `design` - 設計
- `tasks` - タスク分解
- `implementation` - 実装
- `testing` - テスト
- `completed` - 完了

### フェーズ名（省略形）

ユーザーフレンドリーな省略形もサポートしています。

- `req`, `reqs` → requirements
- `des` → design
- `task` → tasks
- `impl`, `imp` → implementation
- `test` → testing
- `comp`, `done` → completed

## 実行内容

1. データベースと Markdown ファイルのフェーズ更新
2. 更新日時の記録
3. フェーズ固有のガイダンス表示

## 使用例

```bash
# 完全形
/cft:spec-phase f6621295 design

# 省略形
/cft:spec-phase f6621295 des
/cft:spec-phase f6621295 impl
/cft:spec-phase f6621295 comp
```

---

以下のコマンドを実行して仕様書のフェーズを更新してください。

```bash
npx tsx .cc-craft-kit/commands/spec/phase.ts "$1" "$2"
```

## Note

フェーズ移行後の自動処理は TypeScript コードで実装されています(`src/core/workflow/phase-automation.ts`)。
Claude Code のスラッシュコマンド定義には依存しません。
