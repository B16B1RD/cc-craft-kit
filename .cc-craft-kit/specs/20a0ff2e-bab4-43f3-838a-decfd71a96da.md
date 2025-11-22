# 各フェーズ完了時未コミットのファイルがある（主に仕様書ファイル）

**仕様書 ID:** 20a0ff2e-bab4-43f3-838a-decfd71a96da
**フェーズ:** requirements
**作成日時:** 2025/11/22 18:46:45
**更新日時:** 2025/11/22 18:46:45

---

## 1. 背景と目的

### 背景

現在、cc-craft-kit では各フェーズ完了時（特に `/cft:spec-create` 実行時）に Git 自動コミット機能が実装されているが、以下の問題が発生している。

1. **仕様書ファイルがコミットされない**
   - `spec.created` イベント発火時の自動コミットは実装されているが、実際にはファイルがコミットされないケースが多発
   - 手動コミットが必要になり、ワークフローが中断される

2. **他のフェーズでも同様の問題**
   - requirements → design
   - design → tasks
   - tasks → implementation
   - implementation → completed

各フェーズ移行時に、仕様書ファイルやその他の変更ファイルが未コミット状態で残る。

1. **根本原因の不明確さ**
   - `git add` が実行されているか不明
   - `git commit` の実行タイミングが適切でない可能性
   - pre-commit フック（textlint）の失敗が原因の可能性

### 目的

フェーズ移行時の Git 自動コミット機能を修正し、以下を実現する。

1. **確実な自動コミット**: すべてのフェーズ移行時に変更ファイルが自動的にコミットされる
2. **pre-commit フック対応**: textlint エラーを自動修正してからコミット実行
3. **エラーハンドリング強化**: コミット失敗時の適切なエラーメッセージと復旧手順の提示
4. **手動介入の最小化**: ユーザーが手動でコミットする必要をなくす

---

## 2. 対象ユーザー

- cc-craft-kit を使用するすべての開発者
- 特に、仕様駆動開発（SDD）ワークフローを実践する開発チーム
- Git による変更履歴管理を重視するプロジェクト

---

## 3. 受け入れ基準

### 必須要件

- [ ] `/cft:spec-create` 実行時、仕様書ファイルが自動的にコミットされること
- [ ] すべてのフェーズ移行時（requirements/design/tasks/implementation/completed）、変更ファイルが自動コミットされること
- [ ] pre-commit フック（textlint/markdownlint）が失敗した場合、適切なエラーハンドリングが行われること

### 機能要件

- [ ] **コミット前の自動チェック**
  - textlint エラーを事前に検出し、自動修正を試みる
  - 修正可能なエラーは自動修正してからコミット実行
  - 修正不可能なエラーは明確なメッセージで報告

- [ ] **段階的コミットプロセス**
  1. 変更ファイルの検出（`git status --porcelain`）
  2. textlint/markdownlint 自動修正（`--fix` オプション）
  3. `git add` でステージング
  4. `git commit` 実行
  5. コミット成功/失敗の通知

- [ ] **エラーハンドリング**
  - コミット失敗時、ステージングされたファイルを `git reset HEAD` でロールバック
  - 失敗理由を明確に表示（pre-commit フックエラー、Git エラーなど）
  - 手動コミット手順を案内

- [ ] **ログ記録**
  - 各ステップの実行結果を `logs` テーブルに記録
  - デバッグレベルでコマンド実行ログを保存
  - エラー時は ERROR レベルでスタックトレースを記録

### 非機能要件

- [ ] **パフォーマンス**: コミットプロセスは 5 秒以内に完了すること
- [ ] **信頼性**: コミット失敗時、データベースやファイルシステムの状態を破壊しないこと
- [ ] **保守性**: エラーメッセージは開発者が問題を特定しやすい内容であること

---

## 4. 制約条件

- **Git リポジトリ必須**: 機能を使用するには、プロジェクトが Git リポジトリである必要がある
- **Node.js 環境**: textlint/markdownlint は Node.js パッケージのため、`npx` コマンドが使用可能である必要がある
- **既存コミット履歴への影響**: 過去のコミットには影響を与えず、新規コミットのみが対象
- **pre-commit フック互換性**: husky + lint-staged の既存設定と互換性を保つこと

---

## 5. 依存関係

### 既存コンポーネント

- `src/core/workflow/git-integration.ts` - Git 自動コミット機能の実装
- `src/core/workflow/event-bus.ts` - イベント駆動アーキテクチャ
- `src/core/errors/error-handler.ts` - エラーハンドリング
- `.husky/pre-commit` - pre-commit フック設定
- `.lintstagedrc.json` - lint-staged 設定

### 外部依存

- textlint - Markdown ファイルの文法チェック
- markdownlint-cli2 - Markdown ファイルのスタイルチェック
- husky - Git フック管理
- lint-staged - ステージングファイルへのリンター適用

---

## 6. 参考情報

- [Git Hooks Documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [textlint Documentation](https://textlint.github.io/)
- [markdownlint Documentation](https://github.com/DavidAnson/markdownlint)
- [husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/okonet/lint-staged)
