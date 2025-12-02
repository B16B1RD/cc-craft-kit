# .env の GITHUB_TOKEN が認識されない

**仕様書 ID:** 68c7eecc-35ca-4e1f-bac2-d9148ce61cb9
**フェーズ:** completed
**作成日時:** 2025/11/15 20:36:40
**更新日時:** 2025/11/16 20:46:01

---

## 1. 背景と目的

### 背景

cc-craft-kit CLI で GitHub 統合機能を使用する際、プロジェクトルートの `.env` ファイルに `GITHUB_TOKEN` を設定しているにもかかわらず、CLI 実行時に環境変数として認識されず、`process.env.GITHUB_TOKEN` が `undefined` になる問題が発生している。

調査の結果、以下が判明:

- `.env` ファイル自体は正しく存在し、`GITHUB_TOKEN` も設定されている
- `package.json` には `dotenv` パッケージが依存関係として含まれている
- しかし、CLI のエントリーポイント (`src/cli/index.ts`) で `dotenv` の初期化処理が実装されていない

### 目的

CLI のエントリーポイントで dotenv を適切に初期化し、`.env` ファイルから環境変数を確実に読み込めるようにする。

---

## 2. 対象ユーザー

- cc-craft-kit CLI を使用して GitHub 統合機能を利用する開発者
- ローカル環境で `.env` ファイルによる環境変数管理を行っている開発者

---

## 3. 受け入れ基準

### 必須要件

- [x] CLI 起動時に `.env` ファイルが自動的に読み込まれること
- [x] `process.env.GITHUB_TOKEN` が `.env` ファイルの値を正しく参照できること
- [x] すべての GitHub 統合コマンドで環境変数が利用可能であること

### 機能要件

- [x] `src/cli/index.ts` で dotenv を初期化する
- [x] 初期化はすべてのコマンド実行より前に行われる
- [x] ES Modules 環境で正しく動作する

### 非機能要件

- [x] 既存のコード動作に影響を与えない
- [x] パフォーマンスへの影響が最小限である
- [x] TypeScript ビルドが正常に通る

---

## 4. 設計詳細

### 4.1 原因分析

#### 現在の実装 (`src/cli/index.ts:1-10`)

```typescript
#!/usr/bin/env node
import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

**問題点:**

- dotenv の import および初期化処理が存在しない
- そのため、`.env` ファイルが読み込まれず、環境変数が `process.env` に設定されない

#### 影響範囲

以下のファイルで `process.env.GITHUB_TOKEN` を参照しているが、すべて `undefined` になる:

- `src/cli/commands/github/init.ts:72`
- `src/cli/commands/github/issue-create.ts`
- `src/cli/commands/github/sync.ts`
- `src/cli/commands/github/project-add.ts`

### 4.2 解決策の設計

#### アーキテクチャ方針

**CLIエントリーポイントで dotenv を最優先で初期化し、すべてのコマンド実行前に環境変数を利用可能にする。**

#### 実装方法

**ファイル:** `src/cli/index.ts`

**変更箇所:** 2 行目（`import 'reflect-metadata';` の前）

**修正前:**

```typescript
#!/usr/bin/env node
import 'reflect-metadata';
```

**修正後:**

```typescript
#!/usr/bin/env node
import 'dotenv/config';
import 'reflect-metadata';
```

#### 技術的根拠

1. **`import 'dotenv/config'` を使用する理由**
   - ES Modules 環境（`"type": "module"`）で推奨される方法
   - 自動的に `.env` ファイルを読み込み、`process.env` に環境変数を設定
   - 別途 `config()` を呼び出す必要がない

2. **初期化タイミング**
   - CLI エントリーポイントの最初期（`reflect-metadata` より前）
   - すべての動的 import (`await import(...)`) より前に実行されるため、すべてのコマンドで環境変数が利用可能

3. **CommonJS 形式を使用しない理由**
   - プロジェクトが `"type": "module"` を使用しているため
   - `require('dotenv').config()` は ES Modules 環境で使用できない

### 4.3 データフロー

```text
[CLI起動]
  ↓
[dotenv初期化] ← .envファイル読み込み
  ↓
[process.env に環境変数設定]
  ↓
[reflect-metadata初期化]
  ↓
[コマンドルーティング]
  ↓
[GitHub統合コマンド実行] ← process.env.GITHUB_TOKEN が利用可能
```

### 4.4 代替案の検討

#### 代替案1: 各コマンドファイルで個別に dotenv を初期化

**メリット:**

- コマンド単位で環境変数の読み込みを制御できる

**デメリット:**

- 重複コードが発生する
- 初期化忘れのリスクがある
- 保守性が低い

**結論:** 採用しない

#### 代替案2: package.json の scripts で NODE_OPTIONS を使用

```json
"scripts": {
  "start": "NODE_OPTIONS='--require dotenv/config' node dist/cli/index.js"
}
```

**メリット:**

- コードを変更せずに環境変数を読み込める

**デメリット:**

- グローバルインストール時に動作しない
- `npx takumi` 実行時に動作しない
- ES Modules では `--require` ではなく `--import` が必要

**結論:** 採用しない

---

## 5. 実装計画

### 5.1 変更ファイル

- `src/cli/index.ts` (2 行目に `import 'dotenv/config';` を追加)

### 5.2 テスト計画

#### 単体テスト

`.env` ファイルから環境変数が正しく読み込まれることを検証:

```typescript
// tests/cli/dotenv-integration.test.ts
describe('dotenv integration', () => {
  it('should load GITHUB_TOKEN from .env file', () => {
    // .env.test を用意
    // CLIを起動
    // process.env.GITHUB_TOKEN が設定されていることを確認
  });
});
```

#### 統合テスト

実際のコマンド実行で環境変数が利用可能であることを検証:

```bash
# .envにGITHUB_TOKENを設定
echo "GITHUB_TOKEN=test_token" > .env

# CLI再ビルド
npm run build

# github init コマンド実行
takumi github init B16B1RD takumi

# "✓ GITHUB_TOKEN is set" が表示されることを確認
```

### 5.3 リスク管理

#### リスク1: 既存の環境変数を上書きする

**対策:**

- dotenv はデフォルトで既存の環境変数を上書きしない
- シェルで設定された環境変数が優先される

#### リスク2: .env ファイルが存在しない場合

**対策:**

- dotenv は `.env` ファイルが存在しない場合でもエラーを出さない
- 環境変数がシェルから設定されている場合は、そちらが優先される

---

## 6. 制約条件

- Node.js 18 以上が必須（既存の制約）
- ES Modules 環境（`"type": "module"`）を維持する
- 既存のコマンド動作に影響を与えない

---

## 7. 依存関係

### 依存パッケージ

- `dotenv` (既に `package.json` に含まれている)

### 影響を受けるモジュール

- すべての GitHub 統合コマンド
  - `src/cli/commands/github/init.ts`
  - `src/cli/commands/github/issue-create.ts`
  - `src/cli/commands/github/sync.ts`
  - `src/cli/commands/github/project-add.ts`
- プラグインシステム
  - `src/plugins/official/slack/index.ts`
  - `src/plugins/official/backlog/index.ts`

---

## 8. 参考情報

- [dotenv 公式ドキュメント](https://github.com/motdotla/dotenv)
- [ES Modules での dotenv 使用方法](https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import)
- [Node.js ES Modules](https://nodejs.org/api/esm.html)
