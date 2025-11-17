# MCPサーバー版からスラッシュコマンド版への移行ガイド

このガイドでは、Takumi v0.1.0（MCP サーバー版）から v0.2.0+（スラッシュコマンド版）への移行手順を説明します。

## 🎯 移行の背景

### なぜスラッシュコマンド版に移行するのか

1. **セットアップの簡素化** - MCP サーバーの起動・設定が不要
2. **安定性の向上** - 接続エラーやタイムアウトの問題を解消
3. **Claude Code との統合** - Claude Code のネイティブ機能を活用
4. **パフォーマンス** - MCP プロトコルのオーバーヘッドを削減
5. **ソースコード管理** - すべてのコードが `src/` 配下で Git 管理される

## 📋 移行手順

### Step 1: 既存データのバックアップ

```bash
# 既存の.takumiディレクトリをバックアップ
cp -r .takumi .takumi.backup

# または tar で圧縮
tar -czf takumi-backup-$(date +%Y%m%d).tar.gz .takumi
```

### Step 2: 新しいバージョンへの更新

```bash
cd /path/to/takumi

# 最新版を取得
git pull origin main

# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install

# ビルド
npm run build
```

### Step 3: MCP設定の削除

Claude Code の設定から MCP サーバー設定を削除します。

**削除前の `claude_desktop_config.json`**。

```json
{
  "mcpServers": {
    "takumi": {
      "command": "node",
      "args": ["/path/to/takumi/dist/mcp/server.js"]
    }
  }
}
```

**削除後**。

```json
{
  "mcpServers": {}
}
```

### Step 4: ドッグフーディング環境のセットアップ

ビルド後、`.takumi/` ディレクトリに同期します。

```bash
# ビルド + 同期
npm run build:dogfood
```

### Step 5: 既存プロジェクトの確認

既存の `.takumi` ディレクトリは変更なく使用できます。

```bash
# プロジェクト状態を確認
/takumi:status

# 仕様書一覧を確認
/takumi:spec-list
```

## 🔄 コマンド変換表

### プロジェクト管理

| MCP版（v0.1.x） | スラッシュコマンド版（v0.2.0+） |
|---|---|
| `takumi:init_project({ projectName: "..." })` | `/takumi:init "..."` |
| MCPツール: `takumi:init_project` | スラッシュコマンド: `/takumi:init` |
| MCPツール: `takumi:project_status` | スラッシュコマンド: `/takumi:status` |

### 仕様書管理

| MCP版（v0.1.x） | スラッシュコマンド版（v0.2.0+） |
|---|---|
| `takumi:create_spec({ name: "...", description: "..." })` | `/takumi:spec-create "..." "..."` |
| `takumi:list_specs({ phase: "requirements" })` | `/takumi:spec-list requirements` |
| `takumi:get_spec({ id: "..." })` | `/takumi:spec-get ...` |
| `takumi:update_spec_phase({ id: "...", phase: "..." })` | `/takumi:spec-phase ... ...` |

### GitHub統合

| MCP版（v0.1.x） | スラッシュコマンド版（v0.2.0+） |
|---|---|
| `takumi:github_init({ owner: "...", repo: "..." })` | `/takumi:github-init ... ...` |
| `takumi:github_create_issue({ specId: "..." })` | `/takumi:github-issue-create ...` |
| `takumi:sync_spec_to_github({ specId: "..." })` | `/takumi:github-sync to-github ...` |
| `takumi:sync_github_to_spec({ specId: "..." })` | `/takumi:github-sync from-github ...` |
| `takumi:add_spec_to_project({ specId: "...", projectNumber: N })` | `/takumi:github-project-add ... N` |

### ナレッジベース

| MCP版（v0.1.x） | スラッシュコマンド版（v0.2.0+） |
|---|---|
| `takumi:record_progress({ specId: "...", summary: "..." })` | `/takumi:knowledge-progress ... "..."` |
| `takumi:record_error_solution({ specId: "...", errorDescription: "...", solution: "..." })` | `/takumi:knowledge-error ... "..." "..."` |
| `takumi:record_tip({ specId: "...", title: "...", content: "..." })` | `/takumi:knowledge-tip ... "..." "..."` |

## 📝 スラッシュコマンドの更新

`.claude/commands/takumi/` は `src/slash-commands/` へのシンボリックリンクになっています。

**更新前（MCP版）**。

```markdown
MCP ツール `takumi:init_project` を呼び出してプロジェクトを初期化してください。
```

**更新後（スラッシュコマンド版）**。

```markdown
以下のコマンドを実行してプロジェクトを初期化してください。

\`\`\`bash
npx tsx .takumi/commands/init.ts "$1"
\`\`\`
```

ユーザーは `/takumi:init` と入力するだけで、上記のコマンドが自動的に実行されます。

## 🐛 トラブルシューティング

### Q: 既存の仕様書が表示されない

**A:** データベースの互換性は保たれています。以下を確認してください。

```bash
# データベースファイルの存在確認
ls -la .takumi/takumi.db

# ファイルが存在する場合、仕様書一覧を表示
/takumi:spec-list
```

### Q: GitHub統合が動作しない

**A:** GITHUB_TOKEN 環境変数を再設定してください。

**重要**: 個人アカウントで Projects v2 を使用する場合は、**Classic Personal Access Token** が必須です。

```bash
# Classic Personal Access Token を作成
# 1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
# 2. "Generate new token (classic)" をクリック
# 3. スコープで 'repo' と 'project' を選択

# トークンを設定
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"

# または .env ファイルに記載
echo "GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx" >> .env

# GitHub初期化を再実行
/takumi:github-init <owner> <repo>
```

> **注意**: Fine-grained Personal Access Token は個人アカウントの Projects v2 には対応していません。Organization の Projects を使用する場合のみ利用可能です。

### Q: スラッシュコマンドが認識されない

**A:** シンボリックリンクと同期状態を確認してください。

```bash
# シンボリックリンクの確認
ls -la .claude/commands/takumi

# 同期されているか確認
npm run check:sync

# 再同期
npm run build:dogfood

# Claude Code を再起動
```

## ✅ 移行チェックリスト

- [ ] 既存データのバックアップ完了
- [ ] 新しいバージョンのビルド完了
- [ ] MCP 設定の削除完了
- [ ] ドッグフーディング環境の同期完了（`npm run build:dogfood`）
- [ ] `/takumi:status` で既存プロジェクト確認完了
- [ ] `/takumi:spec-list` で仕様書の一覧確認完了
- [ ] GITHUB_TOKEN 環境変数の設定完了
- [ ] GitHub 統合の動作確認完了
- [ ] スラッシュコマンドの動作確認完了

## 🎉 移行完了後の確認

```bash
# ビルドと同期
npm run build:dogfood

# Claude Code でスラッシュコマンドを実行
# プロジェクト状態を確認
/takumi:status

# 仕様書一覧を確認
/takumi:spec-list
```

## 📚 参考リソース

- [README.md](../README.md) - 基本的な使い方
- [CLAUDE.md](../CLAUDE.md) - Claude Code 統合ガイド
- [QUICK_START.md](./QUICK_START.md) - クイックスタートガイド

## 💡 スラッシュコマンド版の利点

スラッシュコマンド版に移行することで、以下の利点があります。

1. **セットアップの簡素化** - MCP サーバーの起動・設定が不要
2. **安定性の向上** - 接続エラーやタイムアウトの問題を解消
3. **Claude Codeとの統合** - Claude Code のネイティブ機能を活用
4. **パフォーマンス** - MCP プロトコルのオーバーヘッドを削減
5. **ソースコード管理** - すべてのコードが `src/` 配下で Git 管理される

スラッシュコマンドは Claude Code 内で直接実行され、自然な対話フローで開発を進められます。

---

移行に関するご質問は、[GitHub Issues](https://github.com/yourusername/takumi/issues) でお気軽にお問い合わせください。
