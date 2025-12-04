---
description: "知識記録コマンド（進捗/エラー/Tips）"
argument-hint: "<subcommand> <spec-id> [args...]"
---

# 知識記録

作業中の知見を GitHub Issue コメントに記録し、ナレッジベース化する統合コマンドです。

## サブコマンド

| サブコマンド | 説明 | 引数 |
|-------------|------|------|
| `progress` | 進捗を記録 | `<spec-id> <message>` |
| `error` | エラー解決策を記録 | `<spec-id> <error> <solution>` |
| `tip` | 開発 Tips を記録 | `<spec-id> <category> <tip>` |

## 使用例

```bash
# 進捗記録
/cft:knowledge progress f6621295 "認証機能の基本実装が完了しました"

# エラー解決策記録
/cft:knowledge error f6621295 "CORS エラーが発生" "Access-Control-Allow-Origin ヘッダーを追加"

# Tips 記録
/cft:knowledge tip f6621295 "performance" "useMemo を使ってレンダリングを最適化"
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: サブコマンドの解析

`$1` を解析し、以下のいずれかに分岐:

| 入力 | サブコマンド |
|------|-------------|
| `progress`, `p`, `prog` | progress |
| `error`, `e`, `err` | error |
| `tip`, `t`, `tips` | tip |

サブコマンドが指定されていない場合:

```
❌ サブコマンドを指定してください

使用可能なサブコマンド:
- progress <spec-id> <message>: 進捗を記録
- error <spec-id> <error> <solution>: エラー解決策を記録
- tip <spec-id> <category> <tip>: Tips を記録

使用例:
/cft:knowledge progress f6621295 "認証機能の実装完了"
/cft:knowledge error f6621295 "TypeScriptエラー" "型定義を修正"
```

処理を中断。

---

## サブコマンド: progress

作業進捗を GitHub Issue コメントに記録します。

### 引数

- `$2` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$3` (必須): 進捗メッセージ

### 実行フロー

#### Step P1: 引数の検証

1. `$2` が指定されていない場合:
   ```
   ❌ 仕様書 ID を指定してください

   使用例: /cft:knowledge progress <spec-id> <message>
   ```
   処理を中断。

2. `$3` が指定されていない場合:
   ```
   ❌ 進捗メッセージを指定してください

   使用例: /cft:knowledge progress f6621295 "認証機能の実装完了"
   ```
   処理を中断。

#### Step P2: 進捗記録の実行

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/knowledge/progress.ts "$2" "$3"
```

出力（JSON）を解析:

- `success: true` の場合: 次のステップへ
- `success: false` の場合: エラーメッセージを表示して処理を中断

#### Step P3: 結果の表示

```
✓ 進捗を記録しました

## 記録内容

**仕様書**: {SPEC_NAME}
**メッセージ**: {MESSAGE}
**記録日時**: {現在日時}

## GitHub Issue

Issue #{GITHUB_ISSUE_NUMBER} にコメントを追加しました。

## 次のアクション

- エラー解決策の記録: /cft:knowledge error <spec-id> "<error>" "<solution>"
- Tips の記録: /cft:knowledge tip <spec-id> "<category>" "<tip>"
- 仕様書の詳細確認: /cft:spec-get <spec-id>
```

---

## サブコマンド: error

遭遇したエラーと解決策を GitHub Issue コメントに記録します。

### 引数

- `$2` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$3` (必須): エラー内容
- `$4` (必須): 解決策

### 実行フロー

#### Step E1: 引数の検証

1. `$2` が指定されていない場合:
   ```
   ❌ 仕様書 ID を指定してください

   使用例: /cft:knowledge error <spec-id> <error> <solution>
   ```
   処理を中断。

2. `$3` が指定されていない場合:
   ```
   ❌ エラー内容を指定してください

   使用例: /cft:knowledge error f6621295 "CORS エラー" "ヘッダーを追加"
   ```
   処理を中断。

3. `$4` が指定されていない場合:
   ```
   ❌ 解決策を指定してください

   使用例: /cft:knowledge error f6621295 "CORS エラー" "Access-Control-Allow-Origin ヘッダーを追加"
   ```
   処理を中断。

#### Step E2: エラー記録の実行

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/knowledge/error.ts "$2" "$3" "$4"
```

出力（JSON）を解析:

- `success: true` の場合: 次のステップへ
- `success: false` の場合: エラーメッセージを表示して処理を中断

#### Step E3: 結果の表示

```
✓ エラー解決策を記録しました

## 記録内容

**仕様書**: {SPEC_NAME}
**エラー**: {ERROR}
**解決策**: {SOLUTION}
**記録日時**: {現在日時}

## GitHub Issue

Issue #{GITHUB_ISSUE_NUMBER} にコメントを追加しました。

## 次のアクション

- 進捗の記録: /cft:knowledge progress <spec-id> "<message>"
- Tips の記録: /cft:knowledge tip <spec-id> "<category>" "<tip>"
- 仕様書の詳細確認: /cft:spec-get <spec-id>
```

---

## サブコマンド: tip

開発中に得た知見や Tips を GitHub Issue コメントに記録します。

### 引数

- `$2` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$3` (必須): カテゴリー（例: performance, security, testing）
- `$4` (必須): Tips の内容

### カテゴリー例

| カテゴリー | 説明 |
|-----------|------|
| performance | パフォーマンス最適化 |
| security | セキュリティ対策 |
| testing | テスト手法 |
| debugging | デバッグ技術 |
| architecture | 設計パターン |
| tooling | ツール活用 |

### 実行フロー

#### Step T1: 引数の検証

1. `$2` が指定されていない場合:
   ```
   ❌ 仕様書 ID を指定してください

   使用例: /cft:knowledge tip <spec-id> <category> <tip>
   ```
   処理を中断。

2. `$3` が指定されていない場合:
   ```
   ❌ カテゴリーを指定してください

   カテゴリー例: performance, security, testing, debugging, architecture, tooling

   使用例: /cft:knowledge tip f6621295 "performance" "useMemo で最適化"
   ```
   処理を中断。

3. `$4` が指定されていない場合:
   ```
   ❌ Tips の内容を指定してください

   使用例: /cft:knowledge tip f6621295 "performance" "useMemo を使ってレンダリングを最適化"
   ```
   処理を中断。

#### Step T2: Tips 記録の実行

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/knowledge/tip.ts "$2" "$3" "$4"
```

出力（JSON）を解析:

- `success: true` の場合: 次のステップへ
- `success: false` の場合: エラーメッセージを表示して処理を中断

#### Step T3: 結果の表示

```
✓ Tips を記録しました

## 記録内容

**仕様書**: {SPEC_NAME}
**カテゴリー**: {CATEGORY}
**Tips**: {TIP}
**記録日時**: {現在日時}

## GitHub Issue

Issue #{GITHUB_ISSUE_NUMBER} にコメントを追加しました。

## 次のアクション

- 進捗の記録: /cft:knowledge progress <spec-id> "<message>"
- エラー解決策の記録: /cft:knowledge error <spec-id> "<error>" "<solution>"
- 仕様書の詳細確認: /cft:spec-get <spec-id>
```

---

## エラーハンドリング

### 仕様書が見つからない場合

```
❌ 仕様書が見つかりません: $SPEC_ID

確認事項:
- 仕様書 ID は最低 8 文字必要です
- /cft:spec-list で仕様書一覧を確認してください
```

### GitHub Issue が紐づいていない場合

```
⚠️ この仕様書には GitHub Issue が紐づいていません

知識記録は GitHub Issue コメントとして保存されます。
先に GitHub Issue を作成してください:

/cft:github-issue-create $SPEC_ID
```

### gh CLI が利用できない場合

```
❌ gh CLI が見つかりません

インストール方法:
- macOS: brew install gh
- Ubuntu: sudo apt install gh
- Windows: winget install GitHub.cli

認証: gh auth login
```

---

## 記録フォーマット

### progress のコメントフォーマット

```markdown
## 進捗報告

**日時**: YYYY/MM/DD HH:mm

{MESSAGE}

---
*自動記録 by cc-craft-kit*
```

### error のコメントフォーマット

```markdown
## エラー解決策

**日時**: YYYY/MM/DD HH:mm

### エラー内容
{ERROR}

### 解決策
{SOLUTION}

---
*自動記録 by cc-craft-kit*
```

### tip のコメントフォーマット

```markdown
## 開発 Tips

**日時**: YYYY/MM/DD HH:mm
**カテゴリー**: {CATEGORY}

{TIP}

---
*自動記録 by cc-craft-kit*
```
