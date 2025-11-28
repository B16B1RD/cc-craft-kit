# サブエージェントとスキル作成ガイド

cc-craft-kit プロジェクトにおけるサブエージェントとスキルの作成・管理方法を説明します。

## 目次

- [概要](#概要)
- [サブエージェント](#サブエージェント)
  - [サブエージェントとは](#サブエージェントとは)
  - [サブエージェントの作成](#サブエージェントの作成)
  - [サブエージェントの構造](#サブエージェントの構造)
  - [ベストプラクティス](#サブエージェントのベストプラクティス)
- [スキル](#スキル)
  - [スキルとは](#スキルとは)
  - [スキルの作成](#スキルの作成)
  - [スキルの構造](#スキルの構造)
  - [ベストプラクティス](#スキルのベストプラクティス)
- [統合とテスト](#統合とテスト)
- [トラブルシューティング](#トラブルシューティング)

## 概要

cc-craft-kit は、**Claude Code形式のサブエージェントとスキル**をサポートしています。これにより、特定のタスクに特化したエージェントを作成し、開発ワークフロー内で効率的に活用できます。

### 主要な特徴

- **サブエージェント**: 特定のタスク（コードレビュー、リファクタリング、テスト生成など）に特化したエージェント
- **スキル**: サブエージェントが利用できる特定の知識やツール群（TypeScript/ESLint、Git 操作など）
- **プロジェクトレベルとユーザーレベル**: チーム共有またはユーザー個人用のエージェント/スキルを作成可能
- **統合機能**: サブエージェントからスキルを自動的に利用できる

## サブエージェント

### サブエージェントとは

サブエージェントは、特定のタスクに特化した専門的なエージェントです。メイン会話のコンテキストを肥大化させずに、複雑なタスクを効率的に処理できます。

**サブエージェントの例:**

- **コードレビューエージェント**: コード品質チェック、セキュリティ脆弱性検出
- **リファクタリングエージェント**: コード構造改善、パフォーマンス最適化
- **テスト生成エージェント**: 単体テスト自動生成、カバレッジ分析

### サブエージェントの作成

#### コマンドを使用した作成

```bash
/cft:agent-create my-agent "Description of what this agent does"
```

**例:**

```bash
/cft:agent-create documentation-writer "Creates comprehensive documentation for code and APIs"
```

#### 手動での作成

1. `.claude/agents/` ディレクトリに新しい Markdown ファイルを作成
2. YAML frontmatter を追加
3. システムプロンプトを記述

### サブエージェントの構造

サブエージェント定義ファイルは、**YAML frontmatter付きMarkdown**形式です。

```markdown
---
name: agent-name
description: Description of when this agent should be invoked
tools: Read, Grep, Glob, Edit, Write, Bash
model: sonnet
---

# Agent Name

You are a specialized agent for [purpose].

## Your Responsibilities

1. **[Responsibility 1]**
   - [Detail 1]
   - [Detail 2]

2. **[Responsibility 2]**
   - [Detail 1]
   - [Detail 2]

## Guidelines

- [Guideline 1]
- [Guideline 2]

## Output Format

[Expected output format]
```

#### 必須フィールド

| フィールド | 説明 | 例 |
|---|---|---|
| `name` | 小文字とハイフンのみの一意の識別子 | `code-reviewer` |
| `description` | エージェントの目的に関する自然言語の説明 | `Performs comprehensive code reviews` |

#### オプションフィールド

| フィールド | 説明 | デフォルト |
|---|---|---|
| `tools` | カンマ区切りのツールリスト | 全ツール継承 |
| `model` | 使用モデル (`sonnet`, `opus`, `haiku`, `inherit`) | `inherit` |

### サブエージェントのベストプラクティス

#### 1. 明確な責任範囲を定義

```markdown
## Your Responsibilities

1. **Code Quality Assessment**
   - Check for code smells and anti-patterns
   - Verify naming conventions and code style consistency

2. **Security Analysis**
   - Detect potential security vulnerabilities
   - Check for SQL injection risks
```

#### 2. 具体的なガイドラインを提供

```markdown
## Guidelines

- Be constructive and specific in your feedback
- Always provide examples when suggesting improvements
- Focus on actionable items rather than theoretical concerns
```

#### 3. 出力フォーマットを明示

```markdown
## Output Format

\`\`\`markdown
# Code Review Report

## Summary
[Brief overview]

## Critical Issues
[Must-fix issues]

## Recommendations
[Suggestions]
\`\`\`
```

#### 4. 適切なツールを指定

```yaml
tools: Read, Grep, Glob  # コードレビュー用（読み取り専用）
```

```yaml
tools: Read, Edit, Write, Bash  # リファクタリング用（編集可能）
```

## スキル

### スキルとは

スキルは、サブエージェントが利用できる特定の知識やツール群です。スキルは必要に応じて段階的に読み込まれ（プログレッシブディスクロージャ）、コンテキストを効率的に管理します。

**スキルの例:**

- **TypeScript/ESLintスキル**: TypeScript コンパイルエラー解析、ESLint ルール適用
- **Git操作スキル**: ブランチ管理、コミット履歴解析
- **データベーススキーマ検証スキル**: Kysely スキーマ検証、マイグレーション解析

### スキルの作成

#### コマンドを使用した作成

```bash
/cft:skill-create my-skill "Description of what this skill provides"
```

**例:**

```bash
/cft:skill-create api-documentation "Generates comprehensive API documentation from code"
```

#### 手動での作成

1. `.claude/skills/skill-name/` ディレクトリを作成
2. `SKILL.md` ファイルを作成
3. YAML frontmatter とスキル内容を記述

### スキルの構造

スキルは、**ディレクトリ内のSKILL.mdファイル + サポートファイル**で構成されます。

```text
.claude/skills/
└── my-skill/
    ├── SKILL.md       # 必須: スキル定義
    ├── reference.md   # オプション: 詳細リファレンス
    ├── examples.md    # オプション: 使用例
    └── templates/     # オプション: テンプレートファイル
```

#### SKILL.mdの構造

```markdown
---
name: skill-name
description: Description of skill capabilities and when to use it
---

# Skill Name

This skill provides [capabilities].

## Capabilities

- [Capability 1]
- [Capability 2]

## Usage Examples

### Example 1: [Use Case]

\`\`\`bash
# Command example
\`\`\`

## Best Practices

- [Best practice 1]
- [Best practice 2]
```

#### 必須フィールド

| フィールド | 制約 | 例 |
|---|---|---|
| `name` | 小文字英数字とハイフンのみ、最大64文字 | `typescript-eslint` |
| `description` | 最大1024文字 | `Analyzes TypeScript code for errors` |

### スキルのベストプラクティス

#### 1. 豊富な使用例を提供

```markdown
## Usage Examples

### Check TypeScript Errors

\`\`\`bash
npx tsc --noEmit
\`\`\`

### Run ESLint

\`\`\`bash
npm run lint
\`\`\`
```

#### 2. 問題と解決策を明示

```markdown
## Common Issues

### Type Error: Property does not exist

**Problem:**
\`\`\`typescript
const user = { name: 'John' };
console.log(user.age); // Error
\`\`\`

**Solution:**
\`\`\`typescript
interface User { name: string; age?: number; }
\`\`\`
```

#### 3. サポートファイルで詳細を分離

```markdown
# SKILL.md (概要のみ)
For detailed TypeScript configuration, see [reference.md](./reference.md).
```

```markdown
# reference.md (詳細リファレンス)
## TypeScript Configuration

### tsconfig.json
[詳細な設定説明]
```

## 統合とテスト

### サブエージェントとスキルの統合

サブエージェントは、自動的にすべての利用可能なスキルにアクセスできます。

```typescript
// サブエージェント内でスキルを利用
const result = await context.executeSkill('typescript-eslint', {
  files: ['src/**/*.ts'],
});
```

### 読み込みと登録

```typescript
import { loadSubagents } from './core/subagents/loader.js';
import { loadSkills } from './core/skills/loader.js';

// サブエージェントとスキルを読み込む
await loadSubagents();
await loadSkills();
```

### 優先順位

プロジェクトレベルのサブエージェント/スキルは、ユーザーレベルよりも優先されます。

| レベル | パス | 優先度 |
|---|---|---|
| プロジェクト | `.claude/agents/` または `.claude/skills/` | 高 |
| ユーザー | `~/.claude/agents/` または `~/.claude/skills/` | 低 |

### テスト方法

#### 1. サブエージェント一覧を確認

```bash
/cft:agent-list
```

#### 2. スキル一覧を確認

```bash
/cft:skill-list
```

#### 3. サブエージェントを実行

サブエージェントは、Claude Code の`Task`ツールを通じて自動的に呼び出されます。

## トラブルシューティング

### サブエージェントが表示されない

**原因:**

- ファイル名が正しくない（`.md`拡張子が必要）
- YAML frontmatter が不正
- `name`フィールドが欠けている

**解決策:**

```bash
# 1. ファイルを確認
ls .claude/agents/

# 2. YAML frontmatterを確認
head -10 .claude/agents/my-agent.md

# 3. 再度読み込み
/cft:agent-list
```

### スキルが表示されない

**原因:**

- `SKILL.md`ファイルが存在しない
- ディレクトリ構造が正しくない
- 名前バリデーションエラー

**解決策:**

```bash
# 1. ディレクトリ構造を確認
ls -la .claude/skills/my-skill/

# 2. SKILL.mdの存在を確認
cat .claude/skills/my-skill/SKILL.md

# 3. 名前が正しいか確認（小文字英数字とハイフンのみ）
# ❌ My-Skill (大文字使用)
# ❌ my_skill (アンダースコア使用)
# ✅ my-skill
```

### サブエージェントからスキルが利用できない

**原因:**

- スキルが正しく読み込まれていない
- スキル名が間違っている

**解決策:**

```bash
# 1. スキル一覧を確認
/cft:skill-list

# 2. スキル名を確認
# サブエージェント内で正しいスキル名を使用
```

## まとめ

サブエージェントとスキルシステムを活用することで、cc-craft-kit の開発ワークフローを大幅に拡張できます。

**次のステップ:**

1. 既存のサブエージェント（code-reviewer、refactoring-assistant、test-generator）を試す
2. 既存のスキル（typescript-eslint、git-operations、database-schema-validator）を活用する
3. プロジェクト固有のサブエージェント/スキルを作成する
4. チームでサブエージェント/スキルを共有する

詳細については、以下のリソースを参照してください。

- [Claude Code 公式ドキュメント - Subagents](https://code.claude.com/docs/en/sub-agents.md)
- [Claude Code 公式ドキュメント - Skills](https://code.claude.com/docs/en/skills.md)
