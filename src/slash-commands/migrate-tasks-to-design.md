---
description: "tasks フェーズの仕様書を design フェーズに移行"
argument-hint: "[spec-id]"
---

# tasks → design マイグレーション

`tasks` フェーズにある仕様書を `design` フェーズに移行します。

## 引数

- `$1` (オプション): 仕様書 ID（指定しない場合は全ての tasks フェーズ仕様書を対象）

## 使用例

```bash
# 特定の仕様書を移行
/cft:migrate-tasks-to-design dd4f5124

# 全ての tasks フェーズ仕様書を移行
/cft:migrate-tasks-to-design
```

---

## 背景

cc-craft-kit v0.2.0 以降、`tasks` フェーズは非推奨となりました。

**旧フローモデル（5 フェーズ）:**

```
requirements → design → tasks → implementation → completed
```

**新フローモデル（4 フェーズ）:**

```
requirements → design → implementation → completed
```

`design` フェーズでタスク分割と Sub Issue 作成が自動実行されるため、
`tasks` フェーズは不要になりました。

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: 対象仕様書の特定

#### 特定の仕様書を指定した場合

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/spec/resolve-id.ts "$1"
```

出力を解析し、`specs` 配列に追加。

#### 全ての tasks フェーズ仕様書を対象とする場合

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/spec/list.ts --phase tasks --format json
```

出力を解析し、`specs` 配列に設定。

### Step 2: 対象仕様書の確認

`specs` が空の場合:

```
ℹ️ tasks フェーズの仕様書はありません。

マイグレーション不要です。
```

処理を中断。

### Step 3: マイグレーション実行

各仕様書に対して以下を実行:

#### 3.1 仕様書ファイルの読み込み

Read ツールで仕様書ファイルを読み込み。

#### 3.2 「8. 実装タスクリスト」セクションの確認

タスクリストセクションが存在しない場合:

```
⚠️ ${spec.name}: タスクリストセクションがありません
   → 手動で design フェーズに移行してください
     /cft:spec-phase ${spec.id.substring(0, 8)} design
```

スキップして次の仕様書へ。

#### 3.3 フェーズを design に変更

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/spec/phase.ts "${spec.id}" design
```

#### 3.4 GitHub Issue の更新（存在する場合）

`spec.github_issue_number` が存在する場合:

```bash
gh issue comment ${spec.github_issue_number} --body "$(cat <<'EOF'
## マイグレーション完了

tasks フェーズから design フェーズに移行しました。

- マイグレーション日時: $(date -Iseconds)
- 理由: cc-craft-kit v0.2.0 以降、tasks フェーズは非推奨

詳細: design フェーズでタスク分割と Sub Issue 作成が自動実行されるため、
tasks フェーズは不要になりました。
EOF
)" --repo "$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')"
```

### Step 4: 結果の表示

```
# マイグレーション完了

## 移行済み仕様書

| ID | 名前 | GitHub Issue |
|----|------|--------------|
| ${spec.id.substring(0, 8)} | ${spec.name} | #${spec.github_issue_number || '-'} |
...

## 統計

- 対象: X 件
- 成功: Y 件
- スキップ: Z 件

## 次のアクション

- 仕様書一覧: /cft:spec-list design
- 仕様書詳細: /cft:spec-get <spec-id>
- 実装開始: /cft:spec-phase <spec-id> impl
```

---

## エラーハンドリング

### 仕様書が見つからない場合

```
❌ 仕様書が見つかりません: $1

確認事項:
- 仕様書 ID は最低 8 文字必要です
- /cft:spec-list で仕様書一覧を確認してください
```

### データベースエラーの場合

```
❌ データベースエラーが発生しました

以下を確認してください:
- データベースファイルが存在するか
- マイグレーションが完了しているか: npm run db:migrate
```

---

## 注意事項

- このマイグレーションは **非破壊的** です
- 仕様書の内容は変更されません（フェーズのみ変更）
- GitHub Issue のステータスは変更されません
- Sub Issue が既に存在する場合、そのまま維持されます

## ロールバック

誤ってマイグレーションした場合:

```bash
/cft:spec-phase <spec-id> tasks
```

ただし、`tasks` フェーズは非推奨のため、`design` フェーズでの運用を推奨します。
