# spec-phase completed 時に PR が自動作成されない（失敗する）

**仕様書 ID:** 71dc7902-75fd-4c8e-b5f3-fadd8fd3cca9
**フェーズ:** tasks
**作成日時:** 2025/11/21 08:04:17
**更新日時:** 2025/11/21 10:00:24

---

## 1. 背景と目的

### 背景

#### 現状の問題

現在、`/cft:spec-phase <spec-id> completed` を実行すると、以下の処理が実行される。

1. フェーズを completed に更新
2. GitHub Issue のステータスを Done に更新
3. Git 自動コミットを実行

しかし、Pull Request の自動作成は実装されていない。そのため、以下の問題が発生している。

- 開発者が手動で `gh pr create` を実行する必要がある
- PR 作成を忘れると、コードレビューが遅延する
- PR 本文の品質が開発者に依存し、統一性がない

#### 解決アプローチ

PR 作成を自動化するため、専用のスキル (`pr-creator`) を実装する。このスキルは以下を実現する。

1. **日本語対応**: PR タイトルと本文を日本語で生成（国際化は将来対応）
2. **品質保証**: textlint および markdownlint で本文の品質をチェック（警告・エラー0 件を保証）
3. **仕様書連携**: 仕様書の内容を元に PR 本文を自動生成

### 目的

completed フェーズへの移行時に、自動的に GitHub Pull Request を作成する PR 作成スキルを実装し、以下を実現する。

1. PR タイトルと本文を日本語で生成
2. textlint および markdownlint による品質チェックを通過
3. 開発フローの自動化により、PR 作成漏れを防止

---

## 2. 対象ユーザー

cc-craft-kit を使用して開発する開発者。特に以下のユースケースを想定。

- completed フェーズへの移行後、PR 作成を手動で行っている開発者
- PR 作成を忘れることがある開発者
- PR の本文に仕様書の内容をコピー&ペーストしている開発者

---

## 3. 受け入れ基準

### 必須要件

- [ ] completed フェーズ移行時に PR 作成スキル (`pr-creator`) が自動実行される
- [ ] PR タイトルが日本語で生成される（例: `feat: <仕様書名> を実装完了`）
- [ ] PR 本文が日本語で生成され、以下のセクションを含む
  - 概要（仕様書の背景と目的を要約）
  - 変更内容（実装した機能の箇条書き）
  - テスト計画（テスト項目のチェックリスト）
- [ ] PR 本文が textlint チェックを通過（警告・エラー0 件）
- [ ] PR 本文が markdownlint チェックを通過（警告・エラー0 件）
- [ ] PR 作成失敗時に明確なエラーメッセージを表示

### 機能要件

- [ ] PR 作成スキルは `.claude/skills/pr-creator/SKILL.md` に配置
- [ ] スキルは Skill ツールで実行可能
- [ ] PR 本文は仕様書ファイルの内容を元に生成
- [ ] PR のベースブランチは環境変数 `DEFAULT_BASE_BRANCH` から取得（デフォルト: `develop`）
- [ ] PR 作成後、仕様書に PR URL を記録

### 非機能要件

- [ ] PR 作成処理は 5 秒以内に完了（GitHub API タイムアウト含む）
- [ ] GitHub API レート制限エラー時は適切なリトライロジックを実装
- [ ] PR 本文の textlint/markdownlint チェックは 3 秒以内に完了
- [ ] PR 作成失敗時もフェーズ移行は成功（completed フェーズに移行）

---

## 4. 制約条件

### 技術的制約

- GitHub CLI (`gh`) がインストールされていること
- GitHub Personal Access Token が設定されていること（環境変数 `GITHUB_TOKEN`）
- textlint および markdownlint が npm パッケージとして利用可能であること
- Node.js 20.x 以上（`npx tsx` で TypeScript を直接実行するため）

### 環境制約

- Git リポジトリが初期化されていること
- 現在のブランチがリモートにプッシュされていること
- ベースブランチ（develop または main）が存在すること

### 機能的制約

- PR 本文は最大 65536 文字（GitHub API の制限）
- PR タイトルは最大 256 文字
- textlint/markdownlint のチェックはローカル実行のみ（CI/CD では別途実行）

---

## 5. 依存関係

### 既存コンポーネントへの依存

- **GitHub 統合モジュール** (`src/integrations/github/`): GitHub API 呼び出し
- **イベントバス** (`src/core/workflow/event-bus.ts`): `spec.phase_changed` イベントのハンドリング
- **仕様書管理** (`src/commands/spec/helpers.ts`): 仕様書情報の取得

### 外部ライブラリへの依存

- `@octokit/rest`: GitHub REST API クライアント
- `textlint`: 日本語文章の校正
- `markdownlint`: Markdown 構文チェック
- `gh` (GitHub CLI): PR 作成コマンド実行

### スキルシステムへの依存

- Skill ツールによるスキル実行機構（`.claude/skills/` ディレクトリ構造）
- スキル定義ファイル (`SKILL.md`) のフォーマット仕様

### 他の仕様への依存

- なし（新規機能のため独立）

---

## 6. 参考情報

### 関連ドキュメント

- [CLAUDE.md - スキルシステム](./CLAUDE.md#サブエージェントとスキルの使用方針)
- [GitHub CLI - PR 作成](https://cli.github.com/manual/gh_pr_create)
- [GitHub API - Pull Requests](https://docs.github.com/en/rest/pulls/pulls)

### 既存実装の参考

- `.claude/skills/git-operations/SKILL.md`: Git スキルの実装例
- `src/core/workflow/git-integration.ts`: Git 自動コミットの実装
- `src/integrations/github/issues.ts`: GitHub Issue 作成の実装

### Lint 設定ファイル

- `.textlintrc.json`: textlint ルール設定
- `.markdownlint.json`: markdownlint ルール設定

### 設計方針

- PR 本文は Markdown 形式で生成
- テンプレートエンジンは使用せず、文字列連結で生成（シンプル性重視）
- エラーハンドリングは既存の `src/core/errors/` クラスを使用

---

## 7. 設計方針

### アーキテクチャ

PR 作成スキルは以下の構成で実装する。

```text
.claude/skills/pr-creator/
├── SKILL.md              # スキル定義ファイル
└── templates/
    └── pr-body.md        # PR 本文テンプレート（オプション）
```

### 処理フロー

1. `spec.phase_changed` イベントが `completed` で発火
2. イベントハンドラーが `pr-creator` スキルを Skill ツールで実行
3. スキルが以下を順次実行:
   - 仕様書ファイルを読み込み
   - PR タイトル生成（例: `feat: <仕様書名> を実装完了`）
   - PR 本文生成（概要、変更内容、テスト計画）
   - textlint チェック実行
   - markdownlint チェック実行
   - `gh pr create` で PR 作成
   - PR URL を仕様書に記録

### エラーハンドリング

- GitHub CLI 未インストール時: 警告表示、PR 作成スキップ
- GitHub トークン未設定時: エラー表示、手動作成を案内
- textlint/markdownlint エラー時: エラー箇所を表示、修正後再実行を案内
- API レート制限時: リトライロジック（最大 3 回、指数バックオフ）

---

## 8. テスト計画

### 単体テスト

- [ ] PR タイトル生成ロジックのテスト
- [ ] PR 本文生成ロジックのテスト
- [ ] textlint チェックのテスト（正常系・エラー系）
- [ ] markdownlint チェックのテスト（正常系・エラー系）

### 統合テスト

- [ ] `spec.phase_changed` イベント発火時の自動実行テスト
- [ ] GitHub API モックを使用した PR 作成テスト
- [ ] エラーハンドリングのテスト

### E2E テスト

- [ ] 実際の GitHub リポジトリでの PR 作成テスト（手動）
- [ ] textlint/markdownlint チェックの統合テスト

---

## 9. リリース計画

### マイルストーン

- Phase 1: PR 作成スキルの基本実装（textlint/markdownlint なし）
- Phase 2: textlint/markdownlint チェック追加
- Phase 3: PR 本文テンプレートのカスタマイズ機能（将来対応）

### リリース基準

- すべての受け入れ基準を満たす
- 単体テスト・統合テストが通過
- E2E テストで実際の PR 作成を確認
