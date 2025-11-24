# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

cc-craft-kit は、Claude Code 上で仕様駆動開発（SDD）を実現する開発支援ツールキット。
詳細は README.md と docs/ARCHITECTURE.md を参照してください。

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

## 開発時の注意事項

### ソースコード管理

- すべてのコード編集は `src/` で行う。`.cc-craft-kit/` 配下のファイルは自動生成されるため、直接編集しない
- スラッシュコマンド定義を `src/slash-commands/` で管理する
- 同期を忘れない。`src/` を編集したら `npm run sync:dogfood` を実行する
- 型エラーは即座に修正する。`npx tsc --noEmit` でエラーが出た場合は、同期前に修正すること

## トラブルシューティング

### コマンドが起動しない

1. `npx tsc --noEmit` で型エラーがないか確認
2. `.env` ファイルが正しく設定されているか確認
3. `npm run sync:dogfood` で同期が正常に完了しているか確認

### データベースエラー

1. `.cc-craft-kit/cc-craft-kit.db`が破損している可能性 → 削除して`npm run db:migrate`で再初期化
2. マイグレーションの順序エラー → マイグレーションファイルの連番を確認

## スクリプトとプロンプトの使い分け指針

### プロンプトファースト原則

cc-craft-kit の開発では、「プロンプトで済ませられることはプロンプトで済ませる」という基本原則に従います。

### スクリプト実装が必要な処理

以下の処理は、**TypeScript スクリプトで実装**してください:

1. **データベース操作**
   - Kysely の型安全性が必要
   - トランザクション管理が必要
   - 例: `spec/create.ts`, `spec/phase.ts`

2. **GitHub API 呼び出し**
   - Octokit の認証・レート制限管理が必要
   - 複雑なクエリ（GraphQL）
   - 例: `github/issue-create.ts`

3. **イベント駆動処理**
   - EventBus の初期化・ハンドラー登録
   - 非同期イベント発火
   - 例: `spec/create.ts` (spec.created イベント)

4. **ファイル監視・長時間実行**
   - Chokidar によるファイル監視
   - バックグラウンドプロセス
   - 例: `watch.ts`

5. **複雑なバリデーション**
   - Zod スキーマ検証
   - プレースホルダー検出
   - フェーズ遷移検証
   - 例: `sync/check.ts`, `spec/phase.ts`

### プロンプトベースで実装すべき処理

以下の処理は、**カスタムスラッシュコマンド (.md) で実装**してください:

1. **軽量な検証・表示処理**
   - 引数の簡単な検証
   - ユーザー向けメッセージ表示
   - 例: ガイダンス表示、簡単なファイル操作

2. **サブエージェント・スキル起動**
   - Task/Skill ツールによる起動
   - ファイルパターン解決（Glob）
   - 結果の構造化表示
   - 例: `code-review.md`, `refactor.md`, `test-generate.md`

3. **単純なファイル操作**
   - Read/Write/Edit ツール
   - 例: テンプレート生成、簡単な設定ファイル更新

### 判断基準チェックリスト

新しい機能を実装する際は、以下のチェックリストを使用してください。

#### スクリプト実装が必要か？

- [ ] データベース操作（CRUD、トランザクション）が必要
- [ ] GitHub API 呼び出しが必要
- [ ] イベント発火・ハンドラー登録が必要
- [ ] ファイル監視・バックグラウンド実行が必要
- [ ] 複雑な Zod スキーマ検証が必要
- [ ] 型安全性が重要（TypeScript の型推論が必要）

→ **1つでも該当すれば、スクリプト実装を選択**

#### プロンプトベースで十分か?

- [ ] 単純な引数検証のみ
- [ ] サブエージェント・スキル起動が主目的
- [ ] ファイル読み書きのみ（Read/Write/Edit ツール）
- [ ] ユーザー向けメッセージ表示が主目的
- [ ] Bash コマンド実行のみ（npm run lint など）

→ **すべて該当すれば、プロンプトベース実装を選択**

### 実装パターンマトリクス

以下のマトリクスで、実装パターンを素早く選択できます。

| 処理内容 | プロンプト | スキル | スクリプト | 実装例 |
|---|:---:|:---:|:---:|---|
| **ファイル読み書き** | ✅ | - | - | `Read`, `Write`, `Edit` ツール |
| **コードレビュー** | ✅ | ✅ | - | `code-review.md` → `code-reviewer` サブエージェント |
| **テスト生成** | ✅ | ✅ | - | `test-generate.md` → `test-generator` サブエージェント |
| **リファクタリング** | ✅ | ✅ | - | `refactor.md` → `refactoring-assistant` サブエージェント |
| **データベース操作** | - | - | ✅ | `spec/create.ts`, `spec/phase.ts` |
| **GitHub API 呼び出し** | - | - | ✅ | `github/issue-create.ts` |
| **イベント駆動処理** | - | - | ✅ | `spec/create.ts` (spec.created イベント) |
| **ファイル監視** | - | - | ✅ | `watch.ts` |
| **複雑なバリデーション** | - | - | ✅ | `phase-transition-validator.ts` |
| **Bash コマンド実行** | ✅ | - | - | `npm run lint`, `git status` |
| **ガイダンス表示** | ✅ | - | - | メッセージ表示、使用例提示 |

**実装パターンの選択ルール**:

1. **プロンプト** → **スキル** → **スクリプト** の順で検討
2. プロンプトで実現できる場合は、必ずプロンプトを選択
3. サブエージェント・スキルで実現できる場合は、Task/Skill ツールで起動
4. スクリプト実装は、判断基準チェックリストで1つ以上該当する場合のみ

### 自動実行フローの設計指針

スラッシュコマンド (.md) で自動実行フローを設計する際の指針:

#### 1. 明示的な自動実行指示

```markdown
重要: コマンド実行後、ユーザーに確認を求めずに、以下の処理を**自動的に実行**してください。
```

#### 2. ツールの実行順序を定義

```markdown
1. **ファイルパターンの解決**: Glob ツールで対象ファイルを検索
2. **コードベース解析**: Task ツールで Explore サブエージェント実行 (thoroughness: "medium")
3. **自動補完**: Edit ツールで不足セクションを追記
4. **ユーザー確認**: AskUserQuestion で推論困難な情報を質問（最大4つまで）
5. **再実行**: コマンド再実行
```

#### 3. エラー時の分岐処理

```markdown
### バリデーションエラーが出た場合

1. エラーメッセージから不足セクションを特定
2. 既存仕様書から類似パターンを検索
3. 推論可能な情報は自動補完、推論困難な情報は質問
4. 補完完了後、コマンド再実行
```

#### 4. 実装例の参照

以下の実装パターンを参考にしてください:

- **フェーズ遷移時の自動処理**: `src/slash-commands/spec-phase.md` (141-188行)
- **仕様書作成時の自動完成**: `src/slash-commands/spec-create.md` (103-265行)
- **コード品質レビュー**: `src/slash-commands/code-review.md` (40-63行)
- **リント・型チェック**: `src/slash-commands/lint-check.md` (32-62行)

## 開発キット開発時の設計・実装ガイドライン

### プロンプトファースト実装フロー

開発キットの新機能を実装する際は、以下のフローに従ってください。

#### ステップ 1: 要件の整理

- [ ] 何を実現したいか明確にする
- [ ] 対象ユーザー・使用シーンを定義する
- [ ] 既存の類似機能を調査する

#### ステップ 2: 実装方法の選択

**優先順位**: プロンプト → スキル → スクリプト

1. **プロンプトで実現可能か?**
   - Read/Write/Edit ツールで完結するか?
   - Bash コマンド実行のみで済むか?
   - ガイダンス表示が主目的か?

2. **サブエージェント・スキルで実現可能か?**
   - コードレビュー → `code-reviewer` サブエージェント
   - テスト生成 → `test-generator` サブエージェント
   - リファクタリング → `refactoring-assistant` サブエージェント
   - スキーマ検証 → `database-schema-validator` スキル
   - リント・型チェック → `typescript-eslint` スキル

3. **スクリプト実装が必要か?**
   - 判断基準チェックリスト（「スクリプトとプロンプトの使い分け指針」参照）で確認
   - 1つでも該当すれば、スクリプト実装を選択

#### ステップ 3: 設計・実装

**プロンプトベース実装の場合**:

1. `src/slash-commands/` に `.md` ファイルを作成
2. 自動実行フローを明示的に記述
3. ツールの実行順序を定義
4. エラー時の分岐処理を含める
5. `npm run sync:dogfood` で同期

**スクリプト実装の場合**:

1. `src/commands/` または `src/integrations/` に `.ts` ファイルを作成
2. Zod スキーマで引数バリデーション
3. エラーハンドリング（`src/core/errors/` の標準エラークラス使用）
4. イベント発火（必要に応じて `src/core/workflow/event-bus.ts` 使用）
5. `npx tsc --noEmit` で型チェック
6. `npm run sync:dogfood` で同期

#### ステップ 4: 品質チェック

- [ ] 型エラーがないか確認（`npx tsc --noEmit`）
- [ ] リント・フォーマット（`npm run lint:fix`）
- [ ] 単体テスト作成（`tests/` に `*.test.ts`）
- [ ] カバレッジ確認（`npm run test:coverage`）

#### ステップ 5: ドキュメント更新

- [ ] CLAUDE.md に実装パターンを追記（必要に応じて）
- [ ] README.md にコマンド説明を追記（ユーザー向け機能の場合）
- [ ] 仕様書を completed フェーズに移行

### サブエージェント・スキル活用パターン

プロンプトから Task/Skill ツールを起動する際のパターン:

#### パターン 1: ファイルパターン解決 + サブエージェント起動

```markdown
1. **ファイルパターンの解決**: Glob ツールで `$1` パターンのファイルを検索
2. **サブエージェント起動**: Task ツールで `code-reviewer` サブエージェントを実行
   - 対象ファイル: Glob の検索結果
   - thoroughness: "medium"
3. **結果の報告**: 構造化された形式で表示
```

**実装例**: `src/slash-commands/code-review.md`

#### パターン 2: 事前情報収集 + 質問 + 自動補完

```markdown
1. **事前情報収集**: Task ツールで Explore サブエージェント実行 (thoroughness: "medium")
2. **既存パターン検索**: Glob ツールで類似ファイルを検索
3. **不明情報の確認**: AskUserQuestion で質問（最大4つまで）
4. **自動補完**: Edit ツールで不足セクションを追記
```

**実装例**: `src/slash-commands/spec-create.md`

#### パターン 3: スキル起動 + エラー修正

```markdown
1. **スキル起動**: Skill ツールで `typescript-eslint` スキルを実行
2. **エラー確認**: 型エラー・ESLint 警告の有無を確認
3. **自動修正**: Edit ツールで修正可能なエラーを修正
4. **再実行**: `npm run lint:fix` または `npx tsc --noEmit` で確認
```

**実装例**: `src/slash-commands/lint-check.md`

### 実装前のチェックポイント

新機能を実装する前に、以下のチェックポイントを確認してください:

#### 設計段階

- [ ] プロンプトファースト原則に従っているか?
- [ ] 3層アーキテクチャの役割分離を意識しているか?
- [ ] 既存の類似機能を調査したか?
- [ ] 実装パターンマトリクスで実装方法を選択したか?

#### 実装段階

- [ ] TypeScript の型安全性を活用しているか?（スクリプトの場合）
- [ ] 自動実行フローを明示的に記述したか?（プロンプトの場合）
- [ ] エラーハンドリングを適切に実装したか?
- [ ] セキュリティ考慮事項を確認したか?

#### テスト段階

- [ ] 単体テストを作成したか?
- [ ] カバレッジ目標（80%以上）を達成したか?
- [ ] モック化を適切に実施したか?（DB、GitHub API、Git操作）

#### ドキュメント段階

- [ ] CLAUDE.md に実装パターンを追記したか?（必要に応じて）
- [ ] コミットメッセージは Conventional Commits に従っているか?
- [ ] PR 作成時に仕様書 ID を含めたか?

### よくある実装パターン

#### パターン 1: データベース操作を伴うコマンド

**実装方法**: TypeScript スクリプト

**テンプレート**:

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

  // トランザクション開始
  await db.transaction().execute(async (trx) => {
    // DB操作
    const result = await trx.insertInto('examples')
      .values({ name: parsed.name })
      .returning('id')
      .executeTakeFirstOrThrow();

    // イベント発火
    eventBus.emit('example.created', { id: result.id, name: parsed.name });
  });
}
```

#### パターン 2: サブエージェント起動コマンド

**実装方法**: プロンプトベース (.md)

**テンプレート**:

```markdown
# コマンド名

## 自動実行フロー

重要: コマンド実行後、ユーザーに確認を求めずに、以下の処理を**自動的に実行**してください。

1. **ファイルパターンの解決**: Glob ツールで `$1` パターンのファイルを検索
2. **サブエージェント起動**: Task ツールで `サブエージェント名` サブエージェントを実行
   - 対象ファイル: Glob の検索結果
   - thoroughness: "medium"
3. **結果の報告**: 構造化された形式で表示
```

#### パターン 3: バリデーション + 自動補完コマンド

**実装方法**: プロンプトベース (.md) + スクリプト (.ts)

**プロンプト側**:

```markdown
## バリデーションエラーが出た場合

1. **仕様書ファイルを読み込む**: Read ツール
2. **不足セクションを確認**: エラーメッセージ解析
3. **コードベース解析**: Task ツール（Explore サブエージェント）
4. **自動補完**: Edit ツール + AskUserQuestion
5. **再実行**: コマンド再実行
```

**スクリプト側**:

```typescript
// src/core/validators/example-validator.ts
export function validateExample(content: string): ValidationResult {
  const placeholders = detectPlaceholders(content);
  const missingSections = detectMissingSections(content, REQUIRED_SECTIONS);

  return {
    isValid: placeholders.length === 0 && missingSections.length === 0,
    needsCompletion: placeholders.length > 0 || missingSections.length > 0,
    placeholders: placeholders.length > 0 ? { count: placeholders.length } : undefined,
    missingSections,
  };
}
```

## 参考ドキュメント

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - 詳細なアーキテクチャ設計
- [QUICK_START.md](./docs/QUICK_START.md) - クイックスタートガイド
