# 各フェーズ完了時未コミットのファイルがある（主に仕様書ファイル）

**仕様書 ID:** 20a0ff2e-bab4-43f3-838a-decfd71a96da
**フェーズ:** design
**作成日時:** 2025/11/22 18:46:45
**更新日時:** 2025/11/22 18:56:36

---

## 1. 背景と目的

### 背景

現在、cc-craft-kit では各フェーズ完了時（特に `/cft:spec-create` 実行時）に Git 自動コミット機能が実装されているが、以下の問題が発生している。

1. **仕様書ファイルがコミットされない**
   - `spec.created` イベント発火時の自動コミット機能は実装済みだが、実際にはファイルがコミットされないケースが多発
   - 手動コミットが必要になり、ワークフローが中断される

2. **他のフェーズでも同様の問題**
   - requirements → design
   - design → tasks
   - tasks → implementation
   - implementation → completed

各フェーズ移行時に、仕様書ファイルやその他の変更ファイルが未コミット状態で残る。

1. **根本原因の不明確さ**
   - `git add` が実行されているか不明
   - `git commit` の実行タイミングが適切でない可能性
   - pre-commit フック（textlint）の失敗が原因の可能性

### 目的

フェーズ移行時の Git 自動コミット機能を修正し、以下を実現する。

1. **確実な自動コミット**: すべてのフェーズ移行時に変更ファイルが自動的にコミットされる
2. **pre-commit フック対応**: textlint エラーを自動修正してからコミット実行
3. **エラーハンドリング強化**: コミット失敗時の適切なエラーメッセージと復旧手順の提示
4. **手動介入の最小化**: ユーザーが手動でコミットする必要をなくす

---

## 2. 対象ユーザー

- cc-craft-kit を使用するすべての開発者
- 特に、仕様駆動開発（SDD）ワークフローを実践する開発チーム
- Git による変更履歴管理を重視するプロジェクト

---

## 3. 受け入れ基準

### 必須要件

- [ ] `/cft:spec-create` 実行時、仕様書ファイルのみが自動的にコミットされること
- [ ] 各フェーズ移行時、以下のファイルが自動コミットされること
  - **requirements/design/tasks/implementation フェーズ**: 仕様書ファイルのみ
  - **completed フェーズ**: すべての変更ファイル（実装ファイル、テストファイル、仕様書ファイル）
- [ ] pre-commit フック（textlint/markdownlint）が失敗した場合、以下が実行されること
  - [ ] ステージングされたファイルを `git reset HEAD` でロールバック
  - [ ] エラー内容（textlint/markdownlint の具体的なエラーメッセージ）を表示
  - [ ] 手動修正手順を案内（「`npm run textlint:fix` を実行してください」など）
  - [ ] フェーズ変更自体は成功し、データベース不整合を発生させないこと

### 機能要件

- [ ] **コミット前の自動チェック**
  - textlint エラーを事前に検出し、自動修正を試みる（`npm run textlint:fix`）
  - 修正可能なエラー（例: 句読点の統一、半角スペース挿入）は自動修正してからコミット実行
  - 修正不可能なエラー（例: 用語の不統一、文法エラー）が残る場合は以下を実行
    1. コミットを中止し、ステージングをロールバック
    2. エラー箇所と修正方法を明示
    3. 手動修正を案内し、フェーズ変更は成功させる

- [ ] **段階的コミットプロセス**
  1. 変更ファイルの検出（`git status --porcelain`）
  2. textlint/markdownlint 自動修正（`npm run textlint:fix`, `npm run markdownlint:fix`）
  3. 自動修正されたファイルを含めて `git add` でステージング
  4. `git commit` 実行（pre-commit フックは自動修正済みのため成功する想定）
  5. コミット成功/失敗の通知
  6. 失敗時はステージングをロールバック（`git reset HEAD`）

- [ ] **エラーハンドリング**
  - コミット失敗時、ステージングされたファイルを `git reset HEAD` でロールバック
  - 失敗理由を明確に表示（pre-commit フックエラー、Git エラーなど）
  - 手動コミット手順を案内
  - **重要: Git コミット失敗時も、フェーズ変更自体は成功させること**
    - データベースレコードの `phase` カラムは更新される
    - GitHub Issue のラベル・Projects ステータスは更新される
    - ユーザーに警告を表示し、手動コミットを促す

- [ ] **ログ記録**
  - 各ステップの実行結果を `logs` テーブルに記録
  - デバッグレベルで以下のコマンド実行ログを保存
    - `git status --porcelain` の出力
    - `npm run textlint:fix` の実行結果
    - `git add` の対象ファイルリスト
    - `git commit` の実行結果（コミットハッシュ）
  - エラー時は ERROR レベルでスタックトレースを記録

### 非機能要件

- [ ] **パフォーマンス**: コミットプロセスは通常 5 秒以内、textlint 自動修正が必要な場合は 10 秒以内に完了すること
  - ただし、以下の場合は除外
    - 100 ファイル以上の変更がある場合
    - pre-commit フックでの textlint/markdownlint が大量のエラーを検出した場合
- [ ] **信頼性**: コミット失敗時、データベースやファイルシステムの状態を破壊しないこと
- [ ] **保守性**: エラーメッセージは開発者が問題を特定しやすい内容であること

---

## 4. 制約条件

- **Git リポジトリ必須**: 機能を使用するには、プロジェクトを Git リポジトリとして初期化する必要がある
- **Node.js 環境**: textlint/markdownlint は Node.js パッケージのため、`npx` コマンドを使用可能にする必要がある
- **既存コミット履歴への影響**: 過去のコミットには影響を与えず、新規コミットのみが対象
- **pre-commit フック互換性**: husky + lint-staged の既存設定と互換性を保つこと

---

## 5. 依存関係

### 既存コンポーネント

- `src/core/workflow/git-integration.ts` - Git 自動コミット機能の実装
- `src/core/workflow/event-bus.ts` - イベント駆動アーキテクチャ
- `src/core/errors/error-handler.ts` - エラーハンドリング
- `.husky/pre-commit` - pre-commit フック設定
- `.lintstagedrc.json` - lint-staged 設定

### 外部依存

- textlint - Markdown ファイルの文法チェック
- markdownlint-cli2 - Markdown ファイルのスタイルチェック
- husky - Git フック管理
- lint-staged - ステージングファイルへのリンター適用

---

## 6. 参考情報

- [Git Hooks Documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [textlint Documentation](https://textlint.github.io/)
- [markdownlint Documentation](https://github.com/DavidAnson/markdownlint)
- [husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/okonet/lint-staged)

---

## 7. 設計

### 7.1. アーキテクチャ概要

Git 自動コミット機能は、イベント駆動アーキテクチャを活用し、以下のコンポーネントで構成される。

```text
┌─────────────────────────────────────────────────────────┐
│  Slash Commands (/cft:spec-create, /cft:spec-phase)    │
│  - 仕様書作成・フェーズ変更のエントリーポイント        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Event Bus (EventEmitter2)                              │
│  - spec.created イベント発火                            │
│  - spec.phase_changed イベント発火                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Git Integration Handler                                │
│  - handleSpecCreatedCommit()                            │
│  - handlePhaseChangeCommit()                            │
│  - 自動コミット処理の統合ロジック                       │
└────────────────┬────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌──────────┐
│ textlint│  │ Git CLI│  │ Logger   │
│ 自動修正│  │ 実行   │  │ ログ記録 │
└────────┘  └────────┘  └──────────┘
```

### 7.2. コミットフロー設計

#### 7.2.1. spec.created イベント時のコミットフロー

```typescript
// 1. イベント発火（commands/spec/create.ts）
await eventBus.emit(
  eventBus.createEvent('spec.created', specId, { phase: 'requirements' })
);

// 2. ハンドラー実行（core/workflow/git-integration.ts）
async function handleSpecCreatedCommit(specId: string) {
  try {
    // 2-1. 仕様書ファイルパスを取得
    const specFile = `.cc-craft-kit/specs/${specId}.md`;

    // 2-2. textlint 自動修正を実行
    await runTextlintFix(specFile);

    // 2-3. Git add + commit 実行
    await gitCommit(specFile, `feat: ${specName} の要件定義を完了`);

    // 2-4. 成功ログ記録
    logger.info('Auto-committed spec file', { specId, file: specFile });
  } catch (error) {
    // 2-5. エラーハンドリング（ロールバック + 警告表示）
    await handleCommitError(error, specId);
  }
}
```

#### 7.2.2. spec.phase_changed イベント時のコミットフロー

```typescript
// 1. イベント発火（commands/spec/phase.ts）
await eventBus.emit(
  eventBus.createEvent('spec.phase_changed', specId, {
    oldPhase,
    newPhase,
  })
);

// 2. ハンドラー実行（core/workflow/git-integration.ts）
async function handlePhaseChangeCommit(
  specId: string,
  oldPhase: string,
  newPhase: string
) {
  try {
    // 2-1. コミット対象ファイルを決定
    const files =
      newPhase === 'completed'
        ? getAllChangedFiles() // すべての変更ファイル
        : [`.cc-craft-kit/specs/${specId}.md`]; // 仕様書ファイルのみ

    // 2-2. textlint 自動修正を実行
    await runTextlintFix(files);

    // 2-3. Git add + commit 実行
    const message = generateCommitMessage(specId, newPhase);
    await gitCommit(files, message);

    // 2-4. 成功ログ記録
    logger.info('Auto-committed phase change', { specId, newPhase, files });
  } catch (error) {
    // 2-5. エラーハンドリング（ロールバック + 警告表示）
    await handleCommitError(error, specId);
  }
}
```

### 7.3. textlint 自動修正の設計

#### 7.3.1. runTextlintFix() 関数

```typescript
async function runTextlintFix(files: string | string[]): Promise<void> {
  const fileList = Array.isArray(files) ? files : [files];

  try {
    // 1. textlint --fix 実行
    const result = execSync(
      `npx textlint --fix ${fileList.join(' ')}`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    // 2. 実行結果をログ記録
    logger.debug('textlint --fix executed', { result, files: fileList });

    // 3. エラーが残っている場合は throw
    if (result.includes('✖')) {
      throw new Error(`textlint errors remain: ${result}`);
    }
  } catch (error) {
    // 4. エラーを再スロー（呼び出し元で処理）
    throw new Error(`textlint --fix failed: ${error.message}`);
  }
}
```

#### 7.3.2. エラー分類と対応

| エラー種別 | 検出方法 | 対応 |
|---|---|---|
| **自動修正可能** | textlint --fix で修正成功 | 修正後にコミット実行 |
| **自動修正不可** | textlint --fix 後もエラー残存 | コミット中止、手動修正を案内 |
| **textlint 実行失敗** | execSync がエラーを throw | コミット中止、エラー内容を表示 |

### 7.4. Git コミット実行の設計

#### 7.4.1. gitCommit() 関数

```typescript
async function gitCommit(
  files: string | string[],
  message: string
): Promise<void> {
  const fileList = Array.isArray(files) ? files : [files];

  try {
    // 1. git add 実行
    execSync(`git add ${fileList.join(' ')}`, { stdio: 'pipe' });
    logger.debug('git add executed', { files: fileList });

    // 2. git commit 実行
    const commitMessage = formatCommitMessage(message);
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'pipe' });
    logger.info('git commit executed', { message: commitMessage });
  } catch (error) {
    // 3. コミット失敗時、ステージングをロールバック
    execSync('git reset HEAD', { stdio: 'pipe' });
    logger.warn('Rolled back staged changes', { error: error.message });

    // 4. エラーを再スロー
    throw new Error(`git commit failed: ${error.message}`);
  }
}
```

#### 7.4.2. コミットメッセージフォーマット

```typescript
function formatCommitMessage(message: string): string {
  return `${message}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>`;
}
```

### 7.5. エラーハンドリングの設計

#### 7.5.1. handleCommitError() 関数

```typescript
async function handleCommitError(error: Error, specId: string): Promise<void> {
  // 1. エラー種別を判定
  const errorType = classifyCommitError(error);

  // 2. エラーログを記録
  logger.error('Auto-commit failed', {
    specId,
    errorType,
    message: error.message,
    stack: error.stack,
  });

  // 3. ユーザーに警告メッセージを表示
  console.warn(`
⚠️  Git auto-commit failed: ${errorType}

Error: ${error.message}

You can commit manually with:
  git add .cc-craft-kit/specs/${specId}.md
  git commit -m "feat: Manual commit for ${specId}"

Phase change was successful. Database and GitHub Issue were updated.
  `);
}
```

#### 7.5.2. エラー種別の分類

```typescript
function classifyCommitError(error: Error): string {
  if (error.message.includes('textlint')) {
    return 'textlint validation failed';
  } else if (error.message.includes('pre-commit')) {
    return 'pre-commit hook failed';
  } else if (error.message.includes('git add')) {
    return 'git add failed';
  } else if (error.message.includes('git commit')) {
    return 'git commit failed';
  } else {
    return 'unknown error';
  }
}
```

### 7.6. ログ記録の設計

#### 7.6.1. ログレベル定義

| レベル | 用途 | 例 |
|---|---|---|
| **debug** | コマンド実行ログ | `git status --porcelain` の出力 |
| **info** | 成功ログ | `Auto-committed spec file` |
| **warn** | 警告ログ | `Rolled back staged changes` |
| **error** | エラーログ | `Auto-commit failed` |

#### 7.6.2. ログ記録例

```typescript
// 成功ログ
logger.info('Auto-committed spec file', {
  specId: '20a0ff2e-bab4-43f3-838a-decfd71a96da',
  file: '.cc-craft-kit/specs/20a0ff2e-bab4-43f3-838a-decfd71a96da.md',
  commitHash: 'a387e08',
});

// エラーログ
logger.error('Auto-commit failed', {
  specId: '20a0ff2e-bab4-43f3-838a-decfd71a96da',
  errorType: 'textlint validation failed',
  message: 'textlint errors remain: 14:36 error 文末が"。"で終わっていません',
  stack: 'Error: textlint --fix failed...',
});
```

### 7.7. 既存コードの修正箇所

#### 7.7.1. `src/core/workflow/git-integration.ts`

**修正内容:**

1. `handleSpecCreatedCommit()` 関数の追加
   - textlint による自動修正
   - 仕様書ファイルのみをコミット

2. `handlePhaseChangeCommit()` 関数の修正
   - textlint による自動修正
   - completed フェーズではすべての変更ファイルをコミット
   - エラー時はロールバック処理

3. `runTextlintFix()` 関数の追加
   - textlint --fix を実行
   - エラーが残っている場合は throw

4. `gitCommit()` 関数の追加
   - git add + git commit を実行
   - コミット失敗時は git reset HEAD でロールバック

5. `handleCommitError()` 関数の追加
   - エラー種別を分類
   - ログ記録とユーザーへの警告表示

#### 7.7.2. `src/core/workflow/event-bus.ts`

**修正内容:**

1. `spec.created` イベントハンドラーの登録
   - `handleSpecCreatedCommit()` を自動実行

2. `spec.phase_changed` イベントハンドラーの修正
   - `handlePhaseChangeCommit()` を自動実行

**変更なし:**

- イベント発火ロジックは既存のまま維持
- ハンドラー登録は `getEventBusAsync()` で自動実行
