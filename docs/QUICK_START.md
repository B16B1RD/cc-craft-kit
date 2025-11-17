# Takumi クイックスタートガイド

このガイドでは、Takumi プロジェクトの初期セットアップから、最初の仕様書作成までの手順を説明します。

## 前提条件

- Node.js 18 以上がインストールされていること
- Claude Code CLI が利用可能であること
- GitHub アカウント(GitHub 連携を使用する場合)

## ステップ1: インストール

```bash
# リポジトリクローン
git clone https://github.com/yourusername/takumi.git
cd takumi

# 依存関係インストール
npm install

# ビルド
npm run build

# データベース初期化
npm run db:migrate
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

# ログレベル
LOG_LEVEL=info
```

### GitHub Token取得方法

**重要**: 個人アカウントで Projects v2 を使用する場合は、**Classic Personal Access Token** が必須です。

#### Classic Personal Access Token の作成（個人アカウント向け）

1. GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)**
2. "Generate new token (classic)" をクリック
3. 必要なスコープを選択:
   - ✅ `repo` - リポジトリへのフルアクセス
   - ✅ `project` - Projects v2 の読み書き
4. トークンを生成してコピーし、`.env` に貼り付け

#### Fine-grained Personal Access Token（Organization のみ）

Organization の Projects を使用する場合のみ、Fine-grained PAT が利用可能です。

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. "Generate new token" をクリック
3. Repository permissions と Projects permissions を設定
4. トークンをコピーして `.env` に貼り付け

> **注意**: Fine-grained PAT は個人アカウントの Projects v2 には対応していません（2025年1月時点）。個人アカウントで Projects を使用する場合は、必ず Classic PAT を使用してください。

## ステップ3: ドッグフーディング環境のセットアップ

Takumi 自身を使って開発するため、`.takumi/` ディレクトリに同期します。

```bash
# ビルド + 同期
npm run build:dogfood

# または個別に実行
npm run build
npm run sync:dogfood
```

## ステップ4: プロジェクト初期化

Claude Code CLI 内で、Takumi プロジェクトを初期化します。

```bash
/takumi:init my-awesome-app "革新的なWebアプリケーション"
```

これにより、以下が作成されます。

- `.takumi/` ディレクトリ
- `.takumi/config.json` - プロジェクト設定
- `.takumi/takumi.db` - SQLite データベース

## ステップ5: 最初の仕様書作成

新しい仕様書を作成します。Claude Code でスラッシュコマンドを使用します。

```bash
/takumi:spec-create "ユーザー認証機能" "メール/パスワード認証とOAuth2.0対応"
```

Claude Code が以下の質問をします。

- 機能概要
- 対象ユーザー
- 受け入れ基準
- 制約条件
- 依存関係

回答すると、Requirements 定義書が自動生成されます。

## ステップ6: 仕様書の一覧確認

作成した仕様書を確認します。

```bash
/takumi:spec-list
```

フェーズでフィルタリングも可能です。

```bash
/takumi:spec-list requirements
```

## ステップ7: プロジェクト状況確認

プロジェクト全体の状況を確認します。

```bash
/takumi:status
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
/takumi:github-init <owner> <repo>
```

#### Project 自動追加の設定

仕様書作成時に自動的に Projects ボードに追加するには、以下のいずれかを設定します。

##### 方法1: 環境変数で設定（推奨）

`.env` ファイルに以下を追加します。

```env
GITHUB_PROJECT_NAME="My Project Board"
```

##### 方法2: config.json で設定

`.takumi/config.json` に以下を追加します。

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

Takumi では、以下の 3 つのビューを推奨しています。

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
rm .takumi/takumi.db
npm run db:migrate
```

### スラッシュコマンドが認識されない

1. `.claude/commands/takumi/` が `src/slash-commands/` へのシンボリックリンクになっているか確認

   ```bash
   ls -la .claude/commands/takumi
   ```

2. `src/slash-commands/` に `.md` ファイルが存在するか確認
3. `.takumi/commands/` に TypeScript ファイルが同期されているか確認

   ```bash
   npm run check:sync
   npm run sync:dogfood
   ```

4. Claude Code を再起動

## さらに学ぶ

- [テンプレートカスタマイズガイド](./TEMPLATES.md)
- [アーキテクチャドキュメント](./ARCHITECTURE.md)

---

**Takumi (匠)** - 匠の技で、開発ワークフローを磨き上げる。
