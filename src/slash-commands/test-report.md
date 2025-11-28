---
description: "テスト結果をGitHub Issueに記録します"
argument-hint: "[spec-id]"
---

# テストレポート

テストを実行し、結果を GitHub Issue にレポートとして記録します。
テスト駆動開発のベストプラクティスに基づき、品質状態を可視化します。

## 引数

- `$1` (任意): 仕様書 ID（部分一致可、最低 8 文字）
  - 省略した場合: 現在のブランチに紐づく仕様書を自動検出

## 使用例

```bash
# 仕様書 ID を指定
/cft:test-report f6621295

# 現在のブランチから自動検出
/cft:test-report
```

---

## 自動実行フロー

重要: 以下の処理を**自動的に実行**してください。ユーザーに確認を求めないでください。

### Step 1: 仕様書の特定

`/cft:session-start` の Step 2 と同様の方法で仕様書を特定。

結果を記録:
- `SPEC_ID`: 仕様書 ID
- `SPEC_NAME`: 仕様書名
- `GITHUB_ISSUE_NUMBER`: GitHub Issue 番号

仕様書が見つからない場合:
```
ℹ️ 仕様書が見つかりません

プロジェクト全体のテストレポートを生成します。
```
`GITHUB_ISSUE_NUMBER` を null として続行。

### Step 2: テスト実行

Bash ツールで以下を実行:

```bash
npm test -- --passWithNoTests --json --outputFile=.cc-craft-kit/test-results.json 2>&1
```

テスト結果を `TEST_OUTPUT` として記録。

### Step 3: テスト結果の解析

`.cc-craft-kit/test-results.json` が生成された場合、Read ツールで読み込み:

```json
{
  "numTotalTests": 100,
  "numPassedTests": 95,
  "numFailedTests": 3,
  "numPendingTests": 2,
  "testResults": [
    {
      "name": "テストファイルパス",
      "status": "passed|failed",
      "message": "エラーメッセージ（失敗時）"
    }
  ]
}
```

解析結果を記録:
- `TOTAL_TESTS`: 総テスト数
- `PASSED_TESTS`: 成功数
- `FAILED_TESTS`: 失敗数
- `PENDING_TESTS`: スキップ数
- `FAILED_DETAILS`: 失敗したテストの詳細

### Step 4: カバレッジ取得（任意）

Bash ツールで以下を実行:

```bash
npm test -- --coverage --coverageReporters=json-summary --passWithNoTests 2>&1 || true
```

`coverage/coverage-summary.json` が生成された場合、Read ツールで読み込み:

```json
{
  "total": {
    "lines": { "pct": 85.5 },
    "statements": { "pct": 84.2 },
    "functions": { "pct": 90.1 },
    "branches": { "pct": 75.3 }
  }
}
```

解析結果を記録:
- `LINE_COVERAGE`: 行カバレッジ
- `FUNCTION_COVERAGE`: 関数カバレッジ
- `BRANCH_COVERAGE`: 分岐カバレッジ

### Step 5: レポート生成

以下のフォーマットでレポートを生成:

```markdown
## テスト結果レポート

**実行日時**: {現在日時（YYYY/MM/DD HH:mm 形式）}
**仕様書**: {SPEC_NAME} (存在する場合)

### サマリー

| 項目 | 件数 |
|------|-----:|
| 成功 | {PASSED_TESTS} |
| 失敗 | {FAILED_TESTS} |
| スキップ | {PENDING_TESTS} |
| **合計** | **{TOTAL_TESTS}** |

### 結果

{FAILED_TESTS == 0 の場合}
✓ すべてのテストが成功しました

{FAILED_TESTS > 0 の場合}
⚠️ {FAILED_TESTS} 件のテストが失敗しました

#### 失敗したテスト

{FAILED_DETAILS の各テストについて}
- `{テストファイル}`: {テスト名}
  ```
  {エラーメッセージ（最初の 5 行）}
  ```

{カバレッジ情報がある場合}
### カバレッジ

| 種別 | カバレッジ |
|------|----------:|
| 行 | {LINE_COVERAGE}% |
| 関数 | {FUNCTION_COVERAGE}% |
| 分岐 | {BRANCH_COVERAGE}% |

{LINE_COVERAGE < 80 の場合}
⚠️ 行カバレッジが 80% 未満です。テストの追加を検討してください。

---
*自動生成 by cc-craft-kit test-report*
```

### Step 6: GitHub Issue への記録

`GITHUB_ISSUE_NUMBER` が存在する場合:

Bash ツールで以下を実行:

```bash
npx tsx .cc-craft-kit/commands/knowledge/progress.ts "$SPEC_ID" "$(cat <<'EOF'
{Step 5 で生成したレポート}
EOF
)"
```

または、gh CLI で直接コメント:

```bash
REPO=$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')
gh issue comment $GITHUB_ISSUE_NUMBER --repo "$REPO" --body "$(cat <<'EOF'
{Step 5 で生成したレポート}
EOF
)"
```

### Step 7: 進捗ファイルの更新

`SPEC_ID` が存在する場合、進捗ファイルを更新:

Read ツールで `.cc-craft-kit/session/specs/<SPEC_ID>.json` を読み込み。

Write ツールで更新:

```json
{
  "context": {
    "pendingIssues": [
      // 既存の問題
      // 失敗したテストがある場合は追加
      "テスト失敗: {テストファイル} - {テスト名}"
    ],
    "lastTestReport": {
      "date": "{現在日時}",
      "total": {TOTAL_TESTS},
      "passed": {PASSED_TESTS},
      "failed": {FAILED_TESTS},
      "coverage": {LINE_COVERAGE}
    }
  }
}
```

### Step 8: 結果の表示

```markdown
# テストレポート

{Step 5 で生成したレポートを表示}

## アクション

{GITHUB_ISSUE_NUMBER が存在する場合}
✓ GitHub Issue #{GITHUB_ISSUE_NUMBER} にレポートを記録しました

{GITHUB_ISSUE_NUMBER が存在しない場合}
ℹ️ GitHub Issue が設定されていないため、レポートはローカルのみに保存されました

## 次のステップ

{FAILED_TESTS > 0 の場合}
- 失敗したテストを修正してください
- 修正後、再度テストを実行: `npm test`

{LINE_COVERAGE < 80 の場合}
- テストカバレッジを向上させてください
- テスト生成: `/cft:test-generate <file-pattern>`

{FAILED_TESTS == 0 && LINE_COVERAGE >= 80 の場合}
- コードの品質は良好です
- タスク完了: `/cft:task-done <issue-number>`
```

---

## エラーハンドリング

### npm test が失敗した場合

```
❌ テスト実行に失敗しました

エラー:
{エラーメッセージ}

対処法:
- package.json に test スクリプトがあるか確認
- 依存関係をインストール: npm install
- テストフレームワークの設定を確認
```

### JSON 出力が生成されない場合

```
⚠️ テスト結果の JSON 出力が生成されませんでした

テストフレームワークが JSON レポーターをサポートしていない可能性があります。

標準出力からの解析結果:
{TEST_OUTPUT の要約}
```

### gh CLI が利用できない場合

```
⚠️ gh CLI が見つかりません

GitHub Issue へのレポート記録をスキップしました。
レポートはコンソールに表示されています。

gh CLI のインストール:
- macOS: brew install gh
- Ubuntu: sudo apt install gh
```

---

## オプション

### --coverage フラグ

カバレッジを必ず取得:

```bash
/cft:test-report --coverage
```

### --pattern フラグ

特定のテストパターンのみ実行:

```bash
/cft:test-report --pattern="auth"
```

→ `npm test -- --testPathPattern="auth"` を実行

---

## 参考: テスト駆動のベストプラクティス

> 機能完了フラグは十分テスト後のみ設定する

> ユニットテストより「エンドツーエンド検証」を優先し、ブラウザ自動化ツールで人間的なテストを実施

参照:
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices
- https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
