# MCPサーバー版からCLI版への移行ガイド

このガイドでは、Takumi v0.1.0（MCPサーバー版）からv0.2.0（CLI版）への移行手順を説明します。

## 🎯 移行の背景

### なぜCLI版に移行するのか？

1. **セットアップの簡素化**: MCPサーバーの起動・設定が不要
2. **安定性の向上**: 接続エラーやタイムアウトの問題を解消
3. **デバッグの容易化**: コマンドライン出力で問題を即座に特定
4. **パフォーマンス**: MCPプロトコルのオーバーヘッドを削減

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

**削除前の `claude_desktop_config.json`:**
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

**削除後:**
```json
{
  "mcpServers": {}
}
```

### Step 4: 既存プロジェクトの確認

既存の `.takumi` ディレクトリは変更なく使用できます。

```bash
# プロジェクト状態を確認
takumi status

# 仕様書一覧を確認
takumi spec list
```

## 🔄 コマンド変換表

### プロジェクト管理

| MCP版（v0.1.x） | CLI版（v0.2.0） |
|---|---|
| `takumi:init_project({ projectName: "..." })` | `takumi init "..."` |
| MCPツール: `takumi:init_project` | コマンド: `takumi init` |

### 仕様書管理

| MCP版（v0.1.x） | CLI版（v0.2.0） |
|---|---|
| `takumi:create_spec({ name: "...", description: "..." })` | `takumi spec create "..." "..."` |
| `takumi:list_specs({ phase: "requirements" })` | `takumi spec list requirements` |
| `takumi:get_spec({ id: "..." })` | `takumi spec get ...` |

### GitHub統合

| MCP版（v0.1.x） | CLI版（v0.2.0） |
|---|---|
| `takumi:github_init({ owner: "...", repo: "..." })` | `takumi github init ... ...` |
| `takumi:github_create_issue({ specId: "..." })` | `takumi github issue create ...` |
| `takumi:sync_spec_to_github({ specId: "..." })` | `takumi github sync to-github ...` |
| `takumi:sync_github_to_spec({ specId: "..." })` | `takumi github sync from-github ...` |
| `takumi:add_spec_to_project({ specId: "...", projectNumber: N })` | `takumi github project add ... N` |

### ナレッジベース

| MCP版（v0.1.x） | CLI版（v0.2.0） |
|---|---|
| `takumi:record_progress({ specId: "...", summary: "..." })` | `takumi knowledge progress ... "..."` |
| `takumi:record_error_solution({ specId: "...", errorDescription: "...", solution: "..." })` | `takumi knowledge error ... "..." "..."` |
| `takumi:record_tip({ specId: "...", title: "...", content: "..." })` | `takumi knowledge tip ... "..." "..."` |

## 📝 スラッシュコマンドの更新

`.claude/commands/takumi/` 内のスラッシュコマンドは自動的に更新されます。

**更新前（MCP版）:**
```markdown
MCP ツール `takumi:init_project` を呼び出してプロジェクトを初期化してください。
```

**更新後（CLI版）:**
```markdown
以下のコマンドを実行してプロジェクトを初期化してください:

\`\`\`bash
takumi init "$1"
\`\`\`
```

## 🐛 トラブルシューティング

### Q: 既存の仕様書が表示されない

**A:** データベースの互換性は保たれています。以下を確認してください：

```bash
# データベースファイルの存在確認
ls -la .takumi/takumi.db

# ファイルが存在する場合、仕様書一覧を表示
takumi spec list
```

### Q: GitHub統合が動作しない

**A:** GITHUB_TOKEN環境変数を再設定してください：

```bash
# トークンを設定
export GITHUB_TOKEN="your_token_here"

# または .env ファイルに記載
echo "GITHUB_TOKEN=your_token_here" >> .env

# GitHub初期化を再実行
takumi github init <owner> <repo>
```

### Q: コマンドが見つからない (command not found: takumi)

**A:** グローバルインストールを実行してください：

```bash
cd /path/to/takumi
npm link

# または、直接実行
node /path/to/takumi/dist/cli/index.js --help
```

## ✅ 移行チェックリスト

- [ ] 既存データのバックアップ完了
- [ ] 新しいバージョンのビルド完了
- [ ] MCP設定の削除完了
- [ ] `takumi status` で既存プロジェクト確認完了
- [ ] `takumi spec list` で仕様書一覧確認完了
- [ ] GITHUB_TOKEN環境変数の設定完了
- [ ] GitHub統合の動作確認完了
- [ ] スラッシュコマンドの動作確認完了

## 🎉 移行完了後の確認

```bash
# プロジェクト状態を確認
takumi status

# すべてのコマンドが利用可能か確認
takumi --help

# スラッシュコマンドが動作するか確認
/takumi:status
```

## 📚 参考リソース

- [README.md](../README.md) - 基本的な使い方
- [CLAUDE.md](../CLAUDE.md) - Claude Code 統合ガイド
- [CLIコマンドリファレンス](./CLI_REFERENCE.md) - 全コマンドの詳細説明

## 💡 追加の利点

CLI版に移行することで、以下の新機能が利用可能になります：

1. **パイプライン対応**: 他のコマンドとの組み合わせが可能
2. **CI/CD統合**: GitHub Actionsなどで自動化が容易
3. **スクリプト化**: シェルスクリプトでの自動化が簡単
4. **リモート実行**: SSHでリモートサーバーからも実行可能

```bash
# 例: 仕様書を自動作成してGitHub Issueに変換
takumi spec create "新機能" "説明" && \
  takumi github issue create $(takumi spec list | grep "新機能" | awk '{print $1}')
```

---

移行に関するご質問は、[GitHub Issues](https://github.com/yourusername/takumi/issues) でお気軽にお問い合わせください。
