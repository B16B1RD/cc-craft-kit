---
description: "品質管理コマンド（初期化/チェック/生成）"
argument-hint: "<subcommand> [args...]"
---

# 品質管理

品質要件の定義、チェック、サブエージェント・スキルの生成を行う統合コマンドです。

## サブコマンド

| サブコマンド | 説明 | 引数 |
|-------------|------|------|
| `init` | 品質要件定義ファイルを初期化 | `[--force]` |
| `check` | 品質チェック不足を検出 | `[spec-id]` |
| `generate` | サブエージェント・スキルを生成 | `<type> <name> [--force]` |

## 使用例

```bash
# 品質要件定義ファイルを初期化
/cft:quality init

# 既存ファイルを上書き
/cft:quality init --force

# 品質チェック不足を検出
/cft:quality check

# 特定の仕様書のチェック
/cft:quality check f6621295

# サブエージェントを生成
/cft:quality generate subagent security-audit

# スキルを生成
/cft:quality generate skill api-doc-generator
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: サブコマンドの解析

`$1` を解析し、以下のいずれかに分岐:

| 入力 | サブコマンド |
|------|-------------|
| `init`, `i` | init |
| `check`, `c`, `chk` | check |
| `generate`, `g`, `gen` | generate |

サブコマンドが指定されていない場合:

```
❌ サブコマンドを指定してください

使用可能なサブコマンド:
- init [--force]: 品質要件定義ファイルを初期化
- check [spec-id]: 品質チェック不足を検出
- generate <type> <name>: サブエージェント・スキルを生成

使用例:
/cft:quality init
/cft:quality check f6621295
/cft:quality generate subagent security-audit
```

処理を中断。

---

## サブコマンド: init

品質要件定義ファイル (`.cc-craft-kit/quality-requirements.yaml`) のテンプレートを生成します。

### 引数

- `--force` (任意): 既存ファイルを上書き

### 実行フロー

#### Step I1: 既存ファイルの確認

Read ツールで `.cc-craft-kit/quality-requirements.yaml` の存在を確認。

ファイルが存在し、`--force` フラグがない場合:

```
⚠️ 品質要件定義ファイルは既に存在します

既存ファイル: .cc-craft-kit/quality-requirements.yaml

上書きする場合は --force フラグを指定してください:
/cft:quality init --force
```

処理を中断。

#### Step I2: テンプレートファイルの生成

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/quality/init.ts $@
```

または、Write ツールで以下の内容を `.cc-craft-kit/quality-requirements.yaml` に書き込み:

```yaml
version: "1.0"

quality_requirements:
  - name: "security-audit"
    type: "subagent"
    trigger_phase: "implementation"
    description: "OWASP Top 10 に基づくセキュリティ脆弱性チェック"
    template: "security-auditor"
    tools: ["Read", "Grep", "Bash"]
    parameters:
      owasp_version: "2021"
      severity_threshold: "high"

  - name: "api-documentation-generator"
    type: "skill"
    trigger_phase: "completed"
    description: "OpenAPI 仕様書から API ドキュメントを自動生成"
    template: "api-doc-generator"
    tools: ["Read", "Write"]
    parameters:
      spec_format: "OpenAPI 3.0"
      output_format: "Markdown"
```

#### Step I3: 結果の表示

```
✓ 品質要件定義ファイルを初期化しました

生成ファイル: .cc-craft-kit/quality-requirements.yaml

## 含まれる品質要件

| 名前 | タイプ | トリガーフェーズ |
|------|--------|-----------------|
| security-audit | subagent | implementation |
| api-documentation-generator | skill | completed |

## 次のアクション

- 品質チェック不足を検出: /cft:quality check
- 要件定義ファイルを編集して、プロジェクト固有の品質要件を追加
```

---

## サブコマンド: check

品質要件定義ファイルに基づき、現在不足している品質チェック（サブエージェント・スキル）を検出します。

### 引数

- `$2` (任意): 仕様書 ID（部分一致可、最低 8 文字）

### 実行フロー

#### Step C1: 品質要件定義ファイルの読み込み

Read ツールで `.cc-craft-kit/quality-requirements.yaml` を読み込み。

ファイルが存在しない場合:

```
⚠️ 品質要件定義ファイルが見つかりません

初期化してください:
/cft:quality init
```

処理を中断。

#### Step C2: 既存サブエージェント・スキルの取得

Glob ツールで以下を取得:
- `.claude/agents/*.md` - サブエージェント一覧
- `.claude/skills/*/SKILL.md` - スキル一覧

#### Step C3: 品質チェック不足の検出

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/quality/check.ts "$2"
```

#### Step C4: 結果の表示

```
# Quality Requirements Check

Found {N} phase(s) with missing quality checks.

## Phase: implementation

  Missing: security-audit
  Type: subagent
  Description: OWASP Top 10 に基づくセキュリティ脆弱性チェック
  Template: security-auditor
  Reason: Subagent 'security-audit' or 'custom-security-audit' not found in .claude/agents/

  Generate: /cft:quality generate subagent security-audit

## Phase: completed

  Missing: api-documentation-generator
  Type: skill
  Description: OpenAPI 仕様書から API ドキュメントを自動生成
  Template: api-doc-generator
  Reason: Skill 'api-documentation-generator' or 'custom-api-documentation-generator' not found in .claude/skills/

  Generate: /cft:quality generate skill api-doc-generator

## 次のアクション

1. 不足しているサブエージェント・スキルを生成: /cft:quality generate <type> <name>
2. または .cc-craft-kit/quality-requirements.yaml を編集して不要なチェックを削除
```

不足がない場合:

```
✓ すべての品質要件が満たされています

品質要件数: {N}
サブエージェント: {X} 個
スキル: {Y} 個
```

---

## サブコマンド: generate

品質チェック用のサブエージェントまたはスキルをテンプレートから生成します。

### 引数

- `$2` (必須): タイプ (`subagent` または `skill`)
- `$3` (必須): 名前（custom- プレフィックスが自動付与されます）
- `--force` (任意): 既存ファイルを上書き

### 実行フロー

#### Step G1: 引数の検証

1. `$2` が指定されていない場合:
   ```
   ❌ タイプを指定してください

   有効なタイプ:
   - subagent: サブエージェントを生成
   - skill: スキルを生成

   使用例: /cft:quality generate subagent security-audit
   ```
   処理を中断。

2. `$2` が `subagent` でも `skill` でもない場合:
   ```
   ❌ 無効なタイプ: $2

   有効なタイプ:
   - subagent: サブエージェントを生成
   - skill: スキルを生成
   ```
   処理を中断。

3. `$3` が指定されていない場合:
   ```
   ❌ 名前を指定してください

   使用例: /cft:quality generate subagent security-audit
   ```
   処理を中断。

#### Step G2: 生成の実行

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/quality/generate.ts "$2" "$3" $@
```

#### Step G3: 結果の表示

サブエージェントの場合:

```
✓ サブエージェントを生成しました

生成ファイル: .claude/agents/custom-{NAME}.md

## 内容

- 名前: custom-{NAME}
- タイプ: subagent
- ツール: Read, Grep, Bash

## 次のアクション

- サブエージェントを編集してカスタマイズ
- 品質チェック: /cft:quality check
```

スキルの場合:

```
✓ スキルを生成しました

生成ファイル: .claude/skills/custom-{NAME}/SKILL.md

## 内容

- 名前: custom-{NAME}
- タイプ: skill
- ツール: Read, Write

## 次のアクション

- スキルを編集してカスタマイズ
- 品質チェック: /cft:quality check
```

---

## エラーハンドリング

### 品質要件定義ファイルが見つからない場合

```
⚠️ 品質要件定義ファイルが見つかりません

初期化してください:
/cft:quality init
```

### 既存ファイルと衝突する場合

```
⚠️ ファイルは既に存在します: {FILE_PATH}

上書きする場合は --force フラグを指定してください:
/cft:quality generate {TYPE} {NAME} --force
```

### 無効なテンプレート名の場合

```
❌ テンプレート '{TEMPLATE}' が見つかりません

品質要件定義ファイルを確認し、有効なテンプレート名を指定してください。
```

---

## 品質要件定義ファイルのフォーマット

```yaml
version: "1.0"

quality_requirements:
  - name: "requirement-name"           # 必須: 一意な名前
    type: "subagent" | "skill"         # 必須: タイプ
    trigger_phase: "implementation"    # 必須: トリガーフェーズ
    description: "説明文"               # 必須: 説明
    template: "template-name"          # 必須: テンプレート名
    tools: ["Read", "Grep", "Bash"]    # オプション: 使用ツール
    parameters:                        # オプション: パラメータ
      key: value
```

### トリガーフェーズ

| フェーズ | 説明 |
|---------|------|
| requirements | 要件定義フェーズ |
| design | 設計フェーズ |
| implementation | 実装フェーズ |
| completed | 完了フェーズ |
