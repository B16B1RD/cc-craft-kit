# cc-craft-kit クイックスタートガイド

このガイドでは、cc-craft-kit プロジェクトの初期セットアップから、最初の仕様書作成までの手順を説明します。

## 前提条件

- Node.js 18 以上がインストールされていること
- Claude Code CLI が利用可能であること
- GitHub アカウント(GitHub 連携を使用する場合)

## ステップ1: インストール

### 方法1: curl コマンド経由（推奨）

cc-craft-kit を既存プロジェクトにインストールします。

```bash
# カレントディレクトリにインストール
curl -fsSL https://cc-craft-kit.dev/install.sh | sh

# 指定したディレクトリにインストール
curl -fsSL https://cc-craft-kit.dev/install.sh | sh -s -- /path/to/project

# 新規ディレクトリを作成してインストール
curl -fsSL https://cc-craft-kit.dev/install.sh | sh -s -- --project my-new-project
```

インストールスクリプトは以下を自動的に実行します。

- `.cc-craft-kit/` ディレクトリの作成
- `.claude/commands/cft` シンボリックリンクの作成
- `.env` ファイルの生成
- プロジェクトの初期化

### 方法2: 開発者向けクローン

開発に参加する場合や、最新のソースコードから実行する場合は、以下の手順でクローンします。

```bash
# リポジトリクローン
git clone https://github.com/B16B1RD/cc-craft-kit.git
cd cc-craft-kit

# 依存関係インストール
npm install

# ドッグフーディング環境へ同期
npm run sync:dogfood
```

## ステップ2: 環境変数設定

`.env.example`をコピーして`.env`を作成し、必要な情報を入力します。

```bash
cp .env.example .env
```

`.env`ファイルを編集してください。

```env
# GitHub Personal Access Token (オプション)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# GitHub組織名・ユーザー名
GITHUB_OWNER=your-username

# ベースブランチ（デフォルト: develop）
BASE_BRANCH=develop

# ログレベル
LOG_LEVEL=info
```

**重要**: `BASE_BRANCH` は、仕様書作成時に自動生成されるブランチの派生元を指定します。デフォルトは `develop` です。ブランチはカレントブランチからではなく、この BASE_BRANCH から派生します。

### GitHub Token取得方法

重要: 個人アカウントで Projects v2 を使用する場合は、Classic Personal Access Token が必須です。

#### Classic Personal Access Token の作成（個人アカウント向け）

1. GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)**
2. "Generate new token (classic)" をクリック
3. 必要なスコープを選択:
   - `repo` - リポジトリへのフルアクセス
   - `project` - Projects v2 の読み書き
4. トークンを生成してコピーし、`.env` に貼り付け

#### Fine-grained Personal Access Token（Organization のみ）

Organization の Projects を使用する場合のみ、Fine-grained PAT が利用可能です。

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. "Generate new token" をクリック
3. Repository permissions と Projects permissions を設定
4. トークンをコピーして `.env` に貼り付け

注意: Fine-grained PAT は個人アカウントの Projects v2 には対応していません（2025 年 1 月時点）。個人アカウントで Projects を使用する場合は、必ず Classic PAT を使用してください。

## ステップ3: プロジェクト初期化

Claude Code CLI 内で、cc-craft-kit プロジェクトを初期化します。

```bash
/cft:init
```

これにより、以下が作成されます。

- `.cc-craft-kit/` ディレクトリ
- `.cc-craft-kit/config.json` - プロジェクト設定
- `.cc-craft-kit/cc-craft-kit.db` - SQLite データベース

## ステップ4: 最初の仕様書作成

新しい仕様書を作成します。Claude Code でスラッシュコマンドを使用します。

```bash
/cft:spec-create "ユーザー認証機能" "メール/パスワード認証とOAuth2.0対応"
```

Claude Code が以下の質問をします。

- 機能概要
- 対象ユーザー
- 受け入れ基準
- 制約条件
- 依存関係

回答すると、Requirements 定義書が自動生成されます。

## ステップ5: 仕様書の一覧確認

作成した仕様書を確認します。

```bash
/cft:spec-list
```

フェーズでフィルタリングも可能です。

```bash
/cft:spec-list requirements
```

## ステップ6: プロジェクト状況確認

プロジェクト全体の状況を確認します。

```bash
/cft:status
```

以下の情報が表示されます。

- プロジェクト情報
- 仕様書統計
- 最近の活動
- 次のアクション

## 次のステップ

### Requirementsフェーズ完了後

1. 仕様書を承認
2. Design フェーズへ移行
3. Design 定義書を作成

### GitHub連携を有効にする場合

GitHub 統合機能を使用して、以下が自動化されます。

1. **Issue 自動作成**: 仕様書作成時に GitHub Issue を自動作成
2. **Project 自動追加**: `GITHUB_PROJECT_NAME` 環境変数または `project_id` が設定されている場合、Issue を自動的に Projects ボードに追加
3. **フェーズ同期**: 仕様書のフェーズ変更時に Issue ラベルを自動更新
4. **進捗管理**: Issue コメントに進捗、エラー解決策、Tips を記録してナレッジベース化

#### GitHub 統合の初期化

```bash
/cft:github-init <owner> <repo>
```

#### Project 自動追加の設定

仕様書作成時に自動的に Projects ボードに追加するには、以下のいずれかを設定します。

##### 方法1: 環境変数で設定（推奨）

`.env` ファイルに以下を追加します。

```env
GITHUB_PROJECT_NAME="My Project Board"
```

##### 方法2: config.json で設定

`.cc-craft-kit/config.json` に以下を追加します。

```json
{
  "github": {
    "owner": "your-username",
    "repo": "your-repo",
    "project_id": 1
  }
}
```

設定後、仕様書を作成すると自動的に以下が実行されます。

1. GitHub Issue 作成
2. Projects ボードに追加（設定がある場合）
3. 適切なラベル付与（`phase:requirements` など）

#### Projects の推奨ビュー設定

GitHub Projects v2 を効果的に活用するには、ビューのカスタマイズが重要です。

cc-craft-kit では、以下の 3 つのビューを推奨しています。

1. **Status Board** (Board) - カンバンスタイルでタスクの進捗を視覚的に管理
2. **All Tasks** (Table) - 全タスクの詳細確認・強力なフィルタリング
3. **Timeline** (Roadmap) - スケジュールとマイルストーンの可視化（オプション）

詳しい設定方法とベストプラクティスは、[GitHub Projects v2 推奨ビュー設定ガイド](./GITHUB_PROJECTS.md)を参照してください。

## トラブルシューティング

### ビルドエラー

```bash
# TypeScriptのビルドを確認
npm run build

# エラーの詳細を確認
npm run typecheck
```

### データベースエラー

```bash
# データベースを再初期化
rm .cc-craft-kit/cc-craft-kit.db
npm run db:migrate
```

### スラッシュコマンドが認識されない

1. `.claude/commands/cc-craft-kit/` が `src/slash-commands/` へのシンボリックリンクになっているか確認

   ```bash
   ls -la .claude/commands/cc-craft-kit
   ```

2. `src/slash-commands/` に `.md` ファイルが存在するか確認
3. `.cc-craft-kit/commands/` に TypeScript ファイルが同期されているか確認

   ```bash
   npm run check:sync
   npm run sync:dogfood
   ```

4. Claude Code を再起動

## 高度なコマンド

### サブエージェント起動

コードレビューやテスト生成を自動化するサブエージェントを利用できます。

```bash
# コードレビュー実行
/cft:code-review src/**/*.ts

# テスト自動生成
/cft:test-generate src/core/database/*.ts

# リファクタリング支援
/cft:refactor src/commands/**/*.ts
```

### スキル起動

型チェックやスキーマ検証を実行します。

```bash
# TypeScript/ESLint チェック
/cft:lint-check

# データベーススキーマ検証
/cft:schema-validate
```

### タスク管理ワークフロー

design フェーズで自動生成された Sub Issue を使ったワークフローです。

```bash
# Sub Issue 一覧を確認
/cft:task list <spec-id>

# タスク開始（ブランチ作成＆アサイン）
/cft:task start <issue-number>

# タスク完了（Sub Issue クローズ＆ PR 作成）
/cft:task done <issue-number>

# PR マージ後のブランチ削除
/cft:pr-cleanup <spec-id>
```

### 品質管理

```bash
# 同期状態チェック
/cft:sync check

# 同期修復
/cft:sync repair
```

### ナレッジベース活用

GitHub Issue をナレッジベースとして活用します。

```bash
# 進捗を記録
/cft:knowledge progress <spec-id> "認証機能の基本実装が完了"

# エラー解決策を記録
/cft:knowledge error <spec-id> "CORSエラー" "Access-Control-Allow-Origin ヘッダーを追加"

# Tips を記録
/cft:knowledge tip <spec-id> "performance" "useMemo でレンダリングを最適化"
```

## さらに学ぶ

- [アーキテクチャドキュメント](./ARCHITECTURE.md)
- [GitHub Projects v2 推奨ビュー設定ガイド](./GITHUB_PROJECTS.md)
- [TDD ガイド](./TDD_GUIDE.md)
- [サブエージェント・スキルガイド](./SUBAGENTS_AND_SKILLS_GUIDE.md)

---

**cc-craft-kit (匠)** - 匠の技で、開発ワークフローを磨き上げる。
