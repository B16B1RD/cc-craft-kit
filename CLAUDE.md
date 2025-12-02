# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

cc-craft-kit は、Claude Code 上で仕様駆動開発（SDD）を実現する開発支援ツールキット。
詳細は README.md と docs/ARCHITECTURE.md を参照。

## 最重要原則: プロンプトファースト

プロンプト（.md）で実現できることはプロンプトで済ませる。
スクリプト（.ts）は以下の場合のみ:

- DB 操作（Kysely）
- GitHub API（Octokit）
- イベント駆動（EventBus）
- ファイル監視（Chokidar）

詳細は `agent_docs/PROMPT_FIRST_PRINCIPLE.md` を参照。

## 開発ワークフロー

1. `src/` 配下のファイルを編集
2. `npm run sync:dogfood` で `.cc-craft-kit/` へ同期
3. スラッシュコマンド `/cft:*` で動作確認

**注意**: `src/` を編集したら必ず `npm run sync:dogfood` を実行。

## 主要コマンド

```bash
npm run typecheck      # 型チェック
npm test               # テスト実行
npm run lint           # ESLint
npm run sync:dogfood   # ソースコード同期
```

## エージェント向けドキュメント（agent_docs/）

タスクに応じて以下を参照:

- `agent_docs/CODING_CONVENTIONS.md` - コーディング規約
- `agent_docs/IMPLEMENTATION_PATTERNS.md` - 実装パターン
- `agent_docs/PROMPT_FIRST_PRINCIPLE.md` - プロンプトファースト詳細
- `agent_docs/DATABASE_SAFETY.md` - データベース接続ルール

## ユーザー向けドキュメント（docs/）

- `docs/QUICK_START.md` - セットアップガイド
- `docs/ARCHITECTURE.md` - アーキテクチャ概要
- `docs/SUBAGENTS_AND_SKILLS_GUIDE.md` - サブエージェント・スキル作成ガイド
