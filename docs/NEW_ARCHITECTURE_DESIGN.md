# 新アーキテクチャ設計書

**仕様書 ID:** ed062807-9d9c-479c-b567-e510b48102fc
**作成日時:** 2025/11/16 22:30:00
**目的:** CLI レイヤー削除後の新アーキテクチャ設計

---

## 1. アーキテクチャ概要

### 現行アーキテクチャ（削除前）

```
Slash Commands (.claude/commands/takumi/*.md)
    ↓ (Bash: takumi <command>)
CLI Layer (src/cli/)
    ↓ (関数呼び出し)
Core Layer (src/core/)
    ↓
Integrations Layer (src/integrations/github/)
    ↓
Database Layer (Kysely + SQLite)
```

**課題:**
- CLI レイヤーが不要（Claude Code 上でのみ使用）
- 二重メンテナンスコスト（CLI + スラッシュコマンド）
- 920行の冗長なコード

### 新アーキテクチャ（削除後）

```
Slash Commands (.claude/commands/takumi/*.md)
    ↓ (Node.js: tsx src/core/commands/<command>.ts)
Core Commands Layer (src/core/commands/) ← 新規作成
    ↓ (関数呼び出し)
Core Modules (src/core/workflow/, database/, events/, etc.)
    ↓
Integrations Layer (src/integrations/github/)
    ↓
Database Layer (Kysely + SQLite)
```

**利点:**
- シンプルなアーキテクチャ（レイヤー削減）
- スラッシュコマンドから直接コアロジックを呼び出し
- CLI 固有のフォーマット処理が不要
- 約920行のコード削減

---

## 2. 新規作成レイヤー: Core Commands Layer

### 役割

- スラッシュコマンドから呼び出されるエントリーポイント
- 引数バリデーション
- エラーハンドリング
- レスポンスフォーマット（プレーンテキスト）
- ビジネスロジックの呼び出し

### ディレクトリ構造

```
src/core/commands/
├── index.ts                          # 全コマンドのエクスポート
├── init.ts                           # プロジェクト初期化
├── status.ts                         # プロジェクト状況表示
├── spec/
│   ├── index.ts
│   ├── create.ts                     # 仕様書作成
│   ├── list.ts                       # 仕様書一覧
│   ├── get.ts                        # 仕様書詳細
│   └── phase.ts                      # フェーズ更新
├── github/
│   ├── index.ts
│   ├── init.ts                       # GitHub 初期化
│   ├── issue-create.ts               # Issue 作成
│   ├── sync.ts                       # GitHub 同期
│   └── project-add.ts                # Project 追加
└── knowledge/
    ├── index.ts
    ├── progress.ts                   # 進捗記録
    ├── error.ts                      # エラー記録
    └── tip.ts                        # Tips 記録
```

**推定 LOC**: 600-700行（CLI 920行から約30%削減）

---

## 3. CLI ユーティリティの移行方針

### 3.1 出力フォーマット（output.ts）

**現状（CLI）:**
- ANSI カラーコード対応
- テーブル形式、JSON、Markdown 形式
- 成功/エラー/警告/情報メッセージ

**新方針:**
- **削除:** ANSI カラーコードは不要（スラッシュコマンド出力はプレーンテキスト）
- **移行:** 必要な関数のみ `src/core/utils/formatting.ts` に移行
  - `formatTable()` → シンプルな Markdown テーブル生成
  - `formatMarkdown()` → そのまま保持
- **削除:** カラー関連の関数は全削除

**移行先:**
```typescript
// src/core/utils/formatting.ts
export function formatMarkdownTable(headers: string[], rows: string[][]): string;
export function formatKeyValueList(items: Record<string, string>): string;
```

---

### 3.2 バリデーション（validation.ts）

**現状（CLI）:**
- Spec ID バリデーション
- Phase バリデーション
- GitHub リポジトリ形式バリデーション
- 必須引数チェック

**新方針:**
- **移行:** 全バリデーション関数を `src/core/validation/` に移行
- **拡張:** Zod スキーマを使用した型安全なバリデーション

**移行先:**
```
src/core/validation/
├── index.ts
├── spec.ts                  # Spec ID, Phase バリデーション
├── github.ts                # GitHub リポジトリバリデーション
└── common.ts                # 必須引数、数値、文字列長等
```

**型定義:**
```typescript
// src/core/validation/spec.ts
import { z } from 'zod';

export const SpecIdSchema = z.string().min(8);
export const PhaseSchema = z.enum(['requirements', 'design', 'tasks', 'implementation', 'completed']);

export function validateSpecId(specId: string): string;
export function validatePhase(phase: string): Phase;
```

---

### 3.3 エラーハンドリング（error-handler.ts）

**現状（CLI）:**
- `CLIError` クラス
- エラーコード定数
- エラーファクトリー関数
- `handleCLIError()` でプロセス終了

**新方針:**
- **移行:** エラークラスを `src/core/errors/` に統合（既存の errors/ を拡張）
- **変更:** `CLIError` → `TakumiError` にリネーム
- **削除:** `handleCLIError()` は削除（スラッシュコマンド内で try-catch）
- **削除:** ANSI カラー出力は削除

**移行先:**
```
src/core/errors/
├── index.ts                  # 既存
├── base.ts                   # TakumiError 基底クラス
├── spec-errors.ts            # Spec 関連エラー
├── github-errors.ts          # GitHub 関連エラー
└── validation-errors.ts      # バリデーションエラー
```

**エラークラス設計:**
```typescript
// src/core/errors/base.ts
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

  toPlainText(): string {
    return `[${this.code}] ${this.message}${this.suggestion ? `\n\nSuggestion: ${this.suggestion}` : ''}`;
  }
}
```

---

## 4. スラッシュコマンドの新実装方式

### 現行実装（CLI 経由）

```markdown
<!-- .claude/commands/takumi/status.md -->
以下のコマンドを実行してプロジェクトの状況を取得してください:

\`\`\`bash
takumi status
\`\`\`
```

### 新実装（Core Commands 直接呼び出し）

```markdown
<!-- .claude/commands/takumi/status.md -->
以下のコマンドを実行してプロジェクトの状況を取得してください:

\`\`\`bash
tsx src/core/commands/status.ts
\`\`\`
```

または、引数が必要な場合:

```markdown
<!-- .claude/commands/takumi/spec-create.md -->
以下のコマンドを実行して仕様書を作成してください:

\`\`\`bash
tsx src/core/commands/spec/create.ts "$1" "$2"
\`\`\`

引数:
- `$1` (必須): 仕様書名
- `$2` (オプション): 説明
```

**利点:**
- CLI ビルド不要（`tsx` で TypeScript 直接実行）
- デバッグが容易（スラッシュコマンドから直接エラーメッセージが見える）
- ホットリロード対応（`tsx watch` で開発効率向上）

---

## 5. Core Commands の実装パターン

### 基本パターン

```typescript
// src/core/commands/status.ts
import 'reflect-metadata';
import { getDatabase } from '../database/connection.js';
import { resolveProjectId } from '../../integrations/github/project-resolver.js';
import { formatMarkdownTable } from '../utils/formatting.js';
import { TakumiError } from '../errors/base.js';

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
    const config = JSON.parse(readFileSync(join(takumiDir, 'config.json'), 'utf-8'));

    // プロジェクト情報表示
    console.log('# Takumi Project Status\n');
    console.log('## Project');
    console.log(`Name: ${config.project.name}`);
    console.log(`Initialized: ${new Date(config.project.initialized_at).toLocaleString()}`);
    console.log(`Directory: ${takumiDir}\n`);

    // GitHub 連携状態
    if (config.github) {
      console.log('## GitHub Integration');
      console.log(`Repository: ${config.github.owner}/${config.github.repo}`);

      const projectId = await resolveProjectId(takumiDir);
      console.log(`Project ID: ${projectId ? `#${projectId}` : '(not set)'}`);

      const hasToken = !!process.env.GITHUB_TOKEN;
      console.log(`Token: ${hasToken ? '✓ Configured' : '✗ Not set'}\n`);
    }

    // データベース取得
    const db = getDatabase();

    // フェーズ別仕様書集計
    const specs = await db
      .selectFrom('specs')
      .select(['id', 'name', 'phase', 'github_issue_id', 'created_at'])
      .orderBy('created_at', 'desc')
      .execute();

    // 仕様書一覧
    console.log('## Specifications');
    console.log(`Total: ${specs.length}\n`);

    // フェーズ別集計テーブル
    const phaseCounts = /* ... */;
    console.log(formatMarkdownTable(['Phase', 'Count'], phaseCounts));
    console.log();

    // 最近の仕様書
    if (specs.length > 0) {
      console.log('## Recent Specifications');
      const recentSpecs = specs.slice(0, 5);
      const rows = recentSpecs.map(/* ... */);
      console.log(formatMarkdownTable(['ID', 'Name', 'Phase', 'GitHub'], rows));
      console.log();
    }

    // 推奨アクション
    console.log('## Suggested Actions\n');
    console.log('  • View specs: /takumi:spec-list');
    console.log('  • Create a spec: /takumi:spec-create "<name>"');

  } catch (error) {
    if (error instanceof TakumiError) {
      console.error(error.toPlainText());
      process.exit(1);
    }
    throw error;
  }
}

// CLI モードでの実行
if (import.meta.url === `file://${process.argv[1]}`) {
  showStatus().catch((error) => {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  });
}
```

**パターンの特徴:**
1. **reflect-metadata インポート** - DI コンテナ初期化
2. **try-catch でエラーハンドリング** - TakumiError を捕捉
3. **プレーンテキスト出力** - Markdown 形式でフォーマット
4. **CLI モードチェック** - `import.meta.url` で直接実行時に関数呼び出し

---

## 6. 引数の受け渡し方法

### 引数なしコマンド

```typescript
// src/core/commands/status.ts
export async function showStatus(): Promise<void> {
  // 実装
}

// CLI モード
if (import.meta.url === `file://${process.argv[1]}`) {
  showStatus();
}
```

### 引数ありコマンド

```typescript
// src/core/commands/spec/create.ts
import { validateRequired } from '../../validation/common.js';

export async function createSpec(name: string, description?: string): Promise<void> {
  // バリデーション
  validateRequired(name, 'name');

  // 実装
}

// CLI モード
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , name, description] = process.argv;
  createSpec(name, description);
}
```

**スラッシュコマンドから呼び出し:**
```markdown
\`\`\`bash
tsx src/core/commands/spec/create.ts "$1" "$2"
\`\`\`
```

---

## 7. エラーハンドリング方針

### 統一エラーハンドリング

すべての Core Commands は以下のパターンでエラーをハンドリング:

```typescript
export async function someCommand(/* args */): Promise<void> {
  try {
    // ビジネスロジック
  } catch (error) {
    if (error instanceof TakumiError) {
      console.error(error.toPlainText());
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
```

### エラーメッセージ形式

**現行（CLI - ANSI カラー）:**
```
✗ [E301] Project is not initialized

Suggestion: Run "/takumi:init <project-name>" to initialize a new project.
```

**新方式（プレーンテキスト）:**
```
[E301] Project is not initialized

Suggestion: Run "/takumi:init <project-name>" to initialize a new project.
```

---

## 8. 出力フォーマット方針

### Markdown ベースのシンプルな出力

**現行（CLI）:**
- ANSI カラーコード
- テーブル罫線（box-drawing characters）
- 太字・斜体

**新方式:**
- Markdown 見出し（`#`, `##`）
- Markdown テーブル
- プレーンテキスト

**例:**

```markdown
# Takumi Project Status

## Project
Name: Takumi Development
Initialized: 2025/11/15 19:42:20
Directory: /home/user/project/.takumi

## Specifications
Total: 13

| Phase          | Count |
|----------------|-------|
| requirements   | 6     |
| design         | 0     |
| tasks          | 0     |
| implementation | 0     |
| completed      | 7     |

## Recent Specifications
| ID          | Name                    | Phase     | GitHub |
|-------------|-------------------------|-----------|--------|
| 9acc4af5... | Projects のビュー設定    | completed | #13    |
| cb4d92f5... | ステータス更新修正       | completed | #9     |

## Suggested Actions

  • View specs: /takumi:spec-list
  • Create a spec: /takumi:spec-create "<name>"
```

---

## 9. パッケージ設定の変更

### package.json

**削除:**
```json
{
  "bin": {
    "takumi": "dist/cli/index.js"
  },
  "scripts": {
    "start": "node dist/cli/index.js",
    "dev": "tsx watch src/cli/index.ts"
  }
}
```

**新規:**
```json
{
  "scripts": {
    "dev": "tsx watch src/core/commands/status.ts",
    "cmd": "tsx"
  }
}
```

**`dev` スクリプトの用途変更:**
- 開発時のホットリロード用（任意のコマンドを指定可能）

**`cmd` スクリプトの追加:**
- `npm run cmd src/core/commands/status.ts` で実行可能

---

## 10. テスト戦略

### CLI テストの削除

```
tests/cli/                   # 全削除
```

### Core Commands テストの追加

```
tests/core/commands/
├── status.test.ts
├── init.test.ts
├── spec/
│   ├── create.test.ts
│   ├── list.test.ts
│   ├── get.test.ts
│   └── phase.test.ts
└── github/
    ├── init.test.ts
    ├── issue-create.test.ts
    └── sync.test.ts
```

**テストパターン:**

```typescript
// tests/core/commands/status.test.ts
import { showStatus } from '../../../src/core/commands/status.js';

describe('showStatus', () => {
  it('should display project status', async () => {
    // モックデータベース
    // モック設定ファイル

    // 標準出力をキャプチャ
    const output = await captureOutput(() => showStatus());

    // アサーション
    expect(output).toContain('# Takumi Project Status');
    expect(output).toContain('Total: 13');
  });
});
```

---

## 11. 移行ロードマップ

### Phase 1: 準備
- [x] Task 1: 現行アーキテクチャの分析
- [ ] Task 2: 新アーキテクチャの設計（本ドキュメント）

### Phase 2: 実装
- [ ] Task 3: コアロジック層の抽出・整理
  - `src/core/commands/` ディレクトリ作成
  - `src/core/validation/` ディレクトリ作成
  - `src/core/utils/formatting.ts` 作成
  - `src/core/errors/` 拡張
- [ ] Task 4: スラッシュコマンドのリファクタリング
  - 13個のスラッシュコマンドを `tsx src/core/commands/` 呼び出しに変更
- [ ] Task 5: CLI レイヤーの削除
  - `src/cli/` ディレクトリ削除
  - `package.json` 修正
- [ ] Task 6: テストの修正
  - CLI テスト削除
  - Core Commands テスト追加

### Phase 3: 検証
- [ ] Task 7: ドキュメントの更新
- [ ] Task 8: 動作確認
- [ ] Task 9: テスト・ビルド確認

---

## 12. 成功基準

### 機能要件
- [ ] 13個のスラッシュコマンドが正常動作
- [ ] エラーハンドリングが適切
- [ ] 出力フォーマットが Markdown で読みやすい

### 非機能要件
- [ ] テストカバレッジ 80%以上維持
- [ ] ビルドサイズ削減（約920行削減）
- [ ] TypeScript ビルドエラーなし

### ドキュメント
- [ ] README.md 更新
- [ ] QUICK_START.md 更新
- [ ] CLAUDE.md 更新
- [ ] ARCHITECTURE.md 更新

---

## 13. リスクと対策

### リスク 1: スラッシュコマンドの動作不良
**対策:** Phase 2 実装前に、全スラッシュコマンドの動作確認を徹底

### リスク 2: エラーハンドリングの漏れ
**対策:** 統一エラーハンドリングパターンをテンプレート化

### リスク 3: 出力フォーマットの可読性低下
**対策:** Markdown 形式を採用し、Claude Code での表示を最適化

---

## 14. 次のステップ

- [ ] この設計書をレビュー
- [ ] Task 3 開始: コアロジック層の抽出・整理
- [ ] 最初のコマンド（`status.ts`）をプロトタイプ実装
- [ ] 動作確認後、残りのコマンドに展開
