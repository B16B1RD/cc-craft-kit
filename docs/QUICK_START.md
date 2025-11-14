# Takumi クイックスタートガイド

このガイドでは、Takumiプロジェクトの初期セットアップから、最初の仕様書作成までの手順を説明します。

## 前提条件

- Node.js 18以上がインストールされていること
- Claude Code CLIが利用可能であること
- GitHubアカウント(GitHub連携を使用する場合)

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

`.env.example`をコピーして`.env`を作成し、必要な情報を入力します:

```bash
cp .env.example .env
```

`.env`ファイルを編集:

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
3. 必要なスコープを選択:
   - `repo` - リポジトリ全体へのアクセス
   - `project` - Projects v2へのアクセス
4. トークンをコピーして`.env`に貼り付け

## ステップ3: MCPサーバー設定

Claude Code CLIの設定ファイルに、Takumi MCPサーバーを追加します。

`~/.config/claude/claude_desktop_config.json` (または適切なパス)を編集:

```json
{
  "mcpServers": {
    "takumi": {
      "command": "node",
      "args": ["/absolute/path/to/takumi/dist/mcp/server.js"]
    }
  }
}
```

**重要:** `path/to/takumi`を実際のTakumiプロジェクトの絶対パスに置き換えてください。

## ステップ4: Claude Code CLI再起動

設定を反映するため、Claude Code CLIを再起動します。

```bash
# Claude Code CLIを再起動
```

## ステップ5: プロジェクト初期化

Claude Code CLI内で、Takumiプロジェクトを初期化します。

```
/takumi:init my-awesome-app "革新的なWebアプリケーション"
```

これにより、以下が作成されます:
- `.takumi/` ディレクトリ
- `.takumi/config.json` - プロジェクト設定
- `.takumi/takumi.db` - SQLiteデータベース

## ステップ6: 最初の仕様書作成

新しい仕様書を作成します。

```
/takumi:spec-create "ユーザー認証機能" "メール/パスワード認証とOAuth2.0対応"
```

Claude Codeが以下の質問をします:
- 機能概要
- 対象ユーザー
- 受け入れ基準
- 制約条件
- 依存関係

回答すると、Requirements定義書が自動生成されます。

## ステップ7: 仕様書一覧確認

作成した仕様書を確認します。

```
/takumi:spec-list
```

フェーズでフィルタリングも可能:

```
/takumi:spec-list requirements
```

## ステップ8: プロジェクト状況確認

プロジェクト全体の状況を確認します。

```
/takumi:status
```

以下の情報が表示されます:
- プロジェクト情報
- 仕様書統計
- 最近の活動
- 次のアクション

## 次のステップ

### Requirementsフェーズ完了後

1. 仕様書を承認
2. Designフェーズへ移行
3. Design定義書を作成

### GitHub連携を有効にする場合

Week 4以降のGitHub統合機能を使用して、以下が自動化されます:
- Issue自動作成
- Project Board管理
- Milestone連携
- 進捗同期

## トラブルシューティング

### MCPサーバーが起動しない

```bash
# ビルドを確認
npm run build

# MCPサーバーを直接起動してエラー確認
npm run mcp:dev
```

### データベースエラー

```bash
# データベースを再初期化
rm .takumi/takumi.db
npm run db:migrate
```

### スラッシュコマンドが認識されない

1. Claude Code CLIの設定ファイルを確認
2. MCPサーバーのパスが正しいか確認
3. Claude Code CLIを再起動

## さらに学ぶ

- [MCPツールAPIリファレンス](./MCP_TOOLS.md)
- [テンプレートカスタマイズガイド](./TEMPLATES.md)
- [アーキテクチャドキュメント](./ARCHITECTURE.md)

---

**Takumi (匠)** - 匠の技で、開発ワークフローを磨き上げる
