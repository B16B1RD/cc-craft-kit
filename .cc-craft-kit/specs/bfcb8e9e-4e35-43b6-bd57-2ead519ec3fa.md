# WebUIダッシュボード仕様書

**仕様書 ID:** bfcb8e9e-4e35-43b6-bd57-2ead519ec3fa
**フェーズ:** completed
**作成日時:** 2025/11/15 17:56:43
**更新日時:** 2025/11/19 22:39:18

---

## 概要

cc-craft-kit プロジェクトの状態を視覚的に把握できる Web ダッシュボードを実装する。

## 目的

- プロジェクトの進捗状況を一目で確認できるようにする
- 仕様書（Specs）、タスク、GitHub 連携状態をリアルタイムで表示
- ドッグフーディングによる実用性検証

## フェーズ: Requirements（要件定義）

### 機能要件

#### 1. ダッシュボードホーム

- **プロジェクト概要カード**
  - プロジェクト名、説明、作成日
  - GitHub リポジトリリンク
- **統計サマリー**
  - Spec 総数（フェーズ別）
  - タスク総数（ステータス別）
  - GitHub 同期状態

#### 2. Specs一覧ページ

- **フェーズフィルター**
  - Requirements / Design / Tasks / Implementation / Completed
- **Specカード表示**
  - Spec 名、説明、作成日、更新日
  - フェーズバッジ
  - GitHub Issue 番号（連携済みの場合）
- **詳細表示モーダル**
  - Spec 全文（Markdown）
  - 関連タスク一覧
  - GitHub 連携ボタン

#### 3. Tasks一覧ページ

- **ステータスフィルター**
  - Todo / In Progress / Blocked / Review / Done
- **カンバンボード表示**
  - ドラッグ&ドロップでステータス変更
- **タスクカード**
  - タイトル、説明、優先度、担当者
  - 親 Spec 表示

#### 4. GitHub連携ページ

- **同期履歴表示**
  - 同期日時、方向（cc-craft-kit→GitHub / GitHub→cc-craft-kit）
  - 同期エンティティ（Spec / Task）
- **手動同期ボタン**
  - Spec→GitHub Issue 作成
  - GitHub→cc-craft-kit 同期

#### 5. ナレッジベースページ

- **進捗記録一覧**
- **エラー解決策DB**
- **Tips集**

### 非機能要件

#### パフォーマンス

- ページ読み込み時間: 1 秒以内
- リアルタイム更新: WebSocket or SSE

#### セキュリティ

- ローカルホスト限定アクセス（127.0.0.1）
- GitHub Token は表示しない

#### UI/UX

- レスポンシブデザイン（デスクトップ/タブレット対応）
- ダークモード対応
- アクセシビリティ（WCAG 2.1 AA 準拠）

### 技術スタック候補

#### フロントエンド

- **フレームワーク**: React 18 + TypeScript
- **UIライブラリ**: Tailwind CSS + shadcn/ui
- **状態管理**: Zustand or TanStack Query
- **ルーティング**: React Router v6

#### バックエンド

- **サーバー**: Express.js or Fastify
- **API**: REST API（既存の MCP ツールを再利用）
- **リアルタイム**: Socket.io or Server-Sent Events

#### ビルド

- **バンドラー**: Vite
- **型チェック**: tsc --noEmit

### 制約条件

- 既存の cc-craft-kit アーキテクチャを破壊しない
- MCP サーバーと並行動作可能
- データベーススキーマ変更なし（既存の specs/tasks テーブルを使用）

## 次のフェーズ

この Requirements フェーズが承認されたら、Design フェーズに移行してアーキテクチャを設計する。
