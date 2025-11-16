# Takumi 最終アーキテクチャ設計書

**仕様書 ID:** ed062807-9d9c-479c-b567-e510b48102fc
**作成日時:** 2025/11/16 23:00:00
**目的:** CLI レイヤー削除 + `.takumi/` ベースの新アーキテクチャ

---

## 1. 設計方針の確定

### 採用する方式

**`.takumi/` ディレクトリに全てを統合**

- CLI を完全廃止
- `npx tsx .takumi/commands/<command>.ts` で直接実行
- 既存プロジェクトとバッティングしない
- コンテキストウィンドウ圧迫ゼロ
- 並列実行・サブエージェント完全対応

### 却下した方式

- ❌ **MCP Server 化**: コンテキスト圧迫問題（150,000トークン → 2,000トークンでも多い）
- ❌ **スキル単独**: 複雑なワークフローに不向き
- ❌ **CLI グローバルインストール**: セットアップが面倒
- ❌ **`src/` 配下**: 既存プロジェクトとバッティング
- ❌ **`.claude/takumi/`**: `.takumi/` の方が一貫性が高い

---

## 2. 新ディレクトリ構造

### プロジェクト全体像

```
your-project/                     # ユーザーの既存プロジェクト
├── src/                          # 既存コード（影響なし）
├── package.json                  # 既存設定（影響なし）
├── .claude/
│   └── commands/takumi/          # スラッシュコマンド（軽量）
│       ├── init.md
│       ├── status.md
│       ├── spec-create.md
│       ├── spec-list.md
│       ├── spec-get.md
│       ├── spec-phase.md
│       ├── github-init.md
│       ├── github-issue-create.md
│       ├── github-sync.md
│       ├── github-project-add.md
│       ├── knowledge-progress.md
│       ├── knowledge-error.md
│       └── knowledge-tip.md
└── .takumi/                      # Takumi専用領域
    ├── commands/                 # コマンド実装（新規）
    │   ├── init.ts
    │   ├── status.ts
    │   ├── spec/
    │   │   ├── create.ts
    │   │   ├── list.ts
    │   │   ├── get.ts
    │   │   └── phase.ts
    │   ├── github/
    │   │   ├── init.ts
    │   │   ├── issue-create.ts
    │   │   ├── sync.ts
    │   │   └── project-add.ts
    │   └── knowledge/
    │       ├── progress.ts
    │       ├── error.ts
    │       └── tip.ts
    ├── core/                     # コアロジック（移行）
    │   ├── database/
    │   │   ├── connection.ts
    │   │   ├── migrations/
    │   │   └── schema.ts
    │   ├── workflow/
    │   │   ├── event-bus.ts
    │   │   └── github-integration.ts
    │   ├── validation/
    │   │   ├── spec.ts
    │   │   ├── github.ts
    │   │   └── common.ts
    │   ├── errors/
    │   │   ├── base.ts
    │   │   ├── spec-errors.ts
    │   │   └── github-errors.ts
    │   └── utils/
    │       └── formatting.ts
    ├── integrations/             # 外部連携（移行）
    │   └── github/
    │       ├── client.ts
    │       ├── issues.ts
    │       ├── projects.ts
    │       └── sync.ts
    ├── package.json              # Takumi専用依存関係
    ├── tsconfig.json             # TypeScript設定
    ├── node_modules/             # Takumi専用（.gitignore）
    ├── takumi.db                 # SQLiteデータベース（.gitignore）
    ├── config.json               # プロジェクト設定
    └── specs/                    # 仕様書Markdown
        └── *.md
```

### ファイル数・行数見積もり

**削除:**
- `src/cli/`: 15ファイル、920行

**新規:**
- `.takumi/commands/`: 13ファイル、~600行（30%削減）
- `.takumi/core/`: 既存から移行、~1,500行
- `.takumi/integrations/`: 既存から移行、~800行

**合計削減:** 約320行

---

## 3. アーキテクチャ図

### レイヤー構造

```
┌─────────────────────────────────────────┐
│  Claude Code（メインエージェント）         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Slash Commands                         │
│  (.claude/commands/takumi/*.md)         │
│  - 軽量なMarkdownファイル                 │
│  - コンテキスト消費: ~50トークン/コマンド   │
└─────────────────────────────────────────┘
              ↓ (Bash)
   npx tsx .takumi/commands/<command>.ts
              ↓
┌─────────────────────────────────────────┐
│  Commands Layer                         │
│  (.takumi/commands/)                    │
│  - 引数パース                            │
│  - エラーハンドリング                     │
│  - 出力フォーマット（Markdown）           │
└─────────────────────────────────────────┘
              ↓ (関数呼び出し)
┌─────────────────────────────────────────┐
│  Core Modules                           │
│  (.takumi/core/)                        │
│  - ビジネスロジック                       │
│  - データベース操作                       │
│  - イベント駆動                          │
│  - バリデーション                        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Integrations                           │
│  (.takumi/integrations/github/)         │
│  - GitHub REST API                      │
│  - GitHub GraphQL API                   │
│  - Projects v2 管理                     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Database                               │
│  (.takumi/takumi.db)                    │
│  - SQLite                               │
│  - Kysely ORM                           │
└─────────────────────────────────────────┘
```

### サブエージェント連携

```
┌─────────────────────────────────────────┐
│  Claude Code（メインエージェント）         │
│  ユーザー: "仕様書を作ってGitHub連携して"  │
└─────────────────────────────────────────┘
              ↓ (Task tool)
┌─────────────────────────────────────────┐
│  Subagent: spec-creation                │
│  - npx tsx .takumi/commands/spec/...    │
│  - npx tsx .takumi/commands/github/...  │
│  - 並列実行可能                          │
└─────────────────────────────────────────┘
```

---

## 4. スラッシュコマンド実装

### 基本パターン

```markdown
---
description: "プロジェクトの現在の状況を表示します"
---

# プロジェクト状況

Takumi プロジェクトの現在の状況を表示します。

## 使用例

\`\`\`bash
/takumi:status
\`\`\`

---

以下のコマンドを実行してプロジェクトの状況を取得してください:

\`\`\`bash
npx tsx .takumi/commands/status.ts
\`\`\`
```

### 引数ありコマンド

```markdown
---
description: "新しい仕様書を作成します"
---

# 仕様書作成

新しい仕様書を作成します。

## 引数

- `$1` (必須): 仕様書名
- `$2` (オプション): 説明

## 使用例

\`\`\`bash
/takumi:spec-create "新機能" "機能の説明"
\`\`\`

---

以下のコマンドを実行して仕様書を作成してください:

\`\`\`bash
npx tsx .takumi/commands/spec/create.ts "$1" "$2"
\`\`\`
```

**トークン消費:** 1コマンドあたり約50-100トークン（MCP の 1/1000）

---

## 5. Commands Layer 実装パターン

### 基本テンプレート

```typescript
// .takumi/commands/status.ts
import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDatabase } from '../core/database/connection.js';
import { resolveProjectId } from '../integrations/github/project-resolver.js';
import { formatMarkdownTable } from '../core/utils/formatting.js';
import { ProjectNotInitializedError } from '../core/errors/spec-errors.js';

/**
 * プロジェクト状況表示コマンド
 */
export async function showStatus(): Promise<void> {
  try {
    const cwd = process.cwd();
    const takumiDir = join(cwd, '.takumi');

    // プロジェクト初期化チェック
    if (!existsSync(takumiDir)) {
      throw new ProjectNotInitializedError();
    }

    // 設定ファイル読み込み
    const configPath = join(takumiDir, 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));

    // Markdown形式で出力
    console.log('# Takumi Project Status\n');
    console.log('## Project');
    console.log(`Name: ${config.project.name}`);
    console.log(`Initialized: ${new Date(config.project.initialized_at).toLocaleString()}`);
    console.log(`Directory: ${takumiDir}\n`);

    // GitHub連携状態
    if (config.github) {
      console.log('## GitHub Integration');
      console.log(`Repository: ${config.github.owner}/${config.github.repo}`);

      const projectId = await resolveProjectId(takumiDir);
      console.log(`Project ID: ${projectId ? `#${projectId}` : '(not set)'}`);

      const hasToken = !!process.env.GITHUB_TOKEN;
      console.log(`Token: ${hasToken ? '✓ Configured' : '✗ Not set'}\n`);
    }

    // データベースから仕様書統計を取得
    const db = getDatabase();
    const specs = await db
      .selectFrom('specs')
      .select(['id', 'name', 'phase', 'github_issue_id', 'created_at'])
      .orderBy('created_at', 'desc')
      .execute();

    console.log('## Specifications');
    console.log(`Total: ${specs.length}\n`);

    // フェーズ別集計
    const phases = ['requirements', 'design', 'tasks', 'implementation', 'completed'];
    const phaseCounts = phases.map(phase => [
      phase,
      String(specs.filter(s => s.phase === phase).length)
    ]);

    console.log(formatMarkdownTable(['Phase', 'Count'], phaseCounts));
    console.log();

    // 最近の仕様書
    if (specs.length > 0) {
      console.log('## Recent Specifications');
      const recentSpecs = specs.slice(0, 5);
      const rows = recentSpecs.map(spec => [
        spec.id.substring(0, 8) + '...',
        spec.name.length > 30 ? spec.name.substring(0, 27) + '...' : spec.name,
        spec.phase,
        spec.github_issue_id ? `#${spec.github_issue_id}` : '-'
      ]);
      console.log(formatMarkdownTable(['ID', 'Name', 'Phase', 'GitHub'], rows));
      console.log();
    }

    // 推奨アクション
    console.log('## Suggested Actions\n');
    console.log('  • View specs: /takumi:spec-list');
    console.log('  • Create a spec: /takumi:spec-create "<name>"');

  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      // TakumiError
      console.error((error as any).toPlainText());
      process.exit(1);
    }
    // 予期しないエラー
    console.error('Unexpected error:', error instanceof Error ? error.message : String(error));
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

// CLI実行時のエントリーポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  showStatus().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
```

### 引数ありコマンド

```typescript
// .takumi/commands/spec/create.ts
import { validateRequired } from '../../core/validation/common.js';

export async function createSpec(name: string, description?: string): Promise<void> {
  try {
    // バリデーション
    validateRequired(name, 'name');

    // ビジネスロジック
    // ...

    console.log('✓ Specification created successfully!');
    console.log(`\nSpec ID: ${id}`);
    console.log(`Name: ${name}`);

  } catch (error) {
    // エラーハンドリング
  }
}

// CLI実行時
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , name, description] = process.argv;
  createSpec(name, description);
}
```

---

## 6. エラーハンドリング

### TakumiError 基底クラス

```typescript
// .takumi/core/errors/base.ts
export class TakumiError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestion?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TakumiError';
  }

  /**
   * プレーンテキスト形式（Markdown互換）
   */
  toPlainText(): string {
    const lines: string[] = [];
    lines.push(`[${this.code}] ${this.message}`);

    if (this.suggestion) {
      lines.push('');
      lines.push(`Suggestion: ${this.suggestion}`);
    }

    return lines.join('\n');
  }
}
```

### 具体的なエラークラス

```typescript
// .takumi/core/errors/spec-errors.ts
import { TakumiError } from './base.js';

export class ProjectNotInitializedError extends TakumiError {
  constructor() {
    super(
      'Project is not initialized',
      'E301',
      'Run "/takumi:init <project-name>" to initialize a new project.'
    );
  }
}

export class SpecNotFoundError extends TakumiError {
  constructor(specId: string) {
    super(
      `Spec not found: ${specId}`,
      'E401',
      'Check the spec ID and try again. Use "/takumi:spec-list" to see all specs.',
      { specId }
    );
  }
}
```

---

## 7. 出力フォーマット

### Markdown ベース

**ANSI カラーコード削除**: プレーンテキスト + Markdown

```typescript
// .takumi/core/utils/formatting.ts

/**
 * Markdown テーブル生成
 */
export function formatMarkdownTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '';

  const headerRow = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map(row => `| ${row.join(' | ')} |`);

  return [headerRow, separator, ...dataRows].join('\n');
}

/**
 * キーバリューリスト生成
 */
export function formatKeyValueList(items: Record<string, string>): string {
  return Object.entries(items)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}
```

---

## 8. package.json (.takumi/package.json)

```json
{
  "name": "@takumi/core",
  "version": "0.2.0",
  "description": "Takumi - Spec-Driven Development toolkit for Claude Code",
  "type": "module",
  "private": true,
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "db:migrate": "tsx core/database/migrate.ts"
  },
  "dependencies": {
    "@octokit/graphql": "^9.0.3",
    "@octokit/rest": "^22.0.1",
    "better-sqlite3": "^11.7.0",
    "dotenv": "^16.4.7",
    "eventemitter2": "^6.4.9",
    "kysely": "^0.27.4",
    "octokit": "^4.0.2",
    "reflect-metadata": "^0.2.2",
    "tsyringe": "^4.8.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

**注**: `bin` フィールドは削除（グローバルインストール不要）

---

## 9. セットアップ手順

### ユーザー向け手順

```bash
# 1. 既存プロジェクトに移動
cd your-project

# 2. Takumiをインストール
git clone https://github.com/user/takumi.git .takumi
cd .takumi && npm install

# 3. プロジェクト初期化
npx tsx .takumi/commands/init.ts "My Project"

# 4. 完了！スラッシュコマンドが使える
# Claude Code で /takumi:status を実行
```

### .gitignore

```
# Takumi
.takumi/node_modules/
.takumi/takumi.db
.takumi/specs/*.md
```

**Git管理対象:**
- `.takumi/commands/`
- `.takumi/core/`
- `.takumi/integrations/`
- `.takumi/package.json`
- `.takumi/tsconfig.json`
- `.claude/commands/takumi/`

---

## 10. 移行タスク

### Phase 1: 準備
- [x] Task 1: 現行アーキテクチャ分析
- [x] Task 2: `.takumi/` ベース設計

### Phase 2: 実装
- [ ] Task 3: ディレクトリ構造作成
  - `.takumi/commands/` 作成
  - `.takumi/core/` 移行
  - `.takumi/integrations/` 移行
- [ ] Task 4: Commands Layer 実装
  - 13個のコマンドを実装
  - エラーハンドリング統一
  - Markdown出力に変更
- [ ] Task 5: スラッシュコマンド修正
  - `npx tsx .takumi/commands/...` 呼び出しに変更
- [ ] Task 6: CLI レイヤー削除
  - `src/cli/` 削除
  - `package.json` の `bin` 削除
- [ ] Task 7: テスト修正
  - CLI テスト削除
  - Commands テスト追加

### Phase 3: 検証
- [ ] Task 8: 動作確認
  - 13個のスラッシュコマンド実行
  - エラーケース確認
- [ ] Task 9: ドキュメント更新
  - README.md
  - QUICK_START.md
  - CLAUDE.md

---

## 11. 成功基準

### 機能要件
- [ ] 13個のスラッシュコマンドが正常動作
- [ ] 既存プロジェクトに導入可能
- [ ] `npm install` のみでセットアップ完了

### 非機能要件
- [ ] コンテキスト消費: ~50トークン/コマンド（MCP比 99%削減）
- [ ] 並列実行可能
- [ ] サブエージェントから利用可能
- [ ] グローバルインストール不要

### コード品質
- [ ] TypeScript strict mode
- [ ] テストカバレッジ 80%以上
- [ ] ビルドエラーなし

---

## 12. 利点まとめ

### コンテキスト効率
- ✅ スラッシュコマンド: ~50トークン/コマンド
- ✅ MCP比 99%削減
- ✅ 並列実行時もトークン増加なし

### セットアップ
- ✅ グローバルインストール不要
- ✅ `npm install` のみ
- ✅ 既存プロジェクトに影響ゼロ

### 開発体験
- ✅ TypeScript直接実行（`npx tsx`）
- ✅ ビルド不要
- ✅ ホットリロード可能

### 拡張性
- ✅ サブエージェント完全対応
- ✅ 並列実行可能
- ✅ 新コマンド追加が容易

---

## 13. 次のステップ

1. この設計書をレビュー・承認
2. Task 3 開始: ディレクトリ構造作成
3. 最初のコマンド（`status.ts`）をプロトタイプ実装
4. 動作確認後、残りのコマンドに展開

以上で最終アーキテクチャ設計が完了です。
