# Takumi（匠）- 統合開発キット

Claude Code 上で**仕様駆動開発（SDD）**、**GitHub Projects/Issues 完全連携**を実現する開発支援ツールキット。

## 🎯 コンセプト

Takumi（匠）は、CLIベースのシンプルなアーキテクチャで、開発ワークフローを革新します。

### 核心的特徴

- **CLI中心設計**: 複雑なMCPサーバー不要、シンプルなコマンドラインツール
- **GitHub 完全統合**: Projects v2、Issue、Milestone の自動管理
- **Issue ナレッジベース化**: 課題管理＋途中経過＋エラー対策＋Tips の統合記録
- **仕様駆動開発**: Requirements → Design → Tasks → Implementation の構造化ワークフロー
- **スラッシュコマンド連携**: Claude Code のカスタムコマンドで即座にアクセス

## 🚀 クイックスタート

### 前提条件

- Node.js 18 以上
- TypeScript 5.0 以上
- Claude Code CLI
- GitHub Personal Access Token（Fine-grained PAT 推奨）

### インストール

```bash
# リポジトリクローン
git clone https://github.com/yourusername/takumi.git
cd takumi

# 依存関係インストール
npm install

# ビルド
npm run build

# グローバルインストール（オプション）
npm link
```

### 環境変数設定

```bash
# GitHub Personal Access Token を設定
export GITHUB_TOKEN="your_github_token_here"

# または .env ファイルに記載
echo "GITHUB_TOKEN=your_github_token_here" > .env
```

### プロジェクト初期化

```bash
# Takumi プロジェクトを初期化
takumi init my-project

# または Claude Code のスラッシュコマンド経由
/takumi:init my-project
```

## 📚 使い方

### 基本コマンド

```bash
# プロジェクト状態確認
takumi status

# 仕様書作成
takumi spec create "ユーザー認証機能" "メール/パスワード認証とOAuth2.0対応"

# 仕様書一覧
takumi spec list
takumi spec list requirements  # フェーズでフィルタ

# 仕様書詳細表示
takumi spec get <spec-id>

# フェーズ移行
takumi spec phase <spec-id> design
```

### GitHub統合

```bash
# GitHub初期化
takumi github init <owner> <repo>

# Issue作成
takumi github issue create <spec-id>

# 双方向同期
takumi github sync to-github <spec-id>
takumi github sync from-github <spec-id>

# Projectボード追加
takumi github project add <spec-id> <project-number>
```

### ナレッジベース記録

```bash
# 進捗記録
takumi knowledge progress <spec-id> "認証機能の基本実装が完了"

# エラー解決策記録
takumi knowledge error <spec-id> "CORSエラーが発生" "Access-Control-Allow-Originヘッダーを追加"

# Tips記録
takumi knowledge tip <spec-id> "performance" "useMemoを使ってレンダリングを最適化"
```

### Claude Code スラッシュコマンド

```bash
/takumi:init my-project              # プロジェクト初期化
/takumi:status                       # 状態表示
/takumi:spec-create "機能名" "説明"  # 仕様書作成
/takumi:spec-list                    # 仕様書一覧
/takumi:spec-get <id>                # 仕様書詳細
/takumi:spec-phase <id> <phase>      # フェーズ更新
/takumi:github-init <owner> <repo>   # GitHub初期化
```

## 🏗️ アーキテクチャ

### ディレクトリ構造

```text
takumi/
├── .claude/                 # Claude Code統合
│   └── commands/takumi/     # カスタムスラッシュコマンド（13コマンド）
├── src/
│   ├── cli/                 # CLIコマンド実装
│   │   ├── index.ts         # CLIエントリーポイント
│   │   ├── commands/        # コマンド実装
│   │   │   ├── init.ts
│   │   │   ├── status.ts
│   │   │   ├── spec/        # 仕様書管理
│   │   │   ├── github/      # GitHub統合
│   │   │   └── knowledge/   # ナレッジベース
│   │   └── utils/           # ユーティリティ
│   │       ├── output.ts    # 出力フォーマッター
│   │       ├── error-handler.ts
│   │       └── validation.ts
│   ├── core/
│   │   ├── database/        # Kysely + SQLite
│   │   ├── events/          # EventEmitter2
│   │   └── templates/       # Handlebars
│   ├── integrations/        # 外部統合
│   │   └── github/          # GitHub API (REST + GraphQL)
│   └── plugins/             # プラグインシステム
├── templates/               # 仕様書テンプレート
└── .takumi/                 # ローカルプロジェクトデータ
    ├── takumi.db            # SQLiteデータベース
    ├── config.json          # プロジェクト設定
    └── specs/               # 仕様書ファイル (.md)
```

### 技術スタック

| カテゴリ     | 技術            | 用途                       |
| ------------ | --------------- | -------------------------- |
| 言語         | TypeScript 5.0+ | 型安全な開発               |
| ランタイム   | Node.js 18+     | CLI実行                    |
| データベース | SQLite + Kysely | ローカルデータ管理         |
| GitHub API   | Octokit         | REST + GraphQL統合         |
| DI           | TSyringe        | 依存性注入                 |
| イベント     | EventEmitter2   | イベント駆動アーキテクチャ |
| CLI          | Node.js parseArgs | コマンドライン引数パース |

### データベーススキーマ

```sql
-- 仕様書
CREATE TABLE specs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  phase TEXT NOT NULL, -- requirements/design/tasks/implementation/completed
  github_issue_id INTEGER,
  github_project_id TEXT,
  github_milestone_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- タスク
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES specs(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL, -- todo/in_progress/blocked/review/done
  priority INTEGER NOT NULL,
  github_issue_id INTEGER,
  github_issue_number INTEGER,
  assignee TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ログ
CREATE TABLE logs (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id),
  spec_id TEXT REFERENCES specs(id),
  action TEXT NOT NULL,
  level TEXT NOT NULL, -- debug/info/warn/error
  message TEXT NOT NULL,
  metadata TEXT, -- JSON
  timestamp TEXT NOT NULL
);

-- GitHub同期
CREATE TABLE github_sync (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL, -- spec/task
  entity_id TEXT NOT NULL,
  github_id TEXT NOT NULL,
  github_number INTEGER,
  last_synced_at TEXT NOT NULL,
  sync_status TEXT NOT NULL, -- success/failed/pending
  error_message TEXT
);
```

## 🛠️ 開発

### スクリプト

```bash
# ビルド
npm run build

# 開発モード(ホットリロード)
npm run dev

# テスト
npm test
npm run test:watch
npm run test:coverage

# リント・フォーマット
npm run lint
npm run lint:fix
npm run format

# 型チェック
npm run typecheck

# データベースマイグレーション
npm run db:migrate        # マイグレーション実行
npm run db:migrate down   # ロールバック
```

### テスト

```bash
# 全テスト実行
npm test

# カバレッジレポート生成
npm run test:coverage

# ウォッチモード
npm run test:watch
```

## 📋 実装ロードマップ

### ✅ Phase 1: コア基盤 (Week 1-3) - 完了

- [x] プロジェクト初期化
- [x] Kysely + SQLite セットアップ
- [x] MCP サーバー骨組み
- [x] 基本 MCP ツール (`init_project`, `create_spec`, `list_specs`, `get_spec`)
- [x] テンプレートエンジン統合 (Handlebars)
- [x] E2E テスト実装

### ✅ Phase 2: GitHub 統合 (Week 4-6) - 完了

- [x] Octokit 統合 (REST + GraphQL)
- [x] Issue 自動作成・更新
- [x] Projects v2 ボード管理
- [x] Issue ナレッジベース化機能
- [x] 双方向の同期機構
- [x] Webhook 統合

### ✅ Phase 3: サブエージェント + スキル (Week 7-10) - 完了

- [x] 7 つのコアサブエージェント実装
  - RequirementsAnalyzer, TaskBreakdowner, CodeReviewer
  - ArchitectDesigner, CodeGenerator, TestCreator, DocumentationWriter
- [x] 5 つのコアスキル実装
  - RequirementsDocGenerator, ArchitectureDiagramGenerator
  - CodeQualityAnalyzer, TestCoverageReporter, GitHubIssueSync
- [x] イベント駆動ワークフロー (EventBus, 12 種類のイベント)
- [x] Story-to-Done パイプライン (自動ワークフロー)

### ✅ Phase 4: プラグイン + UI (Week 11-14) - 完了

- [x] プラグインアーキテクチャ (Registry + Loader)
- [x] 公式プラグイン実装
  - Backlog 統合プラグイン
  - Slack 通知プラグイン
- [x] プラグインライフサイクル管理
- [x] イベントハンドラー拡張機能

### ✅ Phase 5: 最適化 (Week 15+) - 完了

- [x] パフォーマンスプロファイラー実装
- [x] キャッシュ機構実装
- [x] セキュリティバリデーター実装
- [x] CI/CD 統合 (GitHub Actions)
- [x] 型安全性の向上 (121 個の`any`型を全て削除)
- [x] ESLint 警告 0 個達成
- [ ] WebUI ダッシュボード (オプション)
- [ ] コミュニティエコシステム

## 🤝 コントリビューション

コントリビューションを歓迎します。以下の手順でお願いします。

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### コミットメッセージ規約

Conventional Commits 形式を推奨します。

- `feat:` - 新機能
- `fix:` - バグ修正
- `refactor:` - リファクタリング
- `docs:` - ドキュメント変更
- `test:` - テスト追加・修正
- `chore:` - 雑務

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。

## 🙏 謝辞

本プロジェクトは以下のプロジェクトから着想を得ています。

- **Kiro AI** - 仕様駆動 IDE のパイオニア
- **cc-sdd** - 構造化ワークフローの実装
- **spec-workflow-mcp** - MCP サーバーアーキテクチャ
- **GitHub Spec Kit** - constitution.md コンセプト

また、以下の哲学・手法を実装に反映しています。

- **Kent Beck** - Canon TDD
- **t-wada (和田卓人)** - 3 レベル TDD 理解
- **Martin Fowler** - リファクタリングカタログ

## 📮 コンタクト

質問・提案・バグ報告は [Issues](https://github.com/yourusername/takumi/issues) へお願いします。

---

**Takumi (匠)** - 匠の技で、開発ワークフローを磨き上げる。
