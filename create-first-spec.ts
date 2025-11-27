#!/usr/bin/env node
/**
 * 最初のSpec作成スクリプト（WebUIダッシュボード）
 */
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Database {
  specs: {
    id: string;
    name: string;
    description: string | null;
    phase: 'requirements' | 'design' | 'tasks' | 'implementation' | 'completed';
    content: string | null;
    github_issue_number: number | null;
    created_at: string;
    updated_at: string;
  };
}

async function createFirstSpec() {
  const projectRoot = path.resolve(__dirname, '..');
  const dbPath = path.join(projectRoot, '.cc-craft-kit', 'cc-craft-kit.db');

  const db = new Database(dbPath);
  const kysely = new Kysely<Database>({
    dialect: new SqliteDialect({ database: db }),
  });

  const specId = randomUUID();
  const now = new Date().toISOString();

  const specData = {
    id: specId,
    name: 'WebUIダッシュボード',
    description: 'Takumiの状態を可視化するWebダッシュボードの実装',
    phase: 'requirements' as const,
    content: `# WebUIダッシュボード仕様書

## 概要
Takumiプロジェクトの状態を視覚的に把握できるWebダッシュボードを実装する。

## 目的
- プロジェクトの進捗状況を一目で確認できるようにする
- 仕様書（Specs）、タスク、GitHub連携状態をリアルタイムで表示
- ドッグフーディングによる実用性検証

## フェーズ: Requirements（要件定義）

### 機能要件

#### 1. ダッシュボードホーム
- **プロジェクト概要カード**
  - プロジェクト名、説明、作成日
  - GitHubリポジトリリンク
- **統計サマリー**
  - Spec総数（フェーズ別）
  - タスク総数（ステータス別）
  - GitHub同期状態

#### 2. Specs一覧ページ
- **フェーズフィルター**
  - Requirements / Design / Tasks / Implementation / Completed
- **Specカード表示**
  - Spec名、説明、作成日、更新日
  - フェーズバッジ
  - GitHub Issue番号（連携済みの場合）
- **詳細表示モーダル**
  - Spec全文（Markdown）
  - 関連タスク一覧
  - GitHub連携ボタン

#### 3. Tasks一覧ページ
- **ステータスフィルター**
  - Todo / In Progress / Blocked / Review / Done
- **カンバンボード表示**
  - ドラッグ&ドロップでステータス変更
- **タスクカード**
  - タイトル、説明、優先度、担当者
  - 親Spec表示

#### 4. GitHub連携ページ
- **同期履歴表示**
  - 同期日時、方向（Takumi→GitHub / GitHub→Takumi）
  - 同期エンティティ（Spec / Task）
- **手動同期ボタン**
  - Spec→GitHub Issue作成
  - GitHub→Takumi同期

#### 5. ナレッジベースページ
- **進捗記録一覧**
- **エラー解決策DB**
- **Tips集**

### 非機能要件

#### パフォーマンス
- ページ読み込み時間: 1秒以内
- リアルタイム更新: WebSocket or SSE

#### セキュリティ
- ローカルホスト限定アクセス（127.0.0.1）
- GitHub Tokenは表示しない

#### UI/UX
- レスポンシブデザイン（デスクトップ/タブレット対応）
- ダークモード対応
- アクセシビリティ（WCAG 2.1 AA準拠）

### 技術スタック候補

#### フロントエンド
- **フレームワーク**: React 18 + TypeScript
- **UIライブラリ**: Tailwind CSS + shadcn/ui
- **状態管理**: Zustand or TanStack Query
- **ルーティング**: React Router v6

#### バックエンド
- **サーバー**: Express.js or Fastify
- **API**: REST API（既存のMCPツールを再利用）
- **リアルタイム**: Socket.io or Server-Sent Events

#### ビルド
- **バンドラー**: Vite
- **型チェック**: tsc --noEmit

### 制約条件
- 既存のTakumiアーキテクチャを破壊しない
- MCPサーバーと並行動作可能
- データベーススキーマ変更なし（既存のspecs/tasksテーブルを使用）

## 次のフェーズ
このRequirementsフェーズが承認されたら、Designフェーズに移行してアーキテクチャ設計を行う。
`,
    github_issue_number: null,
    created_at: now,
    updated_at: now,
  };

  await kysely.insertInto('specs').values(specData).execute();

  console.log('✅ 最初のSpec作成完了\n');
  console.log('📋 Spec情報:');
  console.log(`  ID: ${specId}`);
  console.log(`  名前: ${specData.name}`);
  console.log(`  説明: ${specData.description}`);
  console.log(`  フェーズ: ${specData.phase}`);
  console.log(`  作成日: ${new Date(now).toLocaleString()}\n`);

  console.log('📝 内容プレビュー:');
  console.log(specData.content.split('\n').slice(0, 10).join('\n'));
  console.log('...\n');

  await kysely.destroy();
  db.close();

  console.log('🎉 ドッグフーディング準備完了！');
  console.log('\n📌 次のアクション:');
  console.log('  1. Specの詳細を確認: /cft:spec-list');
  console.log('  2. GitHub Issueを作成: /cft:create-github-issue');
  console.log('  3. Requirementsフェーズを承認してDesignフェーズへ移行');
}

createFirstSpec().catch((error) => {
  console.error('❌ Spec作成エラー:', error);
  process.exit(1);
});
