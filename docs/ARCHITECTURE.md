# cc-craft-kit アーキテクチャドキュメント

## 概要

cc-craft-kit は**モジュラーモノリス**パターンを採用した、拡張可能なアーキテクチャを持つ開発支援ツールキットです。

## アーキテクチャ図

```text
┌──────────────────────────────────────────────────────────────────────┐
│                             Claude Code                              │
│  ┌─────────────────────┐  ┌───────────────────┐  ┌────────────────┐  │
│  │ Slash Commands      │  │ Skills            │  │ Subagents      │  │
│  │  /cft:init │  │  cc-craft-kit-tdd │  │  spec-reviewer │  │
│  │  /cft:spec │  │  cc-craft-kit-sdd │  │  task-planner  │  │
│  │  /cft:task │  │                   │  │                │  │
│  └──────────┬──────────┘  └─────┬─────────────┘  └───────┬────────┘  │
│             │                   │                        │           │
│             └───────────────────┴────────────────────────┘           │
│                                 │                                    │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │ Slash Command
┌─────────────────────────────────┼────────────────────────────────────┐
│                     cc-craft-kit Slash Command                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │              Core Modules (Modular Monolith)                   │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐   │  │
│  │  │  Spec Manager  │  │  Task Manager  │  │  GitHub Client  │   │  │
│  │  └───────┬────────┘  └───────┬────────┘  └────────┬────────┘   │  │
│  │          │                   │                    │            │  │
│  │  ┌───────▼───────────────────▼────────────────────▼────────┐   │  │
│  │  │                Event Bus (EventEmitter2)                │   │  │
│  │  └────────────────────────────┬────────────────────────────┘   │  │
│  │                               │                                │  │
│  │  ┌────────────────────────────▼────────────────────────────┐   │  │
│  │  │            Database Layer (Kysely + SQLite)             │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                         Slash Commands                         │  │
│  │  • /cft:init                                          │  │
│  │  • /cft:spec-create/list/get/phase                    │  │
│  │  • /cft:github-init/issue-create/sync/project-add     │  │
│  │  • /cft:knowledge-progress/error/tip                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼────────────────────────────────────┐
│                            External APIs                             │
│  ┌─────────────────┐            │              ┌──────────────────┐  │
│  │  GitHub REST    │◄───────────┴─────────────►│  GitHub GraphQL  │  │
│  │  (Issues, PRs)  │                           │  (Projects v2)   │  │
│  └─────────────────┘                           └──────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## コアコンポーネント

### 1. Slash Command Interface

スラッシュコマンドは、Claude Code と cc-craft-kit の中核機能を橋渡しします。

**責務**。

- スラッシュコマンドから対応するコマンドファイルの実行
- 引数パース・バリデーション
- エラーハンドリング
- 出力フォーマッティング

**実装**。

- スラッシュコマンド定義: `src/slash-commands/*.md`
- コマンド実装: `src/commands/*.ts`
- 実行環境: `.cc-craft-kit/commands/` (ドッグフーディング用)

### 2. Database Layer

Kysely + SQLite による型安全なデータベース層。

**責務**。

- スキーマ定義
- マイグレーション管理
- CRUD 操作
- トランザクション管理

**主要ファイル**。

- `src/core/database/schema.ts` - スキーマ定義
- `src/core/database/connection.ts` - 接続管理
- `src/core/database/migrator.ts` - マイグレーション実行

### 3. Modules (Domain Layer)

ビジネスロジックを担うドメインモジュール群。

#### Spec Manager

- 仕様書の作成・更新・削除
- フェーズ管理 (Requirements → Design → Tasks → Implementation)
- テンプレート適用

#### Task Manager

- タスクの作成・更新・削除
- ステータス管理
- 優先順位管理

#### GitHub Client

- Issue 作成・更新
- Projects v2 管理
- Milestone 管理
- 双方向同期

### 4. Event Bus

EventEmitter2 ベースのイベント駆動アーキテクチャ。

**イベントタイプ**。

```typescript
type EventMap = {
  'spec:created': (spec: Spec) => void;
  'spec:approved': (spec: Spec, phase: Phase) => void;
  'task:created': (task: Task) => void;
  'task:started': (task: Task) => void;
  'task:completed': (task: Task) => void;
  'github:issue:created': (issue: Issue) => void;
  'github:issue:updated': (issue: Issue) => void;
};
```

**利点**。

- モジュール間の疎結合
- 拡張性の向上
- 非同期処理のサポート

### 5. Plugin System

プラグイン機構による拡張性の実現。

**プラグインインターフェース**。

```typescript
interface cc-craft-kitPlugin {
  name: string;
  version: string;
  onInit?(context: PluginContext): void | Promise<void>;
  tools?: MCPTool[];
  eventHandlers?: EventHandler[];
}
```

## データフロー

### 1. 仕様書作成フロー

```text
1. User: スラッシュコマンド実行 (/cft:spec-create "機能名" "説明")
   ↓
2. Slash Command: .cc-craft-kit/commands/spec/create.ts を npx tsx で実行
   ↓
3. spec/create.ts: 引数バリデーション
   ↓
4. Database: specs テーブルへ INSERT
   ↓
5. Event Bus: 'spec.created' イベント発火
   ↓
6. Listeners:
   - GitHub Client: Issue 自動作成（設定があればProject追加）
   - Git Integration: 仕様書ファイルを自動コミット
   - Logger: ログ記録
   ↓
7. Response: 成功メッセージ出力
```

### 2. GitHub同期フロー

```text
1. Event: 'task:created'
   ↓
2. GitHub Client: リスナー起動
   ↓
3. Octokit: Issue作成API呼び出し
   ↓
4. Response: Issue ID取得
   ↓
5. Database: tasks テーブル更新
   ↓
6. Database: github_sync テーブルへINSERT
   ↓
7. Event: 'github:issue:created' 発火
```

## 設計原則

### 1. SOLID原則

- Single Responsibility: 各モジュールは単一の責務を持つ
- Open/Closed: 拡張に開いて、変更に閉じている (Plugin System)
- Liskov Substitution: インターフェース準拠
- Interface Segregation: 最小限のインターフェース
- Dependency Inversion: DI コンテナ (TSyringe) 活用

### 2. モジュラーモノリス

**利点**。

- 開発初期の生産性向上
- 単一デプロイメント
- トランザクション整合性
- 将来のマイクロサービス化に対応可能

**モジュール分離**。

- `modules/spec/` - 仕様書ドメイン
- `modules/task/` - タスクドメイン
- `modules/github/` - GitHub 連携ドメイン

### 3. イベント駆動

**利点**。

- 疎結合
- 非同期処理
- 拡張性
- 監査ログ取得

**注意点**。

- イベントフローの可視化
- デバッグの複雑化
- イベント順序保証

## セキュリティ

### 1. 認証情報管理

- GitHub PAT: 環境変数 (`.env`)
- `.env`ファイルは`.gitignore`に必須
- Fine-grained PAT 推奨 (最小権限)

### 2. バリデーション

- すべての入力を Zod スキーマでバリデーション
- SQL インジェクション対策: Kysely のパラメータ化クエリ
- UUIDv4 使用 (推測不可能な ID)

### 3. エラーハンドリング

- センシティブ情報の漏洩防止
- 詳細なエラーはログのみ
- ユーザーには抽象化されたエラーメッセージ

## パフォーマンス

### 1. データベース最適化

- インデックス設計 (phase, status, github_issue_id 等)
- WAL モード有効化
- 外部キー制約

### 2. GitHub API

- レート制限監視
- バックオフ戦略
- バッチ処理 (GraphQL)
- キャッシング (Project ID 等)

### 3. イベントバス

- 非同期処理
- バックプレッシャー対策
- エラーリスナー分離

## テスト戦略

### 1. 単体テスト

- 各モジュールの独立テスト
- モック・スタブ活用 (Sinon)
- カバレッジ 80%+ 目標

### 2. 統合テスト

- MCP ツールの E2E テスト
- データベース統合テスト
- GitHub API 統合テスト (モック)

### 3. E2Eテスト

- 実際のワークフローテスト
- プロジェクト初期化 → 仕様書作成 → タスク分解

## 今後の拡張

### 1. マイクロサービス化 (Phase 5+)

モジュラーモノリスから段階的に分離します。

```text
cc-craft-kit Gateway
├── Spec Service
├── Task Service
├── GitHub Service
└── Event Service (Message Queue)
```

### 2. スケーラビリティ

- 水平スケール: ロードバランサー + Sticky Session
- 垂直スケール: リソース最適化
- 外部状態管理: Redis (セッション共有)

### 3. 可観測性

- メトリクス: Prometheus
- ログ集約: ELK Stack
- トレーシング: OpenTelemetry

## 品質指標

### 型安全性

- TypeScript strict mode 有効化
- `@typescript-eslint/no-explicit-any`警告: **0個**
- 全ての`any`型を適切な型(`unknown`、具体的な型定義)に置き換え
- 共通型定義による型の一元管理

### コード品質

- ESLint 警告: 0 個
- テストカバレッジ: 27 テスト全て成功
- CI/CD: GitHub Actions 統合

### セキュリティ

- 入力バリデーション: Zod スキーマ + SecurityValidator
- SQL インジェクション対策: Kysely パラメータ化クエリ
- XSS 対策: HTML サニタイゼーション実装
- シークレット検出: パターンマッチング実装

---

**最終更新:** 2025-11-15
**バージョン:** 0.1.0
**Phase 5 完了**: 型安全性・パフォーマンス・セキュリティの最適化完了。
