---
description: "カスタムツール管理（スキル/エージェントの一覧/作成）"
argument-hint: "<type> <subcommand> [args...]"
---

# カスタムツール管理

スキルとサブエージェントの一覧表示・作成を行う統合コマンドです。

## 構文

```
/cft:custom-tools <type> <subcommand> [args...]
```

## タイプ

| タイプ | 説明 |
|--------|------|
| `skill` | スキル（専門知識・ワークフロー） |
| `agent` | サブエージェント（自律的タスク実行） |

## サブコマンド

| サブコマンド | 説明 | 引数 |
|-------------|------|------|
| `list` | 一覧表示 | なし |
| `create` | 新規作成 | `<name> <description>` |

## 使用例

```bash
# スキル一覧
/cft:custom-tools skill list

# スキル作成
/cft:custom-tools skill create api-documentation "API ドキュメントを自動生成"

# サブエージェント一覧
/cft:custom-tools agent list

# サブエージェント作成
/cft:custom-tools agent create security-auditor "セキュリティ監査を実行"
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: タイプの解析

`$1` を解析し、以下のいずれかに分岐:

| 入力 | タイプ |
|------|--------|
| `skill`, `s`, `skills` | skill |
| `agent`, `a`, `agents`, `subagent` | agent |

タイプが指定されていない場合:

```
❌ タイプを指定してください

使用可能なタイプ:
- skill: スキルの管理
- agent: サブエージェントの管理

使用例:
/cft:custom-tools skill list
/cft:custom-tools agent create security-auditor "説明"
```

処理を中断。

### Step 2: サブコマンドの解析

`$2` を解析し、以下のいずれかに分岐:

| 入力 | サブコマンド |
|------|-------------|
| `list`, `l`, `ls` | list |
| `create`, `c`, `new`, `add` | create |

サブコマンドが指定されていない場合:

```
❌ サブコマンドを指定してください

使用可能なサブコマンド:
- list: {TYPE}の一覧を表示
- create <name> <description>: 新しい{TYPE}を作成

使用例:
/cft:custom-tools {TYPE} list
/cft:custom-tools {TYPE} create <name> "<description>"
```

処理を中断。

---

## スキル管理

### list サブコマンド

登録されているスキルの一覧を表示します。

#### 実行フロー

##### Step SL1: スキル一覧の取得

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/skill/list.ts
```

##### Step SL2: 結果の表示

```
# スキル一覧

| 名前 | 説明 | 場所 |
|------|------|------|
| {name} | {description} | {location} |
...

合計: {N} 個のスキル

## 次のアクション

- スキル作成: /cft:custom-tools skill create <name> "<description>"
```

スキルがない場合:

```
ℹ️ 登録されているスキルはありません

スキルを作成:
/cft:custom-tools skill create <name> "<description>"
```

---

### create サブコマンド

新しいスキル定義ファイルを作成します。

#### 引数

- `$3` (必須): スキル名（小文字英数字とハイフンのみ、最大 64 文字）
- `$4` (必須): スキルの説明（最大 1024 文字）

#### 実行フロー

##### Step SC1: 引数の検証

1. `$3` が指定されていない場合:
   ```
   ❌ スキル名を指定してください

   使用例: /cft:custom-tools skill create api-documentation "説明"

   命名規則:
   - 小文字英数字とハイフンのみ
   - 最大 64 文字
   ```
   処理を中断。

2. `$4` が指定されていない場合:
   ```
   ❌ スキルの説明を指定してください

   使用例: /cft:custom-tools skill create api-documentation "API ドキュメントを自動生成"
   ```
   処理を中断。

##### Step SC2: スキルの作成

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/skill/create.ts "$3" "$4"
```

##### Step SC3: 結果の表示

```
✓ スキルを作成しました

## 作成内容

- 名前: {NAME}
- 説明: {DESCRIPTION}
- ファイル: .claude/skills/{NAME}/SKILL.md

## 次のステップ

1. スキル定義ファイルを編集してカスタマイズ
2. スキルをテスト実行

## コマンド

- スキル一覧: /cft:custom-tools skill list
```

---

## サブエージェント管理

### list サブコマンド

登録されているサブエージェントの一覧を表示します。

#### 実行フロー

##### Step AL1: サブエージェント一覧の取得

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/agent/list.ts
```

##### Step AL2: 結果の表示

```
# サブエージェント一覧

| 名前 | 説明 | モデル | ツール |
|------|------|--------|--------|
| {name} | {description} | {model} | {tools} |
...

合計: {N} 個のサブエージェント

## 次のアクション

- サブエージェント作成: /cft:custom-tools agent create <name> "<description>"
```

サブエージェントがない場合:

```
ℹ️ 登録されているサブエージェントはありません

サブエージェントを作成:
/cft:custom-tools agent create <name> "<description>"
```

---

### create サブコマンド

新しいサブエージェント定義ファイルを作成します。

#### 引数

- `$3` (必須): サブエージェント名（小文字英数字とハイフンのみ）
- `$4` (必須): サブエージェントの説明

#### 実行フロー

##### Step AC1: 引数の検証

1. `$3` が指定されていない場合:
   ```
   ❌ サブエージェント名を指定してください

   使用例: /cft:custom-tools agent create security-auditor "説明"

   命名規則:
   - 小文字英数字とハイフンのみ
   ```
   処理を中断。

2. `$4` が指定されていない場合:
   ```
   ❌ サブエージェントの説明を指定してください

   使用例: /cft:custom-tools agent create security-auditor "セキュリティ監査を実行"
   ```
   処理を中断。

##### Step AC2: サブエージェントの作成

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/agent/create.ts "$3" "$4"
```

##### Step AC3: 結果の表示

```
✓ サブエージェントを作成しました

## 作成内容

- 名前: {NAME}
- 説明: {DESCRIPTION}
- ファイル: .claude/agents/{NAME}.md

## 次のステップ

1. サブエージェント定義ファイルを編集してカスタマイズ
2. Task ツールでサブエージェントをテスト実行

## コマンド

- サブエージェント一覧: /cft:custom-tools agent list
```

---

## エラーハンドリング

### 名前が既に存在する場合

```
❌ {TYPE} '{NAME}' は既に存在します

既存の {TYPE} を確認:
/cft:custom-tools {TYPE} list

別の名前を使用するか、既存ファイルを編集してください。
```

### 無効な名前の場合

```
❌ 無効な名前: {NAME}

命名規則:
- 小文字英数字とハイフンのみ使用可能
- 数字で始めることはできません
- 最大 64 文字
```

### スクリプト実行エラーの場合

```
❌ {TYPE}の{ACTION}に失敗しました

エラー: {エラーメッセージ}

確認事項:
- .cc-craft-kit/ ディレクトリが存在するか
- 必要な依存関係がインストールされているか
```

---

## スキルとサブエージェントの違い

| 特徴 | スキル | サブエージェント |
|------|--------|-----------------|
| 用途 | 専門知識・ワークフロー提供 | 自律的なタスク実行 |
| 実行方法 | Skill ツールで実行 | Task ツールで実行 |
| 会話履歴 | 親会話と共有 | 独立した会話 |
| 適用場面 | 定型的な処理手順 | 複雑な判断が必要な処理 |
| 例 | 型チェック、スキーマ検証 | コードレビュー、テスト生成 |

---

## 生成されるファイルの構造

### スキル

```
.claude/skills/{name}/
├── SKILL.md          # スキル定義ファイル
└── (その他のリソース)
```

### サブエージェント

```
.claude/agents/
└── {name}.md         # サブエージェント定義ファイル
```
