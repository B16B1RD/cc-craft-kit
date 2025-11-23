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

## 参考ドキュメント

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - 詳細なアーキテクチャ設計
- [QUICK_START.md](./docs/QUICK_START.md) - クイックスタートガイド
