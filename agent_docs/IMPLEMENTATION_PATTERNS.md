# 実装パターン

cc-craft-kit でよく使われる実装パターン。

## パターン 1: サブエージェント起動（プロンプト）

```markdown
# コマンド名

## 自動実行フロー

1. **ファイルパターンの解決**: Glob ツールで `$1` パターンのファイルを検索
2. **サブエージェント起動**: Task ツールで `code-reviewer` サブエージェントを実行
   - 対象ファイル: Glob の検索結果
   - thoroughness: "medium"
3. **結果の報告**: 構造化された形式で表示
```

## パターン 2: プロンプト + 最小スクリプト

複雑な機能でも、大部分をプロンプトで実装し、DB 操作のみスクリプトを使用。

| 処理           | 実装                | 理由                  |
|----------------|---------------------|-----------------------|
| UUID 生成      | プロンプト（Bash）  | `uuidgen` で十分      |
| ブランチ作成   | プロンプト（Bash）  | `git branch` で十分   |
| ファイル作成   | プロンプト（Write） | テンプレート展開      |
| DB 登録        | スクリプト          | Kysely が必要         |
| 元ブランチ復帰 | プロンプト（Bash）  | `git checkout` で十分 |

## パターン 3: データベース操作（スクリプト）

```typescript
// src/commands/example/create.ts
import { getDatabase } from '../../core/database/connection.js';
import { eventBus } from '../../core/workflow/event-bus.js';
import { z } from 'zod';

const argsSchema = z.object({
  name: z.string().min(1),
});

export async function createExample(args: string[]): Promise<void> {
  const parsed = argsSchema.parse({ name: args[0] });
  const db = getDatabase();

  await db.transaction().execute(async (trx) => {
    const result = await trx.insertInto('examples')
      .values({ name: parsed.name })
      .returning('id')
      .executeTakeFirstOrThrow();

    eventBus.emit('example.created', { id: result.id, name: parsed.name });
  });
}
```

## サブエージェント・スキル活用

| 用途             | サブエージェント/スキル                  | 実装例               |
|------------------|------------------------------------------|----------------------|
| コードレビュー   | `code-reviewer` サブエージェント         | `code-review.md`     |
| テスト生成       | `test-generator` サブエージェント        | `test-generate.md`   |
| リファクタリング | `refactoring-assistant` サブエージェント | `refactor.md`        |
| 型チェック       | `typescript-eslint` スキル               | `lint-check.md`      |
| スキーマ検証     | `database-schema-validator` スキル       | `schema-validate.md` |
