# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2025-11-27

### Added

- 詳細設計とタスク分割の統合: design フェーズでタスク分割を自動実行（tasks フェーズは非推奨化）
- design フェーズ移行時に詳細設計セクション（7.1〜7.5）を自動生成
- GitHub Issue 本文同期: フェーズ変更時に仕様書の内容を Issue 本文に自動反映
- フェーズ完了時の未コミット検出: git status チェックと警告表示
- 環境変数 BASE_BRANCH: デフォルトブランチの明示的な指定をサポート

### Changed

- プロンプトファースト原則の強化: CLAUDE.md に開発前チェックリストを追加
- `/cft:spec-create` コマンドをプロンプトベースに再設計（日本語ガイダンス対応）
- `/cft:spec-phase` コマンドの見直し: completed フェーズ移行時の PR 作成処理を改善
- `/cft:spec-delete` コマンドをプロンプトファースト型に再設計
- `/cft:status` コマンドをプロンプトベースに再設計
- 環境変数 GITHUB_DEFAULT_BASE_BRANCH を BASE_BRANCH にリネーム

### Fixed

- completed フェーズ移行時の PR 作成失敗: ブランチ自動プッシュ機能を追加
- PR 作成時のマージ先ブランチの誤り
- 仕様書 createdAt/updatedAt のフォーマット統一
- 存在しないフェーズ（testing）の案内を削除

## [0.1.0] - 2025-11-24

### Added

- 仕様駆動開発（SDD）ワークフロー: 要件定義 → 設計 → タスク分解 → 実装 → 完了のフェーズ管理
- GitHub Projects/Issues 完全連携: 仕様書作成時に自動的に Issue 作成、フェーズ移行時に自動的にステータス更新
- カスタムスラッシュコマンド: `/cft:*` コマンドによる開発支援機能（20 種類以上のコマンド）
- サブエージェント統合: code-reviewer、test-generator、refactoring-assistant による品質保証
- スキル統合: typescript-eslint、database-schema-validator、git-operations による開発支援
- Git 自動コミット機能: フェーズ移行時に自動的に変更をコミット
- イベント駆動アーキテクチャ: EventEmitter2 によるモジュール間の疎結合設計
- ドッグフーディング対応: cc-craft-kit 自身を使って開発できる構造
- プラグインシステム: Backlog、Slack などの外部サービス統合
- ナレッジベース機能: 進捗、エラー解決策、Tips を GitHub Issue に記録

### Changed

- なし（初回リリース）

### Fixed

- なし（初回リリース）

[0.1.1]: https://github.com/B16B1RD/cc-craft-kit/releases/tag/v0.1.1
[0.1.0]: https://github.com/B16B1RD/cc-craft-kit/releases/tag/v0.1.0
