---
description: "仕様書のフェーズを更新します"
argument-hint: "<spec-id> <phase>"
---

# 仕様書フェーズ更新

仕様書を次のフェーズに移行します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致可、最低 8 文字）
- `$2` (必須): 新しいフェーズ (requirements/design/tasks/implementation/completed)

## 実行内容

1. データベースと Markdown ファイルのフェーズ更新
2. 更新日時の記録
3. フェーズ固有のガイダンス表示

## 使用例

```bash
/cc-craft-kit:spec-phase f6621295 design
```

---

以下のコマンドを実行して仕様書のフェーズを更新してください。

```bash
npx tsx .cc-craft-kit/commands/spec/phase.ts "$1" "$2"
```

## フェーズ移行後の自動処理

**重要**: フェーズ移行が完了したら、ユーザーに確認を求めずに、以下の処理を**自動的に実行**してください。

### tasks フェーズに移行した場合

1. **仕様書ファイルを読み込む**: Read ツールで `.cc-craft-kit/specs/$1.md` を読み込む
2. **受け入れ基準を解析**:「3. 受け入れ基準」セクションを確認し、実装すべき機能を理解する
3. **タスクリストを生成**: TodoWrite ツールで実装タスクリストを作成する
   - 各受け入れ基準を実装可能な単位に分解
   - 依存関係と優先度を設定
4. **仕様書にタスクセクションを追加**: Edit ツールで仕様書ファイルの末尾に「## 8. 実装タスクリスト」セクションを追加
5. **GitHub に通知**: `/cc-craft-kit:spec-update $1` で GitHub Issue に更新を通知

### implementation フェーズに移行した場合

1. **仕様書ファイルを読み込む**: Read ツールで `.cc-craft-kit/specs/$1.md` を読み込む
2. **タスクリストを確認**:「8. 実装タスクリスト」セクションを確認
3. **TodoWrite でタスクを表示**: TodoWrite ツールでタスクリストを表示し、進捗管理を開始

#### 実装開始前の品質チェック（自動実行）

実装を開始する前に、以下の品質チェックを**自動的に実行**してください。

1. **TypeScript/ESLint スキルで既存コードをチェック**:
   - Skill ツールで `typescript-eslint` スキルを実行
   - 型エラーや ESLint 警告がある場合は、修正してから実装を開始
   - `npm run lint` と `npx tsc --noEmit` を実行して確認

#### 実装作業の開始

1. **最初のタスクを開始**: タスクリストの最初の未完了タスクを in_progress に設定
2. **実装を開始**:
   - 対象ファイルを Read ツールで読み込む
   - Edit ツールで必要な変更を実施
   - タスク完了後、以下の品質チェックを実行：
     - Task ツールで `test-generator` サブエージェントを実行し、単体テストを生成
     - Task ツールで `code-reviewer` サブエージェントを実行し、コード品質を検証
   - TodoWrite で completed に設定
   - 次のタスクへ自動的に移行

### その他のフェーズ

requirements, design, completed フェーズの場合は、従来通りガイダンスメッセージを表示してください。

- 仕様書の詳細確認: `/cc-craft-kit:spec-get <spec-id>`
- GitHub Issue 作成: `/cc-craft-kit:github-issue-create <spec-id>`
- 次のフェーズに移行: `/cc-craft-kit:spec-phase <spec-id> <next-phase>`
