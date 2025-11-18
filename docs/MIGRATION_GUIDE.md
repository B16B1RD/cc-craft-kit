# 移行ガイド: Takumi → cc-craft-kit

## 概要

このガイドでは、Takumi から cc-craft-kit への移行内容と、開発者が従うべき新しいワークフローを説明します。

## 移行の背景

### なぜ名前を変更したのか

- プロジェクトの成熟により、初期の「Takumi」から、より具体的で機能を表す「cc-craft-kit (Claude Code Craft Kit)」に変更
- Claude Code 上で動作する開発支援ツールキットであることを名前で表現し、明確な目的を示す
- 日本語名から英語名に変更し、グローバルな展開に備える

### なぜビルドプロセスを削除したのか

- 開発効率の向上により、`npm run build` を実行せずに、TypeScript ファイルを直接 `npx tsx` で実行可能
- 同期の簡素化により、`dist/` ディレクトリ経由ではなく、`src/` から `.cc-craft-kit/` に直接コピー
- デバッグの容易化により、ソースマップ不要で、TypeScript ファイルを直接デバッグ可能
- 開発サイクルの短縮により、ビルド待ち時間がなくなり、即座に変更を反映可能

## 主な変更点

### 1. プロジェクト名の変更

| 項目 | 旧 (Takumi) | 新 (cc-craft-kit) |
|---|---|---|
| **ディレクトリ名** | `.takumi/` | `.cc-craft-kit/` |
| **データベースファイル** | `takumi.db` | `cc-craft-kit.db` |
| **スラッシュコマンド** | `/takumi:*` | `/cft:*` |
| **パッケージ名** | `takumi` | `cc-craft-kit` |

### 2. ビルドプロセスの削除

| 項目 | 旧 (ビルドあり) | 新 (ビルドなし) |
|---|---|---|
| **開発時の実行方法** | `npm run build && npx tsx dist/...` | `npx tsx .cc-craft-kit/...` |
| **同期コマンド** | `npm run build:dogfood` | `npm run sync:dogfood` |
| **同期内容** | `dist/` → `.cc-craft-kit/` | `src/` → `.cc-craft-kit/` |
| **ファイル形式** | JavaScript (`.js`, `.d.ts`) | TypeScript (`.ts`) |

### 3. スラッシュコマンドの変更

すべてのスラッシュコマンドが `/takumi:*` から `/cft:*` に変更されました。

**変更例:**

```bash
# 旧
/takumi:spec-list
/takumi:spec-create "仕様書名"
/takumi:status

# 新
/cft:spec-list
/cft:spec-create "仕様書名"
/cft:status
```

## 新しい開発ワークフロー

### 開発環境のセットアップ

```bash
# 1. リポジトリをクローン
git clone https://github.com/yourusername/cc-craft-kit.git
cd cc-craft-kit

# 2. 依存関係をインストール
npm install

# 3. ドッグフーディング環境を同期
npm run sync:dogfood

# 4. 整合性を確認
npm run check:sync
```

### コード編集時の手順

```bash
# 1. src/ 配下のファイルを編集
vim src/commands/spec/create.ts

# 2. TypeScript ファイルを .cc-craft-kit/ に同期
npm run sync:dogfood

# 3. 整合性チェック（オプション）
npm run check:sync

# 4. スラッシュコマンドで動作確認
/cft:spec-create "テスト仕様書"
```

### 型チェックとリント

```bash
# TypeScript 型チェック
npx tsc --noEmit

# ESLint チェック
npm run lint

# ESLint 自動修正
npm run lint:fix
```

### テスト実行

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジレポート
npm run test:coverage
```

## マイグレーション手順

既存のプロジェクトを cc-craft-kit に移行する場合、以下の手順に従ってください。

### ステップ1: 既存の Takumi ディレクトリを確認

```bash
# .takumi/ ディレクトリが存在するか確認
ls -la .takumi/

# データベースファイルを確認
ls -la .takumi/takumi.db
```

### ステップ2: cc-craft-kit の最新版を取得

```bash
# 最新版をプル
git pull origin main

# 依存関係を更新
npm install

# ドッグフーディング環境を同期
npm run sync:dogfood
```

### ステップ3: データ移行（必要な場合）

既存の `.takumi/` ディレクトリがある場合、データベースと仕様書ファイルを `.cc-craft-kit/` にコピーします。

```bash
# データベースをコピー
cp .takumi/takumi.db .cc-craft-kit/cc-craft-kit.db

# 仕様書ファイルをコピー
cp -r .takumi/specs/ .cc-craft-kit/specs/
```

### ステップ4: 整合性確認

```bash
# 整合性チェック
npm run check:sync

# 仕様書一覧を表示して確認
/cft:spec-list
```

### ステップ5: 旧ディレクトリの削除

データ移行が正常に完了したら、`.takumi/` ディレクトリを削除します。

```bash
# バックアップを取る（念のため）
mv .takumi .takumi.bak

# 確認後、バックアップを削除
rm -rf .takumi.bak
```

## よくある質問 (FAQ)

### Q1: なぜスラッシュコマンドが `/cft:*` なのか

**A:** `cft` は「cc-craft-kit」を短縮した形式で、`/cft:*` では長すぎるため、短縮形を採用しました。「Craft」の頭文字を取った形です。

---

### Q2: ビルドプロセスを削除したことで、npm パッケージの配布に影響はないのか

**A:** ありません。npm パッケージの配布用には引き続き `npm run build` で `dist/` ディレクトリを生成します。開発時のビルドプロセスのみを削除しました。

---

### Q3: 既存の仕様書データは移行後も使えるのか

**A:** はい、データベーススキーマは変更していないため、既存の仕様書データはそのまま使用できます。

---

### Q4: `npm run sync:dogfood` を忘れたらどうなるのか

**A:** `.cc-craft-kit/` に変更が反映されないため、スラッシュコマンドが古い動作をします。`npm run check:sync` で差分を確認できます。

---

### Q5: TypeScript ファイルを直接実行することでパフォーマンスに影響はないのか

**A:** `npx tsx` は高速な TypeScript ランタイムであり、開発時のパフォーマンスへの影響は最小限です。本番環境では引き続きビルド済みの JavaScript を使用します。

---

### Q6: 移行後に問題が発生した場合、どうすればよいのか

**A:** 以下の手順でトラブルシューティングしてください。

1. `npm run check:sync` で整合性を確認
2. `npx tsc --noEmit` で型エラーがないか確認
3. `npm run lint` で ESLint 警告がないか確認
4. 問題が解決しない場合は、GitHub Issues に報告してください

---

### Q7: 複数のプロジェクトで cc-craft-kit を使用している場合、すべて移行する必要があるのか

**A:** はい、すべてのプロジェクトで移行することを推奨します。ただし、移行は個別に実施できます。

---

## 移行チェックリスト

移行が正常に完了したか、以下のチェックリストで確認してください。

- [ ] `.cc-craft-kit/` ディレクトリが存在する
- [ ] `cc-craft-kit.db` ファイルが存在する
- [ ] スラッシュコマンドが `/cft:*` 形式で動作する
- [ ] `npm run sync:dogfood` が正常に実行できる
- [ ] `npm run check:sync` でエラーが出ない
- [ ] `/cft:spec-list` で既存の仕様書が表示される
- [ ] 新規仕様書の作成が正常に動作する
- [ ] GitHub 統合が正常に動作する
- [ ] 型チェックとリントがエラーなく完了する
- [ ] ドキュメントが最新の状態に更新されている

## サポート

移行に関する質問や問題が発生した場合は、以下のチャンネルでサポートを受けられます。

- GitHub Issues で質問や問題を報告: <https://github.com/yourusername/cc-craft-kit/issues>
- ドキュメントを参照: `CLAUDE.md`, `docs/QUICK_START.md`

---

**最終更新日**: 2025-11-18
