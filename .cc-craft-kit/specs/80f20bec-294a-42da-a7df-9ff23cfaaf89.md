---
id: "80f20bec-294a-42da-a7df-9ff23cfaaf89"
name: "/cft:spec-create 時ブランチ切り替えのタイミングが不適切"
phase: "completed"
branch_name: "main"
github_issue_number: null
pr_url: null
created_at: "2025-11-23T05:43:09.643Z"
updated_at: "2025-11-23T15:21:57Z"
---

# /cft:spec-create 時ブランチ切り替えのタイミングが不適切


## 1. 背景と目的

### 背景

現在の `/cft:spec-create` コマンドの実装では、以下の問題が発生しています:

1. **処理フローのタイミング問題**:
   - TypeScript スクリプト (`src/commands/spec/create.ts`) が仕様書を作成し、ブランチを `feature/spec-<短縮ID>` に切り替える
   - 仕様書ファイル作成と Git 自動コミット完了後、**即座に develop ブランチに戻る** (216-226行目)
   - その後、スラッシュコマンド定義 (`src/slash-commands/spec-create.md`) の自動完成フロー（フェーズ 1〜4）が実行される

2. **自動完成フローが意図しないブランチで実行される**:
   - フェーズ 3 の仕様書自動完成（Edit ツール）が、**develop ブランチ上で実行される**
   - 本来は `feature/spec-<短縮ID>` ブランチで編集されるべき

3. **Git 履歴の整合性が失われる**:
   - 仕様書作成コミットは feature ブランチに記録される（Git自動コミット）
   - 仕様書編集は develop ブランチに記録される（Claude Code が自動的にコミット）
   - 結果として、仕様書ファイルが feature ブランチと develop ブランチの両方に存在し、履歴が分断される

### 目的

TypeScript スクリプトとスラッシュコマンド定義のブランチ切り替えタイミングを最適化し、以下を実現する:

1. **自動完成フローが正しいブランチ上で実行される**: フェーズ 1〜4 が `feature/spec-<短縮ID>` ブランチ上で完了する
2. **Git 履歴の整合性を保つ**: 仕様書作成から自動完成まで、すべてのコミットが feature ブランチに記録される
3. **開発者の混乱を防ぐ**: ブランチ切り替えのタイミングが明確で、予測可能な動作を提供する
4. **CLAUDE.md の設計原則を維持**: 「プロンプトで済ませられることはプロンプトで済ませる」原則を守る
---

## 2. 対象ユーザー

- **cc-craft-kit を使用する開発者**: `/cft:spec-create` コマンドを使用して仕様書を作成する開発者
- **特に影響を受けるユーザー**: 仕様書の自動完成フロー（v0.4.0 以降）を使用する開発者
---

## 3. 受け入れ基準

### 必須要件

- [ ] TypeScript スクリプト (`src/commands/spec/create.ts`) の 216-226行目（元のブランチに戻る処理）を削除またはオプション化する
- [ ] スラッシュコマンド定義 (`src/slash-commands/spec-create.md`) のフェーズ 4 完了後に、元のブランチへの復帰処理を追加する
- [ ] 自動完成フロー（フェーズ 1〜4）がすべて `feature/spec-<短縮ID>` ブランチ上で実行されることを確認する

### 機能要件

- [ ] **TypeScript スクリプトの修正**:
  - `src/commands/spec/create.ts` の 216-226行目を削除
  - または、環境変数 `AUTO_SWITCH_BACK=0` でブランチ復帰を無効化するオプションを追加

- [ ] **スラッシュコマンド定義の修正**:
  - フェーズ 4 完了後（または自動完成フローがスキップされた場合も）に、Bash ツールで元のブランチに復帰する処理を追加
  - 元のブランチ名を記録する仕組みを実装（TypeScript スクリプトの出力から解析、またはファイルに記録）

- [ ] **エラーハンドリング**:
  - ブランチ切り替え失敗時のエラーメッセージを改善
  - 自動完成フローがスキップされた場合も、ブランチ復帰処理が実行されることを保証

### 非機能要件

- [ ] **互換性**: 既存の仕様書作成フローに影響を与えない（デグレードなし）
- [ ] **保守性**: ブランチ管理ロジックが明確で、将来的な変更が容易である
- [ ] **テスタビリティ**: 単体テストでブランチ切り替えのタイミングを検証できる
- [ ] **ドキュメント**: CLAUDE.md の「スクリプトとプロンプトの使い分け指針」に準拠していることを明記
---

## 4. 制約条件

### 技術的制約

1. **Claude Code の制約**:
   - TypeScript 内から Claude Tools (Edit, Task, AskUserQuestion) を直接呼び出すことはできない
   - 自動完成フロー（Explore、Edit、code-reviewer）はスラッシュコマンド定義で実行する必要がある

2. **Git 操作の制約**:
   - ブランチ切り替えは `child_process.execFileSync()` を使用し、シェルインジェクション対策を実施する
   - ブランチキャッシュ (`src/core/git/branch-cache.ts`) をクリアする必要がある

3. **イベント駆動アーキテクチャの制約**:
   - `spec.created` イベント発火後、Git自動コミットが完了するまで待機する（`await`）
   - ブランチ切り替えは、イベントハンドラー完了後に行う必要がある

### 設計原則

1. **CLAUDE.md の「スクリプトとプロンプトの使い分け指針」を遵守**:
   - データベース操作・イベント発火は TypeScript スクリプトで実装
   - 自動完成フロー（Explore、Edit、code-reviewer）はスラッシュコマンド定義で実装

2. **最小限の修正**:
   - 既存のアーキテクチャ（イベント駆動、モジュラーモノリス）を維持
   - TypeScript スクリプトとスラッシュコマンド定義の責務境界を明確にする

### 互換性

1. **既存の仕様書作成フローとの互換性を維持**:
   - フェーズ 1〜4 がスキップされた場合（手動で仕様書を編集する場合）も正常に動作する
   - 環境変数でブランチ復帰を制御できるようにする（既存の動作を変更しない）
---

## 5. 依存関係

### コアコンポーネント

1. **`src/commands/spec/create.ts`** (仕様書作成コマンド):
   - ブランチ作成・切り替えロジック（216-226行目）を修正
   - データベース操作、イベント発火、仕様書ファイル生成を担当

2. **`src/slash-commands/spec-create.md`** (スラッシュコマンド定義):
   - 自動完成フロー（フェーズ 0〜4）を定義
   - フェーズ 4 完了後にブランチ復帰処理を追加

3. **`src/core/git/branch-creation.ts`** (ブランチ作成):
   - `createSpecBranch()` 関数でブランチ名生成・作成を担当
   - 修正は不要

4. **`src/core/git/branch-cache.ts`** (ブランチキャッシュ):
   - `getCurrentBranch()`, `clearBranchCache()` を使用
   - 修正は不要

5. **`src/core/workflow/event-bus.ts`** (イベントバス):
   - `spec.created` イベント発火を担当
   - 修正は不要

6. **`src/core/workflow/git-integration.ts`** (Git統合):
   - `spec.created` イベントハンドラーで Git 自動コミットを実行
   - 修正は不要

### 既存仕様書

- 関連する既存仕様書なし（新規問題）

### 外部依存

- **Node.js `child_process` モジュール**: Git 操作に使用
- **Git**: バージョン管理システム
---

## 6. 参考情報

### コードベース解析結果

- **現在の処理フロー**: Explore サブエージェントによる分析で、`src/commands/spec/create.ts` の 216-226行目でブランチが即座に戻ることを確認
- **推奨修正案**: 案1（ブランチ切り替え遅延）
  - TypeScript スクリプトの 216-226行目を削除
  - スラッシュコマンド定義の最後にブランチ切り替え処理を追加

### 関連ドキュメント

- **CLAUDE.md**: プロジェクト規約、スクリプトとプロンプトの使い分け指針
- **docs/ARCHITECTURE.md**: アーキテクチャ設計、イベント駆動アーキテクチャの説明

### 関連コードファイル

- `src/commands/spec/create.ts:216-226` - 問題箇所（元のブランチに戻る処理）
- `src/slash-commands/spec-create.md:107-114` - フェーズ 0（仕様書の基本作成）
- `src/slash-commands/spec-create.md:177-188` - フェーズ 3（仕様書の自動完成）
- `src/core/git/branch-creation.ts` - ブランチ作成ロジック
- `src/core/git/branch-cache.ts` - ブランチキャッシュ管理

### テスト戦略

- **単体テスト**: `tests/commands/spec/create.test.ts` でブランチ切り替えのタイミングを検証
- **統合テスト**: 実際の仕様書作成フローで、自動完成が正しいブランチ上で実行されることを確認
---

## 7. 設計詳細

### 7.1. アーキテクチャ設計

#### 7.1.1 ブランチ切り替えの処理フロー（修正前）

現在の実装では、以下の順序で処理が実行されています。

```
ユーザー入力: /cft:spec-create "<name>" [description]
         ↓
┌─────────────────────────────────────────┐
│ 1. カスタムスラッシュコマンド (.md)         │
│    - spec-create.md の自動実行フロー読み込み │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 2. フェーズ 0: 仕様書の基本作成            │
│    - npx tsx .cc-craft-kit/commands/    │
│      spec/create.ts                     │
│    - 元のブランチを記録 (originalBranch) │
│    - ブランチ作成 (feature/spec-xxx)     │
│    - ブランチ切り替え                     │
│    - データベース登録                     │
│    - ファイル作成                        │
│    - イベント発火 (spec.created)         │
│    - Git 自動コミット                    │
│    - ★ 元のブランチに戻る (216-226行目)  │ ← 問題箇所
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 3. フェーズ 1〜4: 自動完成フロー           │
│    - Explore サブエージェント (Phase 1)   │
│    - Edit ツール (Phase 3)               │ ← develop ブランチで実行される
│    - code-reviewer サブエージェント       │
└─────────────────────────────────────────┘
```

**問題点**:
- TypeScript スクリプトが完了した時点で develop ブランチに戻る
- 自動完成フロー（フェーズ 1〜4）が develop ブランチ上で実行される
- 仕様書作成コミットと編集コミットが異なるブランチに記録される

#### 7.1.2 ブランチ切り替えの処理フロー（修正後）

修正後は、以下の順序で処理を実行します。

```
ユーザー入力: /cft:spec-create "<name>" [description]
         ↓
┌─────────────────────────────────────────┐
│ 1. カスタムスラッシュコマンド (.md)         │
│    - spec-create.md の自動実行フロー読み込み │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 2. フェーズ 0: 仕様書の基本作成            │
│    - npx tsx .cc-craft-kit/commands/    │
│      spec/create.ts                     │
│    - 元のブランチを記録 (originalBranch) │
│    - ブランチ作成 (feature/spec-xxx)     │
│    - ブランチ切り替え                     │
│    - データベース登録                     │
│    - ファイル作成                        │
│    - イベント発火 (spec.created)         │
│    - Git 自動コミット                    │
│    - ★ ブランチ復帰処理を削除             │ ← 修正箇所
│    - 標準出力で元のブランチ名を記録       │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 3. フェーズ 1〜4: 自動完成フロー           │
│    - Explore サブエージェント (Phase 1)   │
│    - Edit ツール (Phase 3)               │ ← feature ブランチで実行される
│    - code-reviewer サブエージェント       │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 4. フェーズ 4 完了後: ブランチ復帰         │
│    - Bash ツールで元のブランチに復帰       │
│    - git checkout <originalBranch>      │ ← 新規追加
└─────────────────────────────────────────┘
```

**改善点**:
- TypeScript スクリプトはブランチを切り替えたまま完了
- 自動完成フロー（フェーズ 1〜4）が feature ブランチ上で実行される
- すべてのコミットが feature ブランチに記録される
- スラッシュコマンド定義の最後で元のブランチに復帰

#### 7.1.3 エラーハンドリング設計

既存実装のエラーハンドリングパターンに従い、以下の方針で実装します。

**TypeScript スクリプト（create.ts）のロールバック処理**:
- ブランチ切り替え失敗時 → エラーをスロー、ロールバック開始
- データベース登録失敗時 → ブランチ削除、元のブランチに復帰
- ファイル作成失敗時 → データベース削除、ブランチ削除、元のブランチに復帰
- Git 自動コミット失敗時 → ファイル削除、データベース削除、ブランチ削除、元のブランチに復帰

**スラッシュコマンド定義（spec-create.md）のエラーハンドリング**:
- ブランチ復帰失敗時 → 警告メッセージを表示（処理は続行）
- 自動完成フロー失敗時 → エラーメッセージを表示（ブランチはそのまま）

#### 7.1.4 元のブランチ名の記録方法

TypeScript スクリプトとスラッシュコマンド定義の間でブランチ名を共有するため、以下の方法を採用します。

**方法 1: 標準出力で記録（推奨）**

TypeScript スクリプトの標準出力に元のブランチ名を含める方法。

```typescript
// src/commands/spec/create.ts
console.log(`Original branch: ${originalBranch}`);
console.log(`New branch: ${branchName}`);
```

スラッシュコマンド定義で正規表現で抽出:

```bash
# src/slash-commands/spec-create.md
ORIGINAL_BRANCH=$(echo "$OUTPUT" | grep -oP '(?<=Original branch: ).*')
git checkout "$ORIGINAL_BRANCH"
```

**方法 2: 環境変数で記録（非推奨）**

環境変数を使用する方法は、プロセス間での変数共有が困難なため、非推奨です。

**方法 3: ファイルで記録（オーバーエンジニアリング）**

一時ファイルに保存する方法は、ファイルI/Oのオーバーヘッドがあり、不要です。

**採用方針**: 方法 1（標準出力で記録）を採用します。

### 7.2. データモデル

#### 7.2.1 関連テーブル

**specs テーブル**:
```typescript
export interface SpecsTable {
  id: Generated<string>;           // UUID
  name: string;
  description: string | null;
  phase: SpecPhase;
  branch_name: string;             // ← ブランチ名が記録される
  created_at: ColumnType<Date>;
  updated_at: ColumnType<Date>;
}
```

**修正内容**:
- テーブル構造の変更なし
- `branch_name` カラムには `feature/spec-<短縮ID>-<サニタイズ済み名>` が記録される

#### 7.2.2 ブランチキャッシュの管理

**ブランチキャッシュ（branch-cache.ts）**:
```typescript
// プロセス単位のグローバルキャッシュ
let cachedBranchName: string | null = null;

export function getCurrentBranch(): string {
  if (cachedBranchName) {
    return cachedBranchName;
  }
  // git rev-parse --abbrev-ref HEAD 実行
  cachedBranchName = execSync(...).toString().trim();
  return cachedBranchName;
}

export function clearBranchCache(): void {
  cachedBranchName = null;
}
```

**修正内容**:
- `clearBranchCache()` の呼び出しタイミングを維持
- ブランチ切り替え後に必ず `clearBranchCache()` を呼び出す

### 7.3. 修正箇所の詳細

#### 7.3.1 TypeScript スクリプトの修正

**ファイル**: `src/commands/spec/create.ts`

**修正箇所 1: 216-226行目（ブランチ復帰処理）を削除**

```typescript
// 修正前（216-226行目）
// 4. 元のブランチに戻る
if (branchSwitched) {
  try {
    execFileSync('git', ['checkout', originalBranch], { stdio: 'inherit' });
    clearBranchCache();
    console.log(formatInfo(`Switched back to branch: ${originalBranch}`, options.color));
  } catch (checkoutError) {
    const errorMessage =
      checkoutError instanceof Error ? checkoutError.message : String(checkoutError);
    console.error(`Warning: Failed to switch back to ${originalBranch}: ${errorMessage}`);
  }
}

// 修正後（削除）
// ブランチ復帰処理は、スラッシュコマンド定義（spec-create.md）に移動
```

**修正箇所 2: 標準出力で元のブランチ名を記録**

```typescript
// 修正前
console.log(
  formatSuccess(
    `
Spec created successfully!
  ID: ${shortSpecId}
  File: ${relativeSpecPath}
  Branch: ${branchName}

Next steps:
  • View the spec: /cft:spec-get ${shortSpecId}
  • Move to design phase: /cft:spec-phase ${shortSpecId} design
`.trim(),
    options.color
  )
);

// 修正後（originalBranch を追加）
console.log(
  formatSuccess(
    `
Spec created successfully!
  ID: ${shortSpecId}
  File: ${relativeSpecPath}
  Branch: ${branchName}
  Original Branch: ${originalBranch}

Next steps:
  • View the spec: /cft:spec-get ${shortSpecId}
  • Move to design phase: /cft:spec-phase ${shortSpecId} design
`.trim(),
    options.color
  )
);
```

#### 7.3.2 スラッシュコマンド定義の修正

**ファイル**: `src/slash-commands/spec-create.md`

**修正箇所: フェーズ 4 完了後にブランチ復帰処理を追加**

```markdown
## フェーズ 4: コードレビュー

...（既存のコードレビュー処理）
---

## フェーズ 5: ブランチ復帰

自動完成フローが完了したら、元のブランチに復帰します。

### 元のブランチ名を取得

フェーズ 0 の出力から元のブランチ名を抽出します。

```bash
# フェーズ 0 の出力から元のブランチ名を取得
ORIGINAL_BRANCH=$(echo "$PHASE_0_OUTPUT" | grep -oP '(?<=Original Branch: ).*')

if [ -z "$ORIGINAL_BRANCH" ]; then
  echo "Warning: Could not detect original branch name. Skipping branch switch."
else
  echo "Switching back to original branch: $ORIGINAL_BRANCH"
  git checkout "$ORIGINAL_BRANCH"

  if [ $? -eq 0 ]; then
    echo "✓ Switched back to branch: $ORIGINAL_BRANCH"
  else
    echo "Warning: Failed to switch back to $ORIGINAL_BRANCH. Please switch manually."
  fi
fi
```

**注意**: 自動完成フローがスキップされた場合も、このブランチ復帰処理は実行されます。
```

### 7.4. セキュリティ考慮事項

#### 7.4.1 シェルインジェクション対策

**既存実装（create.ts）**:
```typescript
// execFileSync を使用（execSync よりも安全）
execFileSync('git', ['checkout', branchName], { stdio: 'inherit' });
```

**スラッシュコマンド定義（spec-create.md）**:
```bash
# ダブルクォートでエスケープ（シェルインジェクション対策）
git checkout "$ORIGINAL_BRANCH"
```

#### 7.4.2 ブランチ名のサニタイゼーション

**既存実装（branch-creation.ts）**:
```typescript
function sanitizeBranchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')              // スペース → ハイフン
    .replace(/[^a-z0-9-_.]/g, '')      // 許可文字以外削除
    .replace(/-+/g, '-')               // 連続ハイフン → 単一
    .replace(/^-|-$/g, '');            // 先頭・末尾のハイフン削除
}
```

**修正内容**: サニタイゼーション処理は変更なし。

### 7.5. テスト戦略

#### 7.5.1 単体テスト

**テストファイル**: `tests/commands/spec/create.test.ts`

**テストケース**:

1. **ブランチ切り替えのタイミング検証**:
   - 仕様書作成後、feature ブランチに切り替わっていることを確認
   - 元のブランチに戻らないことを確認（Git モック）

2. **標準出力の検証**:
   - `Original Branch: <branch-name>` が出力されることを確認
   - 正規表現で抽出可能であることを確認

3. **エラーハンドリング**:
   - ブランチ切り替え失敗時のロールバックを確認
   - データベース・ファイルが削除されることを確認

**テストコード例**:

```typescript
test('仕様書作成後、feature ブランチに切り替わり、元のブランチに戻らない', async () => {
  // モック設定
  const getCurrentBranchMock = vi.mocked(getCurrentBranch);
  const execFileSyncMock = vi.mocked(execFileSync);

  getCurrentBranchMock.mockReturnValue('develop');

  // 仕様書作成
  await runSpecCreate(['test-spec', 'Test description'], {
    color: false,
    databasePath: ':memory:',
  });

  // ブランチ切り替えが1回のみ実行されることを確認（元のブランチに戻らない）
  const checkoutCalls = execFileSyncMock.mock.calls.filter(
    call => call[0] === 'git' && call[1]?.[0] === 'checkout'
  );

  expect(checkoutCalls).toHaveLength(1); // feature ブランチへの切り替えのみ
  expect(checkoutCalls[0][1]).toContain('feature/spec-');
});

test('標準出力に元のブランチ名が記録される', async () => {
  const consoleLogSpy = vi.spyOn(console, 'log');

  await runSpecCreate(['test-spec', 'Test description'], {
    color: false,
    databasePath: ':memory:',
  });

  // 標準出力に "Original Branch: develop" が含まれることを確認
  const outputCalls = consoleLogSpy.mock.calls.map(call => call[0]);
  const originalBranchOutput = outputCalls.find(output =>
    output.includes('Original Branch:')
  );

  expect(originalBranchOutput).toMatch(/Original Branch: develop/);
});
```

#### 7.5.2 統合テスト

**テストシナリオ**:

1. **自動完成フローの統合テスト**:
   - `/cft:spec-create "test-spec"` を実行
   - フェーズ 1〜4 が feature ブランチ上で実行されることを確認
   - Git 履歴を確認し、すべてのコミットが feature ブランチに記録されていることを確認
   - フェーズ 4 完了後、元のブランチに復帰することを確認

2. **手動仕様書作成フロー**:
   - `/cft:spec-create "test-spec" --skip-auto-completion` を実行（仮定）
   - feature ブランチに切り替わることを確認
   - 自動完成がスキップされることを確認
   - ブランチ復帰処理が実行されることを確認

#### 7.5.3 E2Eテスト

**テストシナリオ**:

1. **実際の仕様書作成フロー**:
   - Claude Code で `/cft:spec-create "E2E test spec"` を実行
   - 自動完成フロー（Explore、Edit、code-reviewer）の実行を確認
   - Git 履歴を確認し、コミットがすべて feature ブランチに記録されていることを確認
   - 元のブランチに復帰することを確認

2. **エラーシナリオ**:
   - ブランチ切り替え失敗時のロールバックを確認
   - データベース・ファイルが削除されることを確認
---

## 8. 実装タスクリスト

### 8.1 TypeScript スクリプトの修正 (src/commands/spec/create.ts)

- [ ] 216-226行目のブランチ復帰処理を削除
- [ ] 標準出力に `Original Branch: ${originalBranch}` を追加

### 8.2 スラッシュコマンド定義の修正 (src/slash-commands/spec-create.md)

- [ ] フェーズ 5: ブランチ復帰処理を追加
  - フェーズ 0 の出力から元のブランチ名を抽出
  - `git checkout "$ORIGINAL_BRANCH"` で元のブランチに復帰
  - エラーハンドリング（ブランチ復帰失敗時の警告）

### 8.3 単体テストの追加 (tests/commands/spec/create.test.ts)

- [ ] ブランチ切り替えタイミングの検証テスト
  - 仕様書作成後、feature ブランチに切り替わることを確認
  - 元のブランチに戻らないことを確認（Git モック）
- [ ] 標準出力の検証テスト
  - `Original Branch: <branch-name>` が出力されることを確認
  - 正規表現で抽出可能であることを確認

### 8.4 統合テスト・動作確認

- [ ] `npm run sync:dogfood` でソースコードを同期
- [ ] `/cft:spec-create "test-spec"` で動作確認
  - 自動完成フロー（フェーズ 1〜4）が feature ブランチで実行されることを確認
  - フェーズ 4 完了後、元のブランチに復帰することを確認
- [ ] 全テスト実行と型チェック
  - `npm test` で単体テスト実行
  - `npx tsc --noEmit` で型エラーがないことを確認
