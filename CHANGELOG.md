# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.10] - 2025-12-05

### Added

- なし

### Changed

- インストール構成の見直し - シンボリックリンク廃止と適切なファイル配置 (#711)

### Fixed

- completed フェーズ移行時にブランチ削除が失敗する問題を修正 (#783)
- completed フェーズで仕様書が更新される問題を修正 (#775)
- DB の整合性修正 - review フェーズ集計漏れを解消 (#769)
- Sub Issue が重複して作成される問題を修正 (#754)
- /cft:status が別ブランチの仕様書ファイルを読み取ろうとしてエラーになる問題を修正 (#746)
- CI が失敗する PR が作成されることがある問題を修正 (#738)
- 本リポジトリの .cc-craft-kit/ に無駄なファイルがある問題を修正 (#723)

## [0.1.9] - 2025-12-04

### Added

- なし

### Changed

- `scripts/install.sh`: 警告メッセージの改行表示を改善（`\n` が正しく表示されるよう修正）
- `.github/workflows/release.yml`: アーカイブ生成時に `.env.example` を同梱するよう変更

### Fixed

- インストールスクリプトの `.env.example` 不足警告を修正 (#678)
- 既存 `.env` 保持時のユーザーフィードバックを明確化

## [0.1.8] - 2025-12-04

### Added

- なし

### Changed

- なし

### Fixed

- インストールスクリプトのパイプ実行時の不具合を修正 (#661)

## [0.1.7] - 2025-12-04

### Added

- なし

### Changed

- フェーズおよび Issue ステータスの見直し（5フェーズモデル: requirements → design → implementation → review → completed）
- GitHub Projects ステータス連携の改善

### Fixed

- インストーラーアーカイブエラーの修正

## [0.1.6] - 2025-12-03

### Added

- GitHub Projects ステータスマッピング設定の自動検出機能（config.json statusConfig）
- 複数ステータスパターンへの対応（3段階、4段階ステータスなど）
- phase 変更時の Projects ステータス自動更新（PR merge で Done に更新）

### Changed

- GitHub status-config.ts を設定駆動型アーキテクチャに統一
- DynamicStatusMapper による後方互換性の維持
- phase-status-mapper.ts でフォールバック処理を実装

### Fixed

- MCP_PORT サンプル設定を削除（不要な環境変数設定を削除）

## [0.1.5] - 2025-12-02

### Added

- セッション再開時にワークフロー状態を引き継ぐ `workflow_state` テーブル追加
- session-start/session-end フェーズにおけるワークフロー状態の自動保存・復元機能
- プロジェクト名完全置換（旧名称 Takumi → cc-craft-kit）
- インストールスクリプトの URL 修正

### Changed

- データベースマイグレーション 012: `workflow_state` テーブル追加

### Fixed

- なし

## [0.1.4] - 2025-11-30

### Added

- GitHub Sub Issue 連携機能: design フェーズ移行時に実装タスクを Sub Issue として自動作成
- 親 Issue ⇔ Sub Issue 間の自動リンク機能
- Sub Issue 状態追跡用の DB カラム追加（parent_issue_number, parent_spec_id）
- `/cft:spec-create` コマンドで GitHub Issue 自動作成を修正

### Changed

- データベースマイグレーション 011: parent_issue_columns の追加
- github_sync テーブルに Sub Issue 対応カラムを追加

### Fixed

- `/cft:spec-create` で GitHub Issue が作成されない問題を修正
- github_sync の issue_number が null になる問題を修正

## [0.1.3] - 2025-11-29

### Added

- `/cft:init` コマンドの簡素化: 引数を不要に変更

### Changed

- 4フェーズモデルへの統一: `validPhases` から `tasks` フェーズを削除

### Fixed

- なし

## [0.1.2] - 2025-11-28

### Added

- なし

### Changed

- コマンド数の削減: 42個から24個へ統合（task, knowledge, sync, quality, custom-tools）
- 4フェーズモデルへの移行: tasks フェーズを廃止し、design → implementation の直接遷移を推奨
- ドキュメント更新:
  - README.md のコマンド一覧を24コマンドに更新
  - docs/ARCHITECTURE.md のフェーズ定義を4フェーズモデルに更新
  - docs/GITHUB_PROJECTS.md のプロジェクト名を cc-craft-kit に統一
  - docs/SUBAGENTS_AND_SKILLS_GUIDE.md のプロジェクト名を cc-craft-kit に統一

### Fixed

- なし

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

[0.1.9]: https://github.com/B16B1RD/cc-craft-kit/releases/tag/v0.1.9
[0.1.8]: https://github.com/B16B1RD/cc-craft-kit/releases/tag/v0.1.8
[0.1.7]: https://github.com/B16B1RD/cc-craft-kit/releases/tag/v0.1.7
[0.1.6]: https://github.com/B16B1RD/cc-craft-kit/releases/tag/v0.1.6
[0.1.5]: https://github.com/B16B1RD/cc-craft-kit/releases/tag/v0.1.5
[0.1.4]: https://github.com/B16B1RD/cc-craft-kit/releases/tag/v0.1.4
[0.1.3]: https://github.com/B16B1RD/cc-craft-kit/releases/tag/v0.1.3
[0.1.2]: https://github.com/B16B1RD/cc-craft-kit/releases/tag/v0.1.2
[0.1.1]: https://github.com/B16B1RD/cc-craft-kit/releases/tag/v0.1.1
[0.1.0]: https://github.com/B16B1RD/cc-craft-kit/releases/tag/v0.1.0
