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

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. "Generate new token"をクリック
3. 必要なスコープを選択してください。
   - `repo` - リポジトリ全体へのアクセス
   - `project` - Projects v2 へのアクセス
4. トークンをコピーして`.env`に貼り付け

## ステップ3: グローバルインストール (オプション)

takumi コマンドをグローバルに利用可能にします。

```bash
# グローバルリンク (開発時)
npm link

# または npm インストール (公開後)
npm install -g takumi
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

新しい仕様書を作成します。

### CLI コマンド使用

```bash
takumi spec create "ユーザー認証機能" "メール/パスワード認証とOAuth2.0対応"
```

### Claude Code スラッシュコマンド使用

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

### CLI コマンド

```bash
takumi spec list
```

### スラッシュコマンド

```bash
/takumi:spec-list
```

フェーズでフィルタリングも可能です。

```bash
takumi spec list requirements
/takumi:spec-list requirements
```

## ステップ7: プロジェクト状況確認

プロジェクト全体の状況を確認します。

### CLI コマンド

```bash
takumi status
```

### スラッシュコマンド

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

Week 4 以降の GitHub 統合機能を使用して、以下が自動化されます。

- Issue 自動作成
- Project Board 管理
- Milestone 連携
- 進捗同期

## トラブルシューティング

### CLI が起動しない

```bash
# ビルドを確認
npm run build

# CLI を直接起動してエラー確認
npm run dev
```

### データベースエラー

```bash
# データベースを再初期化
rm .takumi/takumi.db
npm run db:migrate
```

### スラッシュコマンドが認識されない

1. `.claude/commands/takumi/` ディレクトリが存在するか確認
2. カスタムスラッシュコマンドファイル (*.md) が正しく配置されているか確認
3. Claude Code を再起動

### コマンドが見つからないエラー

グローバルインストールを行ってください。

```bash
npm link
# または
npm install -g takumi
```

## さらに学ぶ

- [MCP からの移行ガイド](./MIGRATION_FROM_MCP.md)
- [テンプレートカスタマイズガイド](./TEMPLATES.md)
- [アーキテクチャドキュメント](./ARCHITECTURE.md)

---

**Takumi (匠)** - 匠の技で、開発ワークフローを磨き上げる。
