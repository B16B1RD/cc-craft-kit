# cc-craft-kit- 統合開発キット

Claude Code 上で**仕様駆動開発（SDD）**、**GitHub Projects/Issues 完全連携**を実現する開発支援ツールキット。

## 🎯 コンセプト

cc-craft-kit は、Claude Code 上のカスタムスラッシュコマンドで動作する軽量な開発支援ツールキットです。

### 核心的特徴

- スラッシュコマンド設計により、MCP サーバー不要でコンテキスト効率的なアーキテクチャを実現（MCP 比 99%削減）
- GitHub Projects v2、Issue、Milestone の完全統合による自動管理
- Issue をナレッジベース化し、課題管理＋途中経過＋エラー対策＋Tips を統合記録
- Requirements → Design → Tasks → Implementation の構造化ワークフローによる仕様駆動開発
- すべての機能を `.cc-craft-kit/` ディレクトリに集約し、既存プロジェクトと競合しない設計

## 🚀 クイックスタート

### 前提条件

- Node.js 18 以上
- TypeScript 5.0 以上
- Claude Code CLI
- GitHub Personal Access Token
  - 個人アカウントの場合、Classic Personal Access Token が必須（スコープ: `repo`, `project`）
  - Organization の場合、Fine-grained PAT または Classic PAT を使用（スコープ: `repo`, `project`）

### インストール

#### 方法1: curl コマンド経由（推奨）

```bash
# カレントディレクトリにインストール
curl -fsSL https://cc-craft-kit.dev/install.sh | sh

# 指定したディレクトリにインストール
curl -fsSL https://cc-craft-kit.dev/install.sh | sh -s -- /path/to/project

# 新規ディレクトリを作成してインストール
curl -fsSL https://cc-craft-kit.dev/install.sh | sh -s -- --project my-new-project
```

インストール後、Claude Code で `/cft:init my-project` を実行してプロジェクトを初期化します。

#### 方法2: 開発者向けクローン

開発に参加する場合や、最新のソースコードから実行する場合は、以下の手順でクローンします。

```bash
git clone https://github.com/B16B1RD/cc-craft-kit.git
cd cc-craft-kit
npm install
npm run sync:dogfood
```

### 環境変数設定

**個人アカウントで Projects v2 を使用する場合**、Classic Personal Access Token が必要です。

1. GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)**
2. "Generate new token (classic)" をクリック
3. スコープを選択:
   - `repo`（リポジトリへのフルアクセス）
   - `project`（Projects v2 の読み書き）
4. トークンを生成してコピー

```bash
# GitHub Personal Access Token を設定
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"

# または .env ファイルに記載
echo "GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx" > .env
```

注意: Fine-grained Personal Access Token は個人アカウントの Projects v2 には対応していません。Organization の Projects を使用する場合のみ Fine-grained PAT が利用可能です。

### プロジェクト初期化

Claude Code のチャットで以下のスラッシュコマンドを実行します。

```sh
/cft:init my-project
```

## 📚 使い方

### 基本コマンド

すべてのコマンドは Claude Code のチャットからスラッシュコマンドで実行します。

```sh
# プロジェクト状態確認
/cft:status

# 仕様書作成
/cft:spec-create "ユーザー認証機能" "メール/パスワード認証とOAuth2.0対応"

# 仕様書一覧
/cft:spec-list
/cft:spec-list requirements  # フェーズでフィルタ

# 仕様書詳細表示
/cft:spec-get <spec-id>

# フェーズ移行
/cft:spec-phase <spec-id> design
```

### GitHub統合

```sh
# GitHub初期化
/cft:github-init <owner> <repo>

# Issue作成（仕様書作成時に自動作成される）
/cft:github-issue-create <spec-id>

# Project自動追加の設定（.envファイルに追加）
echo "GITHUB_PROJECT_NAME=My Project Board" >> .env

# 双方向同期
/cft:github-sync to-github <spec-id>
/cft:github-sync from-github <spec-id>

# 手動でProjectボード追加
/cft:github-project-add <spec-id> <project-number>
```

#### Issue & Project 自動化

仕様書作成時に以下が自動実行されます。

1. **GitHub Issue 自動作成**: 仕様書の内容を Issue body として使用
2. **Project 自動追加**: `GITHUB_PROJECT_NAME` 環境変数または `project_id` が設定されている場合、自動的に Projects ボードに追加
3. **ラベル自動付与**: フェーズに応じたラベル（`phase:requirements` など）を自動設定

Project 追加が失敗した場合でも Issue 作成は成功し、警告メッセージが表示されます。

### ナレッジベース記録

```sh
# 進捗記録
/cft:knowledge-progress <spec-id> "認証機能の基本実装が完了"

# エラー解決策記録
/cft:knowledge-error <spec-id> "CORSエラーが発生" "Access-Control-Allow-Originヘッダーを追加"

# Tips記録
/cft:knowledge-tip <spec-id> "performance" "useMemoを使ってレンダリングを最適化"
```

### 全コマンド一覧

```sh
/cft:init my-project              # プロジェクト初期化
/cft:status                       # 状態表示
/cft:spec-create "機能名" "説明"  # 仕様書作成
/cft:spec-list                    # 仕様書一覧
/cft:spec-get <id>                # 仕様書詳細
/cft:spec-phase <id> <phase>      # フェーズ更新
/cft:github-init <owner> <repo>   # GitHub統合初期化
/cft:github-issue-create <id>     # Issue作成
/cft:github-sync <dir> <id>       # GitHub同期
/cft:github-project-add <id> <num> # Project追加
/cft:knowledge-progress <id> <msg> # 進捗記録
/cft:knowledge-error <id> <err> <sol> # エラー記録
/cft:knowledge-tip <id> <cat> <tip>   # Tips記録
```

## 🏗️ アーキテクチャ

### ディレクトリ構造

```text
cc-craft-kit/
├── .claude/                 # Claude Code統合
│   └── commands/cc-craft-kit/     # スラッシュコマンド定義（src/slash-commands/へのシンボリックリンク）
├── src/
│   ├── commands/            # コマンド実装（Git管理、.cc-craft-kit/にコピー）
│   │   ├── init.ts          # プロジェクト初期化
│   │   ├── status.ts        # プロジェクト状態表示
│   │   ├── spec/            # 仕様書管理
│   │   │   ├── create.ts
│   │   │   ├── list.ts
│   │   │   ├── get.ts
│   │   │   ├── phase.ts
│   │   │   └── update.ts
│   │   ├── github/          # GitHub統合
│   │   │   ├── init.ts
│   │   │   ├── issue-create.ts
│   │   │   ├── sync.ts
│   │   │   └── project-add.ts
│   │   ├── knowledge/       # ナレッジベース
│   │   │   └── record.ts
│   │   └── utils/           # ユーティリティ
│   │       ├── output.ts
│   │       ├── error-handler.ts
│   │       └── validation.ts
│   ├── slash-commands/      # スラッシュコマンド定義 (.md)
│   ├── core/
│   │   ├── database/        # Kysely + SQLite
│   │   ├── workflow/        # EventBus + Git統合
│   │   └── templates/       # Handlebars
│   ├── integrations/        # 外部統合
│   │   └── github/          # GitHub API (REST + GraphQL)
│   ├── plugins/             # プラグインシステム
│   └── scripts/             # ビルド・同期スクリプト
│       ├── sync-dogfood.ts  # src/ → .cc-craft-kit/ 同期
│       └── check-sync.ts    # 同期状態チェック
├── templates/               # 仕様書テンプレート
└── .cc-craft-kit/                 # ドッグフーディング環境（Git非管理）
    ├── commands/            # src/commands/ のコピー
    ├── slash-commands/      # src/slash-commands/ のコピー
    ├── cc-craft-kit.db            # SQLiteデータベース
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
# 開発
# cc-craft-kit は TypeScript を直接実行するため、ビルド不要です
# すべてのコマンドは npx tsx で直接実行されます

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
- [x] CLI インターフェース実装
- [x] 基本 CLI コマンド (`init`, `spec create/list/get`, `status`)
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
- **spec-workflow-mcp** - 仕様駆動開発のアイデア
- **GitHub Spec Kit** - constitution.md コンセプト

また、以下の哲学・手法を実装に反映しています。

- **Kent Beck** - Canon TDD
- **t-wada (和田卓人)** - 3 レベル TDD 理解
- **Martin Fowler** - リファクタリングカタログ

## 📮 コンタクト

質問・提案・バグ報告は [Issues](https://github.com/yourusername/cc-craft-kit/issues) へお願いします。

---

**cc-craft-kit (匠)** - 匠の技で、開発ワークフローを磨き上げる。
