# /cft:status コマンドの見直し

**仕様書 ID:** 0e4ea00e-bdfc-4ba6-adda-a1418ebd8928
**フェーズ:** implementation
**作成日時:** 2025-11-25 00:00
**更新日時:** 2025/11/25 14:32:00

---

## 1. 背景と目的

### 背景

現在、多くの部分がスクリプトで実現されていて、なかなか仕様通りに動作していない。プロンプト指示だと簡単にできることができていない。たいていの処理は、プロンプト指示の方が上手くいく。カスタムスラッシュコマンド→スキル→サブエージェントの構成が上手く実現できていない。改めて、Claude Code のカスタムスラッシュコマンド、スキル、サブエージェントの各機能の仕様についてよく考えて、スクリプトを使わずに仕様を実現できるか再設計して欲しい。スクリプトは最終手段です。ただし、スキル内のスクリプトは OK です。

### 目的

/cft:status コマンドをプロンプトベースで再設計し、スクリプトへの依存を最小限にすることで、保守性と拡張性を向上させる。

---

## 2. 対象ユーザー

- cc-craft-kit を利用する開発者
- Claude Code でプロジェクト状況を確認したいユーザー

---

## 3. 受け入れ基準

### 必須要件

- [ ] /cft:status コマンドがプロンプトベースで動作すること
- [ ] 現在の機能（仕様書一覧、フェーズ状況、GitHub 連携状況）が維持されること
- [ ] スクリプト呼び出しを最小限に抑えること

### 機能要件

- [ ] プロジェクト概要の表示
- [ ] 仕様書一覧とフェーズ状況の表示
- [ ] GitHub Issue/PR 連携状況の表示
- [ ] 次のアクション提案の表示

### 非機能要件

- [ ] レスポンス時間が現行と同等以下であること
- [ ] エラー時に適切なメッセージを表示すること

---

## 4. 制約条件

- Claude Code のカスタムスラッシュコマンド、スキル、サブエージェントの仕様に準拠
- データベース操作が必要な場合は最小限のスクリプトを許容
- スキル内でのスクリプト使用は許容

---

## 5. 依存関係

- .cc-craft-kit/specs/*.md（仕様書ファイル）
- .cc-craft-kit/cc-craft-kit.db（データベース）
- GitHub API（Issue/PR 情報取得）

---

## 6. 参考情報

- 現在の実装: src/slash-commands/status.md
- 現在のスクリプト: src/commands/status/index.ts
- CLAUDE.md のプロンプトファースト原則

---

## 7. 設計詳細

### 7.1. アーキテクチャ設計

#### 設計方針: ハイブリッドアプローチ

プロンプトファースト原則に従い、表示ロジックをプロンプトに移行し、スクリプトは DB クエリのみに特化する。

```
┌─────────────────────────────────────────────────┐
│           /cft:status (プロンプト)              │
│  src/slash-commands/status.md                  │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   ┌────────┐ ┌────────┐ ┌──────────┐
   │ Bash   │ │ Read   │ │ Skill    │
   └────────┘ └────────┘ └──────────┘
        │         │           │
        ▼         ▼           ▼
   status:    config.   database-
   info.ts    json      schema-
   (JSON)               validator
```

#### 責務分離

| 層 | 責務 | 実装 |
|---|---|---|
| **プレゼンテーション層** | 表示、整形、次アクション提案 | status.md（プロンプト） |
| **データアクセス層** | DB クエリ、JSON 出力 | status/info.ts（スクリプト） |
| **検証層** | DB 整合性チェック | database-schema-validator スキル |

### 7.2. 機能マッピング

#### 現在の機能 → 新しい実装方法

| 機能 | 現在の実装 | 新しい実装 | 実装場所 |
|---|---|---|---|
| プロジェクト情報表示 | TypeScript 出力 | Read + プロンプト整形 | status.md |
| GitHub 連携状態 | resolveProjectId (TS) | Read (config.json) + gh コマンド | status.md |
| DB 整合性チェック | checkDatabaseIntegrity (TS) | Skill: database-schema-validator | status.md |
| フェーズ別集計 | formatTable (TS) | JSON 出力 → プロンプト表示 | status.md |
| Issue 未作成検出 | DB filter (TS) | JSON 出力 → プロンプト表示 | status.md |
| 最近の仕様書表示 | getSpecsWithGitHubInfo (TS) | JSON 出力 → プロンプト表示 | status.md |
| エラーログ表示 | DB query (TS) | JSON 出力 → プロンプト表示 | status.md |
| 次のアクション提案 | ロジック判定 (TS) | プロンプトロジック | status.md |

### 7.3. 新規スクリプト設計

#### status/info.ts（最小化スクリプト）

```typescript
interface StatusInfo {
  project: {
    name: string;
    initialized_at: string;
    directory: string;
  };
  github: {
    configured: boolean;
    owner?: string;
    repo?: string;
    project_number?: number;
  } | null;
  specs: {
    total: number;
    byPhase: Record<string, number>;
    recent: Array<{
      id: string;
      name: string;
      phase: string;
      github_issue_number: number | null;
    }>;
    withoutIssue: Array<{
      id: string;
      name: string;
      phase: string;
    }>;
  };
  logs: {
    errors: Array<{
      timestamp: string;
      message: string;
      context?: string;
    }>;
    recent: Array<{
      timestamp: string;
      level: string;
      message: string;
    }>;
  };
}
```

**スクリプトの責務:**
- DB からデータを取得
- 集計処理
- JSON 形式で出力（表示ロジックなし）

### 7.4. プロンプト設計

#### status.md の構成

1. **自動実行フローの定義**
2. **情報収集ステップ**（Bash/Read/Skill）
3. **表示フォーマットの定義**
4. **次のアクション提案ロジック**

#### 表示フォーマット例

```
# プロジェクト状況

## プロジェクト情報
- 名前: {project.name}
- ディレクトリ: {project.directory}
- 初期化日時: {project.initialized_at}

## GitHub 連携
- リポジトリ: {github.owner}/{github.repo}
- プロジェクト: #{github.project_number}

## 仕様書状況
| フェーズ | 件数 |
|---|---:|
| requirements | {specs.byPhase.requirements} |
| design | {specs.byPhase.design} |
| tasks | {specs.byPhase.tasks} |
| implementation | {specs.byPhase.implementation} |
| testing | {specs.byPhase.testing} |
| completed | {specs.byPhase.completed} |
| **合計** | **{specs.total}** |

## 最近の仕様書
{recent specs table}

## 次のアクション
{action suggestions based on status}
```

### 7.5. テスト戦略

#### 単体テスト

| テスト対象 | テスト内容 | モック対象 |
|---|---|---|
| status/info.ts | DB クエリ結果の JSON 形式検証 | データベース |
| status/info.ts | フェーズ集計ロジック | データベース |
| status/info.ts | エラーログ取得ロジック | データベース |

#### 統合テスト

| テスト対象 | テスト内容 |
|---|---|
| /cft:status コマンド | プロンプト実行フローの E2E |
| JSON 出力 + プロンプト表示 | 表示形式の検証 |

#### テストカバレッジ目標

- status/info.ts: 90% 以上
- 全体: 80% 以上

### 7.6. 移行計画

#### Phase 1: スクリプト分離

1. `src/commands/status/info.ts` を新規作成（JSON 出力のみ）
2. 既存の `src/commands/status.ts` との互換性維持
3. 単体テスト作成

#### Phase 2: プロンプト拡充

1. `src/slash-commands/status.md` を大幅リファクタリング
2. 自動実行フロー定義
3. 表示フォーマット実装

#### Phase 3: 旧スクリプト削除

1. 新プロンプトの動作確認
2. `src/commands/status.ts` の削除
3. ドキュメント更新

### 7.7. 削減効果の見込み

| 指標 | 現在 | 目標 |
|---|---:|---:|
| スクリプト行数 | 307行 | 80行程度 |
| 責務の混在 | 5つ | 1つ（データ取得のみ） |
| テスト容易性 | 低 | 高（JSON モック可能） |
| プロンプト活用度 | 低 | 高（自動実行フロー） |

---

## 8. 実装タスクリスト

### Phase 1: スクリプト分離

- [x] `src/commands/status/info.ts` を新規作成（JSON 出力のみ）
- [x] `StatusInfo` インターフェースの実装
- [x] DB クエリ実装（specs + github_sync JOIN）
- [x] フェーズ別集計ロジック実装
- [x] ログ取得クエリ実装
- [x] 単体テスト作成（`tests/commands/status/info.test.ts`）

### Phase 2: プロンプト拡充

- [x] `src/slash-commands/status.md` を大幅リファクタリング
- [x] 自動実行フロー定義
- [x] 表示フォーマット実装
- [x] 次のアクション提案ロジック実装

### Phase 3: 統合・検証

- [x] `npm run sync:dogfood` で同期
- [ ] `/cft:status` コマンド動作確認
- [ ] 旧スクリプト `src/commands/status.ts` の削除（オプション）
