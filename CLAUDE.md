# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

cc-craft-kit は、Claude Code 上で仕様駆動開発（SDD）を実現する開発支援ツールキット。
詳細は README.md と docs/ARCHITECTURE.md を参照してください。

---

## プロンプトファースト原則

> **最重要**: cc-craft-kit の開発では、「プロンプトで済ませられることはプロンプトで済ませる」が最優先原則です。
>
> スクリプト（.ts）は、Claude Code のツールで実現不可能な場合の**最終手段**です。

### 開発前チェックリスト

**新機能および機能改善を設計・実装する前に、必ずこのチェックリストを確認してください。**

#### Step 1: プロンプトで実現できるか確認（まずここから）

以下の**いずれか**に該当する場合、プロンプトベース（.md）で設計・実装してください:

- [ ] ファイル読み書き（Read/Write/Edit ツール）
- [ ] サブエージェント・スキル起動（Task/Skill ツール）
- [ ] Bash コマンド実行（`npm run lint`, `git status` など）
- [ ] ユーザー向けメッセージ表示
- [ ] ステートレスな処理（状態を保持しない）

**1つでも該当すれば、プロンプトベースの設計・実装を選択してください。**

#### Step 2: スクリプトが本当に必要か確認（最終手段）

以下に該当し、**かつ**プロンプトで実現不可能な場合のみ、スクリプト（.ts）で設計・実装してください:

- データベース操作（Kysely が必要）
- GitHub API 呼び出し（Octokit が必要）
- イベント駆動処理（EventBus が必要）
- ファイル監視・バックグラウンド処理（Chokidar が必要）

**Claude Code で実現不可能な場合のみ、スクリプトの設計・実装を選択してください。**

### 判断フローチャート

```text
新機能の設計・実装開始
       │
       ▼
┌─────────────────────────────────────────────────┐
│ Q1: Claude Code のツールで完結できる？          │
│    （Read/Write/Edit/Glob/Grep/Bash/Task/Skill）│
└─────────────────────────────────────────────────┘
       │
   ┌───┴────────┐
  YES           NO
   │            │
   ▼            ▼
┌──────────┐  ┌─────────────────────────────────────┐
│プロンプト│  │ Q2: なぜ完結できない？              │
│ (.md)    │  │                                     │
│          │  │ ・DB操作が必要 → スクリプト(.ts)    │
│ 推奨     │  │ ・GitHub API → スクリプト(.ts)      │
└──────────┘  │ ・EventBus → スクリプト(.ts)        │
              │ ・ファイル監視 → スクリプト(.ts)    │
              │ ・その他 → Q1に戻って再検討         │
              └─────────────────────────────────────┘
```

### Claude Code の機能境界

**Claude Code でできること（プロンプトで実現）:**

| 機能                 | ツール          | 例                           |
|----------------------|-----------------|------------------------------|
| ファイル読み込み     | Read            | 仕様書の内容確認             |
| ファイル書き込み     | Write           | テンプレート生成             |
| ファイル編集         | Edit            | セクション追記               |
| ファイル検索         | Glob            | パターンマッチング           |
| 内容検索             | Grep            | コード内検索                 |
| コマンド実行         | Bash            | `npm run lint`, `git status` |
| サブエージェント起動 | Task            | コードレビュー、テスト生成   |
| スキル起動           | Skill           | 型チェック、スキーマ検証     |
| ユーザー質問         | AskUserQuestion | 確認ダイアログ               |

**Claude Code でできないこと（スクリプトが必要）:**

| 機能             | 理由                             | 必要なライブラリ |
|------------------|----------------------------------|------------------|
| データベース操作 | 型安全なクエリ、トランザクション | Kysely           |
| GitHub API       | 認証、レート制限、GraphQL        | Octokit          |
| イベント駆動     | 非同期イベント、ハンドラー登録   | EventEmitter2    |
| ファイル監視     | 継続的な変更検知                 | Chokidar         |

### 設計・実装方法の選択早見表

| やりたいこと     | 設計・実装方法 | 理由                               |
|------------------|----------------|------------------------------------|
| ファイル読み書き | プロンプト     | Read/Write/Edit で十分             |
| コードレビュー   | プロンプト     | Task で code-reviewer 起動         |
| テスト生成       | プロンプト     | Task で test-generator 起動        |
| リファクタリング | プロンプト     | Task で refactoring-assistant 起動 |
| 型チェック       | プロンプト     | Skill で typescript-eslint 起動    |
| Bash 実行        | プロンプト     | Bash ツールで直接実行              |
| ガイダンス表示   | プロンプト     | メッセージ出力のみ                 |
| DB 操作          | スクリプト     | Kysely が必要                      |
| GitHub API       | スクリプト     | Octokit が必要                     |
| イベント発火     | スクリプト     | EventBus が必要                    |
| ファイル監視     | スクリプト     | Chokidar が必要                    |

---

## 設計・実装方法の選択ガイド

### プロンプトベースの設計・実装

プロンプトベース（.md）で設計・実装する場合のガイドライン。

#### 自動実行フローの設計

```markdown
重要: コマンド実行後、ユーザーに確認を求めずに、以下の処理を**自動的に実行**してください。

1. **ファイルパターンの解決**: Glob ツールで対象ファイルを検索
2. **サブエージェント起動**: Task ツールでサブエージェントを実行
3. **結果の報告**: 構造化された形式で表示
```

#### エラー時の分岐処理

```markdown
### バリデーションエラーが出た場合

1. エラーメッセージから不足セクションを特定
2. 既存仕様書から類似パターンを検索
3. 推論可能な情報は自動補完、推論困難な情報は質問
4. 補完完了後、コマンド再実行
```

### サブエージェント・スキル活用

| 用途             | サブエージェント/スキル                  | 実装例               |
|------------------|------------------------------------------|----------------------|
| コードレビュー   | `code-reviewer` サブエージェント         | `code-review.md`     |
| テスト生成       | `test-generator` サブエージェント        | `test-generate.md`   |
| リファクタリング | `refactoring-assistant` サブエージェント | `refactor.md`        |
| 型チェック       | `typescript-eslint` スキル               | `lint-check.md`      |
| スキーマ検証     | `database-schema-validator` スキル       | `schema-validate.md` |

### スクリプト実装（最終手段）

スクリプト（.ts）で実装する場合のガイドライン。

#### 実装場所

- `src/commands/` - コマンド実装
- `src/integrations/` - 外部連携
- `src/core/` - コアロジック

#### 必須事項

1. Zod スキーマで引数バリデーション
2. `src/core/errors/` の標準エラークラスを使用
3. `getDatabase()` は config パラメータなしで使用
4. `npx tsc --noEmit` で型チェック後に同期

---

## よくある実装パターン

### パターン 1: サブエージェント起動（プロンプト）

```markdown
# コマンド名

## 自動実行フロー

1. **ファイルパターンの解決**: Glob ツールで `$1` パターンのファイルを検索
2. **サブエージェント起動**: Task ツールで `code-reviewer` サブエージェントを実行
   - 対象ファイル: Glob の検索結果
   - thoroughness: "medium"
3. **結果の報告**: 構造化された形式で表示
```

### パターン 2: プロンプト + 最小スクリプト

複雑な機能でも、大部分をプロンプトで実装し、DB 操作のみスクリプトを使用。

| 処理           | 実装                | 理由                  |
|----------------|---------------------|-----------------------|
| UUID 生成      | プロンプト（Bash）  | `uuidgen` で十分      |
| ブランチ作成   | プロンプト（Bash）  | `git branch` で十分   |
| ファイル作成   | プロンプト（Write） | テンプレート展開      |
| DB 登録        | スクリプト          | Kysely が必要         |
| 元ブランチ復帰 | プロンプト（Bash）  | `git checkout` で十分 |

### パターン 3: データベース操作（スクリプト）

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

---

## コーディング規約

### TypeScript

- strict mode を有効にして、すべての型チェックを厳格に実施すること
- `any`型は禁止。`unknown`または具体的な型定義を使用すること
- camelCase（変数・関数）、PascalCase（クラス・型・インターフェース）の命名規則に従うこと
- インデントは 2 スペースを使用すること

### ファイル構成

- 単一責任の原則に従い、1 ファイル 1 責務とすること
- `index.ts`で公開 API を明示的にエクスポートして、モジュールを整理すること
- モジュール内は相対パス、外部は絶対パス（`.js`拡張子必須）を使用すること

### エラーハンドリング

- `src/core/errors/`の標準エラークラスを使用すること
- エラーメッセージにはトークンなどのセンシティブ情報を含めないこと
- ログレベルは `debug` → `info` → `warn` → `error` を適切に使い分けること

### セキュリティ

- すべての CLI コマンド引数は適切に検証すること（Zod スキーマ等）
- SQL インジェクション対策として、Kysely のパラメータ化クエリのみを使用すること
- HTML 出力時は必ずサニタイゼーションを実施すること
- 認証情報は環境変数（`.env`）で管理し、コードに直接記述しないこと

### データベース接続の安全性

データベース破損を防ぐための厳格なルール。

1. **`getDatabase()` の使用**
   - データベース接続は **必ず** `getDatabase()` を使用すること
   - `config` パラメータは指定しないこと（デフォルトパスを使用）
   - 異なるパスが必要な場合は、必ず `closeDatabase()` を先に呼び出すこと

2. **禁止事項**
   - `createDatabase()` を直接呼び出さないこと
   - `getDatabase({ databasePath: ... })` のように明示的なパス指定をしないこと
   - 複数のデータベースインスタンスを同時に作成しないこと

---

## 開発フロー

### ソースコード編集

1. `src/` 配下のファイルを編集
2. `npm run sync:dogfood` で `.cc-craft-kit/` へ同期
3. スラッシュコマンド `/cft:*` で動作確認

注意: `src/` を編集したら必ず `npm run sync:dogfood` を実行してください。

### よく使うコマンド

```bash
# 型チェック
npm run typecheck

# 全テスト実行
npm test

# ESLint実行
npm run lint

# ESLint自動修正
npm run lint:fix

# ソースコード同期
npm run sync:dogfood
npm run check:sync

# データベースマイグレーション
npm run db:migrate
```

### ソースコード管理

- すべてのコード編集は `src/` で行う。`.cc-craft-kit/` 配下のファイルは自動生成されるため、直接編集しない
- スラッシュコマンド定義を `src/slash-commands/` で管理する
- 同期を忘れない。`src/` を編集したら `npm run sync:dogfood` を実行する
- 型エラーは即座に修正する。`npx tsc --noEmit` でエラーが出た場合は、同期前に修正すること

---

## テスト戦略

### 単体テスト

- テストファイルは `tests/`ディレクトリに`src/`と同じ構造で配置すること
- ファイル名は `*.test.ts` とすること
- データベース、GitHub API は必ずモック化すること
- カバレッジ目標は 80%以上を目指すこと

### テスト実行時の注意

- データベースは`:memory:`モードでテスト
- GitHub API 呼び出しは必ずモック化（レート制限回避）
- **Git 操作は必ずモック化すること**（テスト実行時にブランチが変更されることを防止）

---

## トラブルシューティング

### コマンドが起動しない

1. `npx tsc --noEmit` で型エラーがないか確認
2. `.env` ファイルが正しく設定されているか確認
3. `npm run sync:dogfood` で同期が正常に完了しているか確認

### データベースエラー

1. `.cc-craft-kit/cc-craft-kit.db`が破損している可能性 → 削除して`npm run db:migrate`で再初期化
2. マイグレーションの順序エラー → マイグレーションファイルの連番を確認

---

## 参考ドキュメント

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - 詳細なアーキテクチャ設計
- [QUICK_START.md](./docs/QUICK_START.md) - クイックスタートガイド
