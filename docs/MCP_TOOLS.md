# MCPツール APIリファレンス

Takumi MCP サーバーが提供するツールのリファレンスドキュメントです。

## 目次

- [takumi:init_project](#takumiinit_project-1)
- [takumi:create_spec](#takumicreate_spec-1)
- [takumi:list_specs](#takumilist_specs-1)
- [takumi:get_spec](#takumiget_spec-1)

---

## takumi:init_project

Takumi プロジェクトを初期化します。`.takumi`ディレクトリとデータベースを作成します。

### パラメータ

| 名前            | 型     | 必須 | 説明                           |
| --------------- | ------ | ---- | ------------------------------ |
| `projectName`   | string | ✓    | プロジェクト名                 |
| `description`   | string |      | プロジェクトの説明             |
| `githubRepo`    | string |      | GitHubリポジトリ (owner/repo形式) |

### レスポンス

```json
{
  "success": true,
  "message": "プロジェクト \"my-app\" を初期化しました",
  "config": {
    "name": "my-app",
    "description": "My awesome application",
    "githubRepo": "username/my-app",
    "createdAt": "2025-11-15T10:00:00.000Z",
    "version": "0.1.0"
  },
  "paths": {
    "projectDir": "/path/to/.takumi",
    "specsDir": "/path/to/.takumi/specs",
    "configFile": "/path/to/.takumi/config.json",
    "database": "/path/to/.takumi/takumi.db"
  }
}
```

### 使用例

```typescript
// MCPツール呼び出し
const result = await invoke('takumi:init_project', {
  projectName: 'my-awesome-app',
  description: '革新的なWebアプリケーション',
  githubRepo: 'username/my-awesome-app'
});
```

---

## takumi:create_spec

新しい仕様書を作成します。Requirements フェーズから開始されます。

### パラメータ

| 名前          | 型     | 必須 | 説明           |
| ------------- | ------ | ---- | -------------- |
| `name`        | string | ✓    | 仕様書名       |
| `description` | string |      | 仕様書の説明   |

### レスポンス

```json
{
  "success": true,
  "message": "仕様書 \"ユーザー認証機能\" を作成しました",
  "spec": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "ユーザー認証機能",
    "description": "メール/パスワード認証とOAuth2.0対応",
    "phase": "requirements",
    "createdAt": "2025-11-15T10:00:00.000Z"
  }
}
```

### 使用例

```typescript
const result = await invoke('takumi:create_spec', {
  name: 'ユーザー認証機能',
  description: 'メール/パスワード認証とOAuth2.0対応'
});

console.log(`仕様書ID: ${result.spec.id}`);
```

---

## takumi:list_specs

仕様書の一覧を取得します。フェーズでフィルタリング可能です。

### パラメータ

| 名前     | 型     | 必須 | 説明                       | デフォルト |
| -------- | ------ | ---- | -------------------------- | ---------- |
| `phase`  | enum   |      | フィルタリングするフェーズ | なし       |
| `limit`  | number |      | 取得件数 (1-100)           | 20         |
| `offset` | number |      | オフセット                 | 0          |

#### phase の値

- `requirements` - 要件定義フェーズ
- `design` - 設計フェーズ
- `tasks` - タスク分解フェーズ
- `implementation` - 実装フェーズ
- `completed` - 完了

### レスポンス

```json
{
  "success": true,
  "specs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "ユーザー認証機能",
      "description": "メール/パスワード認証とOAuth2.0対応",
      "phase": "requirements",
      "githubIssueId": null,
      "githubProjectId": null,
      "createdAt": "2025-11-15T10:00:00.000Z",
      "updatedAt": "2025-11-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

### 使用例

```typescript
// 全仕様書取得
const all = await invoke('takumi:list_specs', {});

// Requirementsフェーズのみ
const requirements = await invoke('takumi:list_specs', {
  phase: 'requirements'
});

// ページネーション
const page2 = await invoke('takumi:list_specs', {
  limit: 10,
  offset: 10
});
```

---

## takumi:get_spec

指定した ID の仕様書詳細を取得します。関連するタスクも含みます。

### パラメータ

| 名前  | 型            | 必須 | 説明     |
| ----- | ------------- | ---- | -------- |
| `id`  | string (UUID) | ✓    | 仕様書ID |

### レスポンス

```json
{
  "success": true,
  "spec": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "ユーザー認証機能",
    "description": "メール/パスワード認証とOAuth2.0対応",
    "phase": "tasks",
    "githubIssueId": 123,
    "githubProjectId": "PVT_abc123",
    "githubMilestoneId": 5,
    "createdAt": "2025-11-15T10:00:00.000Z",
    "updatedAt": "2025-11-15T15:30:00.000Z"
  },
  "tasks": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "認証APIエンドポイント実装",
      "description": "POST /auth/login, POST /auth/register",
      "status": "in_progress",
      "priority": 1,
      "githubIssueId": 124,
      "githubIssueNumber": 124,
      "assignee": "username",
      "createdAt": "2025-11-15T11:00:00.000Z",
      "updatedAt": "2025-11-15T14:00:00.000Z"
    }
  ],
  "githubSync": {
    "githubId": "123",
    "githubNumber": 123,
    "lastSyncedAt": "2025-11-15T15:30:00.000Z",
    "syncStatus": "success",
    "errorMessage": null
  },
  "stats": {
    "totalTasks": 5,
    "tasksByStatus": {
      "todo": 2,
      "inProgress": 1,
      "blocked": 0,
      "review": 1,
      "done": 1
    }
  }
}
```

### エラーレスポンス

仕様書が見つからない場合は以下のようになります。

```json
{
  "error": "Spec not found: 550e8400-e29b-41d4-a716-446655440000",
  "tool": "takumi:get_spec"
}
```

### 使用例

```typescript
const spec = await invoke('takumi:get_spec', {
  id: '550e8400-e29b-41d4-a716-446655440000'
});

console.log(`仕様書: ${spec.spec.name}`);
console.log(`フェーズ: ${spec.spec.phase}`);
console.log(`タスク数: ${spec.stats.totalTasks}`);
console.log(`完了タスク: ${spec.stats.tasksByStatus.done}`);
```

---

## エラーハンドリング

すべての MCP ツールは、エラー発生時に以下の形式でエラーを返します。

```json
{
  "error": "エラーメッセージ",
  "tool": "takumi:tool_name"
}
```

### 一般的なエラー

| エラーメッセージ                 | 原因                             | 対処法                                             |
| -------------------------------- | -------------------------------- | -------------------------------------------------- |
| `Spec not found: {id}`           | 指定されたIDの仕様書が存在しない | IDを確認するか、`list_specs`で存在を確認           |
| `Database connection failed`     | データベースに接続できない       | マイグレーション実行、`.takumi`ディレクトリの確認 |
| `Invalid UUID: {id}`             | UUIDの形式が不正                 | 正しいUUID形式で指定                               |

---

## 今後追加予定のツール (Phase 2+)

### Phase 2: GitHub統合

- `takumi:approve_spec` - 仕様書フェーズ承認
- `takumi:create_task` - タスク作成
- `takumi:update_task_status` - タスクステータス更新
- `takumi:sync_github` - GitHub 手動同期

### Phase 3: TDD/Agile

- `takumi:create_sprint` - Sprint 作成
- `takumi:start_tdd_session` - TDD セッション開始
- `takumi:run_tests` - テスト実行

---

**最終更新:** 2025-11-15
**バージョン:** 0.1.0
