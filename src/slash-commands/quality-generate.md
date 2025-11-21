# サブエージェント・スキル生成

品質チェック用のサブエージェントまたはスキルをテンプレートから生成します。

## 引数

- `$1` (必須): タイプ (`subagent` または `skill`)
- `$2` (必須): 名前（custom- プレフィックスが自動付与されます）

## 使用例

```bash
# セキュリティ監査サブエージェント生成
/cft:quality-generate subagent security-audit

# API ドキュメント生成スキル生成
/cft:quality-generate skill api-doc-generator

# 既存ファイル上書き
/cft:quality-generate subagent security-audit --force
```

## 実行内容

1. テンプレートから Markdown ファイルを生成
2. サブエージェント: `.claude/agents/custom-<name>.md`
3. スキル: `.claude/skills/custom-<name>/SKILL.md`
4. 既存のサブエージェント・スキル名との衝突をチェック

## 生成されるファイル例

### サブエージェント (`.claude/agents/custom-security-audit.md`)

```markdown
---
name: custom-security-audit
description: Custom subagent for security-audit
tools: Read, Grep, Bash
model: sonnet
---

# custom-security-audit Agent

[テンプレートに基づく内容]
```

### スキル (`.claude/skills/custom-api-doc-generator/SKILL.md`)

```markdown
---
name: custom-api-doc-generator
description: Custom skill for api-doc-generator
---

# custom-api-doc-generator Skill

[テンプレートに基づく内容]
```

---

以下のコマンドを実行してサブエージェント・スキルを生成してください。

```bash
npx tsx .cc-craft-kit/commands/quality/generate.ts "$1" "$2" "$@"
```
