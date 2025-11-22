# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

cc-craft-kit は、Claude Code 上で仕様駆動開発（SDD）、GitHub Projects/Issues 完全連携を実現する開発支援ツールキット。
`.cc-craft-kit/` ディレクトリベースの軽量アーキテクチャ、カスタムスラッシュコマンド、サブエージェント、スキルの統合により、開発ワークフローを革新します。

## ⚠️ 重要: ソースコードとインストール先の関係

### ディレクトリ構成

cc-craft-kit プロジェクトは、**自分自身を使って開発する（ドッグフーディング）** ため、以下のディレクトリ構造を採用しています。

| ディレクトリ | 役割 | Git管理 | 説明 |
|---|---|---|---|
| **`src/`** | **ソースコード** | ✅ | 開発時に編集する本体のTypeScriptコード |
| **`src/commands/`** | CLI実装 | ✅ | スラッシュコマンドから実行されるCLI実装 |
| **`src/slash-commands/`** | スラッシュコマンド定義 | ✅ | Claude Codeのスラッシュコマンド定義 (`.md`) |
| **`src/scripts/`** | 同期・マイグレーションスクリプト | ✅ | 整合性チェック、自動同期、マイグレーションツール |
| **`.claude/commands/cc-craft-kit/`** | シンボリックリンク | ✅ | `src/slash-commands/` へのシンボリックリンク |
| **`.cc-craft-kit/`** | **インストール先** | ❌ | cc-craft-kit 自身が cc-craft-kit を使うためのインストール先（ドッグフーディング用） |

### 開発フロー

1. **編集**: `src/` 配下のファイルを編集
2. **同期**: `npm run sync:dogfood` で `.cc-craft-kit/` へ TypeScript ファイルをコピー
3. **実行**: スラッシュコマンド `/cft:*` を実行してテスト（`npx tsx` で直接実行）

注意: `src/` を編集したら必ず `npm run sync:dogfood` を実行してください。ビルドは不要です。

### 開発時の注意事項

**❌ 間違った手順:**

```bash
# .cc-craft-kit/ のファイルを直接編集
vim .cc-craft-kit/integrations/github/sync.ts  # NG!
```

**✅ 正しい手順:**

```bash
# 1. src/ のソースコードを編集
vim src/integrations/github/sync.ts

# 2. 同期実行（TypeScriptファイルをコピー）
npm run sync:dogfood
```

### なぜ2つのコードベースが存在するのか

cc-craft-kit は「自分自身を使って開発する」ため、開発中のプロジェクトディレクトリ内に `.cc-craft-kit/` ディレクトリがあります。これにより以下が可能になります。

- cc-craft-kit の開発中に、cc-craft-kit のコマンド（`/cft:spec-create` など）を使用できる
- 実際の運用環境と同じ構成でテスト可能
- `.cc-craft-kit/` は `.gitignore` に含まれており、Git で管理されない

### コード修正時の確認方法

```bash
# src/ と .cc-craft-kit/ の整合性チェック
npm run check:sync

# 差分がある場合は同期
npm run sync:dogfood

# 再度チェック
npm run check:sync
```

## よく使うコマンド

### 開発

```bash
# cc-craft-kit は TypeScript を直接実行するため、ビルド不要です
# すべてのコマンドは npx tsx で直接実行されます

# 型チェック
npm run typecheck
```

### テスト

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジレポート
npm run test:coverage
```

### リント・フォーマット

```bash
# ESLint実行
npm run lint

# ESLint自動修正
npm run lint:fix

# Prettier実行
npm run format

# textlintチェック（ドキュメント）
npm run textlint

# textlint自動修正
npm run textlint:fix
```

### コマンド実行

すべてのコマンドはスラッシュコマンド経由で実行します。

```bash
# 例: プロジェクト状態確認
/cft:status

# 直接実行（開発・デバッグ用）
npx tsx .cc-craft-kit/commands/status.ts
```

### データベース

```bash
# マイグレーション実行
npm run db:migrate
```

### ソースコード同期

```bash
# 整合性チェック
npm run check:sync

# ドッグフーディング環境へ同期
npm run sync:dogfood

# Dry-runモード（変更内容を確認のみ）
npm run sync:dogfood:dry

# 構造マイグレーション（初回のみ）
npm run migrate:structure

# マイグレーションのDry-run
npm run migrate:structure:dry
```

## コーディング規約

### TypeScript

- strict mode を有効にして、すべての型チェックを厳格に実施すること
- `any`型は禁止。`unknown`または具体的な型定義を使用すること（現在`any`型は 0 個）
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

## 参考ドキュメント

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - 詳細なアーキテクチャ設計
- [QUICK_START.md](./docs/QUICK_START.md) - クイックスタートガイド
