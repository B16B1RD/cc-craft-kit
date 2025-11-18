# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2025-11-18

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

[0.1.0]: https://github.com/B16B1RD/cc-craft-kit/releases/tag/v0.1.0
