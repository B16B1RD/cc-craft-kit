# GitHub Issue が自動で更新されない

**仕様書 ID:** f87ee406-918d-4fab-bcde-22eaf30b7fc2
**フェーズ:** completed
**作成日時:** 2025/11/17 10:08:01
**更新日時:** 2025/11/17 10:24:53

---

## 1. 背景と目的

### 背景

現在の cc-craft-kit では、以下のイベント駆動による GitHub Issue 自動更新機能が実装されています:

**✅ 実装済みの自動更新機能:**

1. **仕様書作成時** (`spec.created` イベント)
   - GitHub Issue を自動作成
   - フェーズラベル (`phase:requirements`) を自動付与
   - GitHub Project に自動追加
   - 実装場所: `src/core/workflow/github-integration.ts:44-175`

2. **フェーズ変更時** (`spec.phase_changed` イベント)
   - Issue タイトルに `[phase]` プレフィックスを追加
   - フェーズラベルを自動更新
   - フェーズ移行コメントを自動追加
   - **GitHub Project ステータスを自動更新** (requirements → Todo, design → In Progress など)
   - 実装場所: `src/core/workflow/github-integration.ts:177-271`

3. **仕様書更新時** (`spec.updated` イベント)
   - 仕様書更新コメントを自動追加
   - 実装場所: `src/core/workflow/github-integration.ts:273-324`

**❌ 実装されていない自動更新:**

4. **仕様書作成時の Issue 作成が失敗する場合がある**
   - 現状: `src/commands/spec/create.ts:150` で `getEventBus()` を使用
   - 問題: ハンドラー登録完了前にイベント発火される可能性がある
   - 結果: GitHub Issue が自動作成されない（まさにこの仕様書で発生）
   - 解決策: `getEventBusAsync()` を使用

5. **フェーズ変更時も同様の問題がある**
   - 現状: `src/commands/spec/phase.ts:92` で `getEventBus()` を使用
   - 問題: ハンドラー登録完了前にイベント発火される可能性
   - 結果: Issue ラベル更新、Project ステータス更新が失敗する場合がある

6. **進捗記録時** (`/cft:knowledge-progress`)
   - 現状: 直接 GitHub API を呼び出してコメント追加（イベント駆動ではない）
   - 問題: イベントバスを経由していないため、拡張性が低い

7. **エラー記録時** (`/cft:knowledge-error`)
   - 現状: 直接 GitHub API を呼び出し
   - 問題: イベント駆動ではない

8. **Tips記録時** (`/cft:knowledge-tip`)
   - 現状: 直接 GitHub API を呼び出し
   - 問題: イベント駆動ではない

9. **completed フェーズ時の Issue 自動クローズ**
   - 現状: Issue は開いたまま
   - 期待: completed フェーズに移行したら Issue を自動クローズ

### 問題点

1. **`getEventBus()` vs `getEventBusAsync()` の使い分けミス**:
   - イベント発火前にハンドラー登録完了を保証していない
   - 結果: GitHub Issue 自動作成が失敗する（この仕様書で再現）
2. **イベント駆動の不一致**: 一部のコマンドはイベント駆動、一部は直接 API 呼び出し
3. **completed 時の Issue クローズ漏れ**: 手動でクローズする必要がある
4. **拡張性の低さ**: ナレッジベース系コマンドは直接 API 呼び出しのため、プラグインで拡張しにくい

### 目的

すべてのコマンドをイベント駆動に統一し、以下を実現する:

1. **完全なイベント駆動アーキテクチャ**: すべてのコマンドが適切なイベントを発火
2. **completed フェーズでの Issue 自動クローズ**: フェーズ移行時に自動でクローズ
3. **拡張性の向上**: プラグインがイベントを購読して独自の処理を追加可能
4. **一貫性の向上**: すべてのコマンドが統一されたイベントフローに従う

---

## 2. 対象ユーザー

- **cc-craft-kit 開発者**: 仕様駆動開発を実践する開発者
- **プラグイン開発者**: イベントを購読してカスタム処理を追加したい開発者

---

## 3. 受け入れ基準

### 必須要件

- [ ] **すべてのコマンドで `getEventBusAsync()` を使用してハンドラー登録完了を保証**
- [ ] 仕様書作成時に GitHub Issue が確実に自動作成される
- [ ] completed フェーズ移行時に GitHub Issue が自動クローズされる
- [ ] イベント駆動の統一により、プラグインが容易にイベントを購読できる

### 機能要件

#### 3.1. 新規イベント追加

- [ ] `knowledge.progress_recorded` イベントを追加
- [ ] `knowledge.error_recorded` イベントを追加
- [ ] `knowledge.tip_recorded` イベントを追加

#### 3.2. イベントハンドラー実装

- [ ] `knowledge.progress_recorded` → GitHub Issue コメント追加ハンドラー
- [ ] `knowledge.error_recorded` → GitHub Issue コメント追加ハンドラー
- [ ] `knowledge.tip_recorded` → GitHub Issue コメント追加ハンドラー

#### 3.3. completed フェーズでの Issue クローズ

- [ ] `spec.phase_changed` ハンドラーに Issue クローズ処理を追加
- [ ] newPhase === 'completed' の場合に Issue をクローズ
- [ ] クローズコメントを自動追加（完了日時、実装内容サマリーなど）

#### 3.4. コマンド実装の修正

- [ ] `src/commands/spec/create.ts` で `getEventBus()` → `getEventBusAsync()` に変更
- [ ] `src/commands/spec/phase.ts` で `getEventBus()` → `getEventBusAsync()` に変更
- [ ] `/cft:knowledge-progress` をイベント駆動に変更
- [ ] `/cft:knowledge-error` をイベント駆動に変更
- [ ] `/cft:knowledge-tip` をイベント駆動に変更

### 非機能要件

- [ ] イベント発火後、ハンドラーのエラーはコマンド実行を失敗させない（現在と同じ動作）
- [ ] GitHub API エラー時は警告のみ表示し、処理を継続
- [ ] イベントハンドラーの処理時間は平均 500ms 以内（API 呼び出し含む）

---

## 4. 制約条件

- **後方互換性**: 既存のコマンド動作を変更しない（イベント発火を追加するのみ）
- **GitHub API レート制限**: 過度な API 呼び出しを避ける（バッチ処理は不要）
- **エラーハンドリング**: イベントハンドラーのエラーはログ出力のみ、コマンド実行は継続

---

## 5. 依存関係

- **EventBus**: `src/core/workflow/event-bus.ts`
- **GitHub統合ハンドラー**: `src/core/workflow/github-integration.ts`
- **ナレッジベースコマンド**: `src/commands/knowledge/`
- **フェーズ変更コマンド**: `src/commands/spec/phase.ts`

---

## 6. 参考情報

### 既存の実装

- **イベント駆動の成功例**: `spec.phase_changed` イベント
  - `src/commands/spec/phase.ts:92-98` でイベント発火
  - `src/core/workflow/github-integration.ts:177-271` でハンドラー実装
  - `src/core/workflow/git-integration.ts` でもフックして Git 自動コミット

- **直接API呼び出しの例**: `/cft:knowledge-progress`
  - `src/commands/knowledge/record.ts:42-130` で直接 `GitHubKnowledgeBase` を呼び出し
  - イベントを発火していない

### Claude.md の該当箇所

CLAUDE.md には既に以下の記述があります:

> **重要なイベントタイプ:**
> - `spec.created` - 仕様書作成時
> - `spec.phase_changed` - フェーズ移行時
> - `task.created` - タスク作成時
> - `github.issue_created` - GitHub Issue 作成時
> - `github.issue_updated` - GitHub Issue 更新時

この仕様では、ナレッジベース系のイベント (`knowledge.*`) を追加します。

---

## 7. 設計 (Design Phase)

### 7.1. アーキテクチャ概要

```
┌─────────────────────────────────────────────────────┐
│            コマンド実行                              │
│  (/cft:spec-create, /cft:spec-phase など)    │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ getEventBusAsync()  │ ← 【重要】ハンドラー登録完了を待機
         └──────────┬──────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │  eventBus.emit()    │ イベント発火
         └──────────┬──────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │  イベントハンドラー  │
         │  - GitHub統合       │
         │  - Git統合          │
         │  - プラグイン       │
         └──────────┬──────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │  GitHub API呼び出し │
         │  - Issue作成/更新   │
         │  - コメント追加     │
         │  - Project更新      │
         └─────────────────────┘
```

### 7.2. イベントフロー設計

#### 7.2.1. 仕様書作成フロー

**修正前（問題あり）:**
```typescript
// src/commands/spec/create.ts (現在)
const eventBus = getEventBus(); // ハンドラー登録を待たない
await eventBus.emit(eventBus.createEvent('spec.created', id, { ... }));
// → ハンドラー未登録のためIssue作成失敗
```

**修正後（正しい）:**
```typescript
// src/commands/spec/create.ts (修正後)
const eventBus = await getEventBusAsync(); // ハンドラー登録完了を待機
await eventBus.emit(eventBus.createEvent('spec.created', id, { ... }));
// → 確実にハンドラーが実行され、Issue作成成功
```

#### 7.2.2. フェーズ変更フロー

**修正前（問題あり）:**
```typescript
// src/commands/spec/phase.ts (現在)
const eventBus = getEventBus();
await eventBus.emit(eventBus.createEvent('spec.phase_changed', spec.id, { ... }));
// → ハンドラー未登録の可能性
```

**修正後（正しい）:**
```typescript
// src/commands/spec/phase.ts (修正後)
const eventBus = await getEventBusAsync();
await eventBus.emit(eventBus.createEvent('spec.phase_changed', spec.id, { ... }));
```

#### 7.2.3. ナレッジベース記録フロー（新規設計）

**修正前（直接API呼び出し）:**
```typescript
// src/commands/knowledge/record.ts (現在)
const client = new GitHubClient({ token: githubToken });
const issues = new GitHubIssues(client);
await issues.addComment(owner, repo, issueNumber, comment);
// → イベント駆動ではない
```

**修正後（イベント駆動）:**
```typescript
// src/commands/knowledge/record.ts (修正後)
const eventBus = await getEventBusAsync();
await eventBus.emit(eventBus.createEvent('knowledge.progress_recorded', spec.id, {
  message,
  timestamp: new Date().toISOString(),
}));
// → イベントハンドラーがGitHub APIを呼び出す
```

### 7.3. 新規イベント定義

#### 7.3.1. WorkflowEventType 拡張

```typescript
// src/core/workflow/event-bus.ts
export type WorkflowEventType =
  | 'spec.created'
  | 'spec.updated'
  | 'spec.phase_changed'
  | 'task.created'
  | 'task.status_changed'
  | 'task.completed'
  | 'github.issue_created'
  | 'github.issue_updated'
  | 'knowledge.progress_recorded'   // 新規追加
  | 'knowledge.error_recorded'      // 新規追加
  | 'knowledge.tip_recorded'        // 新規追加
  | 'subagent.started'
  | 'subagent.completed'
  | 'subagent.failed'
  | 'skill.executed';
```

#### 7.3.2. イベントデータ型定義

```typescript
// 進捗記録イベント
interface ProgressRecordedData {
  message: string;
  details?: string;
  timestamp: string;
}

// エラー記録イベント
interface ErrorRecordedData {
  errorDescription: string;
  solution: string;
  timestamp: string;
}

// Tips記録イベント
interface TipRecordedData {
  category: string;
  title: string;
  content: string;
  timestamp: string;
}
```

### 7.4. GitHub統合ハンドラー設計

#### 7.4.1. completed フェーズでのIssueクローズ

```typescript
// src/core/workflow/github-integration.ts
eventBus.on('spec.phase_changed', async (event) => {
  // 既存の処理（ラベル更新、Projectステータス更新）
  // ...

  // 新規追加: completedフェーズでIssueをクローズ
  if (event.data.newPhase === 'completed') {
    const closeComment = `## ✅ 実装完了

この仕様書の実装が完了しました。

**完了日時:** ${new Date().toLocaleString('ja-JP')}
**最終フェーズ:** completed
**仕様書:** [\`.cc-craft-kit/specs/${spec.id}.md\`](../../.cc-craft-kit/specs/${spec.id}.md)
`;

    await issues.addComment(owner, repo, issueNumber, closeComment);
    await issues.close(owner, repo, issueNumber);
    console.log(`✓ GitHub Issue #${issueNumber} closed automatically`);
  }
});
```

#### 7.4.2. ナレッジベースイベントハンドラー

```typescript
// src/core/workflow/github-integration.ts
export function registerGitHubIntegrationHandlers(eventBus: EventBus, db: Kysely<Database>): void {
  // 既存のハンドラー...

  // knowledge.progress_recorded → GitHub Issueコメント追加
  eventBus.on('knowledge.progress_recorded', async (event) => {
    const spec = await db.selectFrom('specs').where('id', '=', event.specId).selectAll().executeTakeFirst();
    if (!spec || !spec.github_issue_id) return;

    const comment = `## 📊 進捗記録

${event.data.message}

**記録日時:** ${new Date(event.data.timestamp).toLocaleString('ja-JP')}
`;

    await issues.addComment(owner, repo, spec.github_issue_id, comment);
  });

  // knowledge.error_recorded → GitHub Issueコメント追加
  eventBus.on('knowledge.error_recorded', async (event) => {
    const spec = await db.selectFrom('specs').where('id', '=', event.specId).selectAll().executeTakeFirst();
    if (!spec || !spec.github_issue_id) return;

    const comment = `## 🐛 エラー解決策

**エラー内容:**
${event.data.errorDescription}

**解決策:**
${event.data.solution}

**記録日時:** ${new Date(event.data.timestamp).toLocaleString('ja-JP')}
`;

    await issues.addComment(owner, repo, spec.github_issue_id, comment);
  });

  // knowledge.tip_recorded → GitHub Issueコメント追加
  eventBus.on('knowledge.tip_recorded', async (event) => {
    const spec = await db.selectFrom('specs').where('id', '=', event.specId).selectAll().executeTakeFirst();
    if (!spec || !spec.github_issue_id) return;

    const comment = `## 💡 Tips: ${event.data.category}

**${event.data.title}**

${event.data.content}

**記録日時:** ${new Date(event.data.timestamp).toLocaleString('ja-JP')}
`;

    await issues.addComment(owner, repo, spec.github_issue_id, comment);
  });
}
```

### 7.5. コマンド修正設計

#### 7.5.1. spec/create.ts

```diff
- const eventBus = getEventBus();
+ const eventBus = await getEventBusAsync();
  await eventBus.emit(eventBus.createEvent('spec.created', id, { ... }));
```

#### 7.5.2. spec/phase.ts

```diff
- const eventBus = getEventBus();
+ const eventBus = await getEventBusAsync();
  await eventBus.emit(eventBus.createEvent('spec.phase_changed', spec.id, { ... }));
```

#### 7.5.3. knowledge/record.ts

```diff
  // 進捗記録
  export async function recordProgress(specId: string, message: string) {
-   const client = new GitHubClient({ token: githubToken });
-   const issues = new GitHubIssues(client);
-   await issues.addComment(owner, repo, issueNumber, comment);
+   const eventBus = await getEventBusAsync();
+   await eventBus.emit(eventBus.createEvent('knowledge.progress_recorded', spec.id, {
+     message,
+     timestamp: new Date().toISOString(),
+   }));
  }
```

### 7.6. エラーハンドリング設計

すべてのイベントハンドラーは以下のパターンでエラーハンドリングを実装:

```typescript
eventBus.on('event.type', async (event) => {
  try {
    // GitHub API呼び出し
  } catch (error) {
    // エラーログ出力のみ（コマンド実行は継続）
    console.error('Warning: Failed to handle event:', error);
  }
});
```

### 7.7. テスト戦略

#### 7.7.1. 単体テスト

- `getEventBusAsync()` がハンドラー登録完了を待つことを検証
- 各イベントハンドラーが正しく GitHub API を呼び出すことを検証（モック使用）

#### 7.7.2. 統合テスト

- 仕様書作成 → GitHub Issue 自動作成の完全フロー
- フェーズ変更 → Issue 更新の完全フロー
- completed 移行 → Issue クローズの完全フロー

### 7.8. 実装優先順位

1. **Phase 1: `getEventBusAsync()` 修正** (最重要)
   - `src/commands/spec/create.ts`
   - `src/commands/spec/phase.ts`

2. **Phase 2: completed時のIssueクローズ**
   - `src/core/workflow/github-integration.ts` のハンドラー追加

3. **Phase 3: 新規イベント追加**
   - `WorkflowEventType` 拡張
   - ナレッジベースイベントハンドラー実装

4. **Phase 4: コマンド修正**
   - `src/commands/knowledge/record.ts` をイベント駆動に変更

5. **Phase 5: テスト実装**
   - 単体テスト、統合テスト

---

## 8. タスク分解 (Tasks Phase)

### Phase 1: `getEventBusAsync()` 修正 (最重要・最優先)

**タスク 1.1: `src/commands/spec/create.ts` の修正**
- **所要時間**: 15 分
- **依存関係**: なし
- **詳細**:
  - 150 行目: `const eventBus = getEventBus();` → `const eventBus = await getEventBusAsync();`
  - import 文を確認: `getEventBusAsync` をインポート
- **受け入れ基準**:
  - [ ] `getEventBusAsync()` を使用してイベントバスを取得
  - [ ] 仕様書作成時に GitHub Issue が確実に自動作成される
  - [ ] TypeScript コンパイルエラーがない

**タスク 1.2: `src/commands/spec/phase.ts` の修正**
- **所要時間**: 15 分
- **依存関係**: なし
- **詳細**:
  - 92 行目: `const eventBus = getEventBus();` → `const eventBus = await getEventBusAsync();`
  - import 文を確認
- **受け入れ基準**:
  - [ ] `getEventBusAsync()` を使用してイベントバスを取得
  - [ ] フェーズ変更時に Issue ラベル・Project ステータスが確実に更新される
  - [ ] TypeScript コンパイルエラーがない

**タスク 1.3: 検証テスト**
- **所要時間**: 30 分
- **依存関係**: タスク 1.1, 1.2
- **詳細**:
  - 新規仕様書を作成して GitHub Issue が自動作成されることを確認
  - フェーズ変更して Issue が自動更新されることを確認
- **受け入れ基準**:
  - [ ] `/cft:spec-create` 実行時に Issue が自動作成される
  - [ ] `/cft:spec-phase` 実行時に Issue が自動更新される

---

### Phase 2: completed 時の Issue クローズ

**タスク 2.1: `GitHubIssues` クラスに `close()` メソッド追加**
- **所要時間**: 30 分
- **依存関係**: なし
- **詳細**:
  - `src/integrations/github/issues.ts` に `close()` メソッドを追加
  - REST API: `PATCH /repos/{owner}/{repo}/issues/{issue_number}` で `state: 'closed'` を設定
- **受け入れ基準**:
  - [ ] `close(owner, repo, issueNumber)` メソッドが実装されている
  - [ ] GitHub API 呼び出しが正しく動作する
  - [ ] エラーハンドリングが実装されている

**タスク 2.2: `spec.phase_changed` ハンドラーに Issue クローズ処理を追加**
- **所要時間**: 45 分
- **依存関係**: タスク 2.1
- **詳細**:
  - `src/core/workflow/github-integration.ts:177-271` の `spec.phase_changed` ハンドラーを修正
  - `event.data.newPhase === 'completed'` の場合に Issue をクローズ
  - クローズコメントを追加
- **受け入れ基準**:
  - [ ] completed フェーズ移行時に Issue がクローズされる
  - [ ] クローズコメントが追加される（完了日時、仕様書リンク）
  - [ ] エラー時は警告のみ表示（フェーズ変更は成功）

**タスク 2.3: 検証テスト**
- **所要時間**: 30 分
- **依存関係**: タスク 2.2
- **詳細**:
  - テスト用仕様書を作成し、completed フェーズに移行
  - GitHub Issue が自動クローズされることを確認
- **受け入れ基準**:
  - [ ] `/cft:spec-phase <spec-id> completed` 実行時に Issue がクローズされる
  - [ ] クローズコメントが正しく追加される

---

### Phase 3: 新規イベント追加

**タスク 3.1: `WorkflowEventType` 拡張**
- **所要時間**: 15 分
- **依存関係**: なし
- **詳細**:
  - `src/core/workflow/event-bus.ts:7-19` に以下を追加:
    - `'knowledge.progress_recorded'`
    - `'knowledge.error_recorded'`
    - `'knowledge.tip_recorded'`
- **受け入れ基準**:
  - [ ] 型定義に 3 つの新規イベントが追加されている
  - [ ] TypeScript コンパイルエラーがない

**タスク 3.2: イベントデータ型定義**
- **所要時間**: 30 分
- **依存関係**: なし
- **詳細**:
  - `src/core/types/events.ts` (新規作成) または `event-bus.ts` にインターフェース定義:
    - `ProgressRecordedData`
    - `ErrorRecordedData`
    - `TipRecordedData`
- **受け入れ基準**:
  - [ ] 各イベントデータの型定義が実装されている
  - [ ] エクスポートされている

---

### Phase 4: GitHub統合ハンドラー実装

**タスク 4.1: `knowledge.progress_recorded` ハンドラー実装**
- **所要時間**: 45 分
- **依存関係**: タスク 3.1, 3.2
- **詳細**:
  - `src/core/workflow/github-integration.ts` の `registerGitHubIntegrationHandlers()` に追加
  - 仕様書取得、GitHub 設定チェック、コメント追加
- **受け入れ基準**:
  - [ ] イベント発火時に GitHub Issue コメントが追加される
  - [ ] コメントフォーマットが正しい（絵文字、日時）
  - [ ] エラーハンドリングが実装されている

**タスク 4.2: `knowledge.error_recorded` ハンドラー実装**
- **所要時間**: 45 分
- **依存関係**: タスク 3.1, 3.2
- **詳細**:
  - 同様にハンドラーを追加
  - エラー内容と解決策を含むコメントを生成
- **受け入れ基準**:
  - [ ] イベント発火時に GitHub Issue コメントが追加される
  - [ ] エラーと解決策が明確に表示される

**タスク 4.3: `knowledge.tip_recorded` ハンドラー実装**
- **所要時間**: 45 分
- **依存関係**: タスク 3.1, 3.2
- **詳細**:
  - 同様にハンドラーを追加
  - カテゴリ、タイトル、コンテンツを含むコメントを生成
- **受け入れ基準**:
  - [ ] イベント発火時に GitHub Issue コメントが追加される
  - [ ] Tips フォーマットが正しい

---

### Phase 5: コマンド実装の修正

**タスク 5.1: `recordProgress()` をイベント駆動に変更**
- **所要時間**: 1 時間
- **依存関係**: タスク 4.1
- **詳細**:
  - `src/commands/knowledge/record.ts:42-130` を修正
  - GitHub API 直接呼び出しを削除
  - `getEventBusAsync()` を使用してイベント発火
- **受け入れ基準**:
  - [ ] `/cft:knowledge-progress` 実行時にイベントが発火される
  - [ ] GitHub Issue コメントが追加される（ハンドラー経由）
  - [ ] 既存の動作が保持される

**タスク 5.2: `recordErrorSolution()` をイベント駆動に変更**
- **所要時間**: 1 時間
- **依存関係**: タスク 4.2
- **詳細**:
  - `src/commands/knowledge/record.ts:135-224` を修正
  - 同様にイベント駆動に変更
- **受け入れ基準**:
  - [ ] `/cft:knowledge-error` 実行時にイベントが発火される
  - [ ] GitHub Issue コメントが追加される

**タスク 5.3: `recordTip()` をイベント駆動に変更**
- **所要時間**: 1 時間
- **依存関係**: タスク 4.3
- **詳細**:
  - `src/commands/knowledge/record.ts:229-320` を修正
  - 同様にイベント駆動に変更
- **受け入れ基準**:
  - [ ] `/cft:knowledge-tip` 実行時にイベントが発火される
  - [ ] GitHub Issue コメントが追加される

---

### Phase 6: テスト実装

**タスク 6.1: `getEventBusAsync()` の単体テスト**
- **所要時間**: 1 時間
- **依存関係**: タスク 1.1, 1.2
- **詳細**:
  - `tests/core/workflow/event-bus.test.ts` にテスト追加
  - ハンドラー登録完了を待つことを検証
- **受け入れ基準**:
  - [ ] `getEventBusAsync()` がハンドラー登録完了を待つことをテスト
  - [ ] カバレッジ 80% 以上

**タスク 6.2: GitHub統合ハンドラーの単体テスト**
- **所要時間**: 2 時間
- **依存関係**: タスク 4.1, 4.2, 4.3
- **詳細**:
  - `tests/core/workflow/github-integration.test.ts` にテスト追加
  - GitHub API 呼び出しをモック化
- **受け入れ基準**:
  - [ ] 各ハンドラーが正しく GitHub API を呼び出すことをテスト
  - [ ] カバレッジ 80% 以上

**タスク 6.3: 統合テスト**
- **所要時間**: 2 時間
- **依存関係**: すべてのタスク
- **詳細**:
  - E2E テストで完全なフローを検証
  - 仕様書作成 → Issue 作成 → フェーズ変更 → Issue 更新 → completed → Issue クローズ
- **受け入れ基準**:
  - [ ] 完全なワークフローが正しく動作することをテスト
  - [ ] エラーケースもテスト

---

### Phase 7: ドキュメント更新

**タスク 7.1: CLAUDE.md の更新**
- **所要時間**: 30 分
- **依存関係**: すべての実装タスク
- **詳細**:
  - イベントタイプのリストに `knowledge.*` を追加
  - ベストプラクティスセクションを更新
- **受け入れ基準**:
  - [ ] 新規イベントがドキュメントに記載されている
  - [ ] `getEventBusAsync()` 使用の推奨が明記されている

---

### タスク総数と所要時間の見積もり

| Phase | タスク数 | 合計所要時間 |
|---|---|---|
| Phase 1: `getEventBusAsync()` 修正 | 3 | 1時間 |
| Phase 2: completed時のIssueクローズ | 3 | 1時間45分 |
| Phase 3: 新規イベント追加 | 2 | 45分 |
| Phase 4: GitHub統合ハンドラー実装 | 3 | 2時間15分 |
| Phase 5: コマンド実装の修正 | 3 | 3時間 |
| Phase 6: テスト実装 | 3 | 5時間 |
| Phase 7: ドキュメント更新 | 1 | 30分 |
| **合計** | **18** | **13時間15分** |

### 実装順序

1. **Phase 1** (最優先) → 即座にバグ修正、他のフェーズの基盤
2. **Phase 2** → 重要な機能追加（Issue 自動クローズ）
3. **Phase 3, 4, 5** → 並行実装可能（新規イベント関連）
4. **Phase 6** → すべての実装完了後
5. **Phase 7** → 最後にドキュメント整備
