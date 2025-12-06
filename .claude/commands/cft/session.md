# /cft:session - セッション管理コマンド

開発セッションの開始・終了プロトコルを実行。

## 使用方法

```
/cft:session <subcommand> [spec-id]
```

## サブコマンド

| サブコマンド | 説明 | 使用例 |
|---|---|---|
| `start [spec-id]` | セッション開始 | `/cft:session start abc123` |
| `end [spec-id]` | セッション終了 | `/cft:session end` |

---

## start サブコマンド

開発セッションを開始し、コンテキストを確立します。

### 入力
- `[spec-id]`: 仕様書ID（省略可）

### 実行手順

1. **現在のブランチを確認**
   ```bash
   git branch --show-current
   ```

2. **仕様書を特定**

   spec-id が指定された場合:
   - Glob で仕様書ファイルを検索
   - `.cc-craft-kit/specs/*<spec-id>*.md`

   spec-id が省略された場合:
   - ブランチ名から仕様書を特定
   - パターン: `<type>/spec-<short-id>-<description>`
   - 例: `feature/spec-abc123-add-auth` → `abc123` を検索

3. **仕様書を読み込み**
   - YAML フロントマターを解析
   - 本文を読み込み

4. **関連情報を収集**

   ```bash
   # Git 状態
   git status --short

   # 最近のコミット
   git log --oneline -5

   # 関連 Issue
   gh issue view <issue_number> --json state,comments
   ```

5. **セッションコンテキストを出力**

---

## 出力形式（start）

```
## 🚀 セッション開始

### 仕様書情報

| 項目 | 値 |
|---|---|
| ID | `<id>` |
| 名前 | <name> |
| フェーズ | <phase> |
| ブランチ | `<branch_name>` |
| Issue | #<issue_number> |

### 背景と目的

<仕様書から抽出>

### タスク一覧

<仕様書のタスクリストを表示>

### Git 状態

<git status の結果>

### 推奨アクション

- [ ] タスクを確認して作業を開始
- [ ] 不明点があれば Issue にコメント
```

---

## end サブコマンド

開発セッションを終了し、進捗を記録します。

### 入力
- `[spec-id]`: 仕様書ID（省略可、start と同様に特定）

### 実行手順

1. **仕様書を特定**（start と同じロジック）

2. **セッション中の変更を収集**

   ```bash
   # 未コミットの変更
   git status --short

   # セッション中のコミット（今日のコミット）
   git log --oneline --since="8 hours ago"

   # 差分サマリー
   git diff --stat HEAD~5
   ```

3. **進捗を確認**
   - 仕様書のタスクリスト完了状況を確認
   - 未完了タスクをリストアップ

4. **終了レポートを出力**

5. **Issue に進捗コメント**（オプション）

   github_issue_number がある場合:
   ```bash
   gh issue comment <issue_number> --body "<進捗レポート>"
   ```

---

## 出力形式（end）

```
## 📝 セッション終了レポート

### 仕様書情報

| 項目 | 値 |
|---|---|
| ID | `<id>` |
| 名前 | <name> |
| フェーズ | <phase> |

### セッション中の変更

| 項目 | 件数 |
|---|---:|
| コミット | N |
| 変更ファイル | N |
| 追加行 | +N |
| 削除行 | -N |

### タスク進捗

| 状態 | 件数 |
|---|---:|
| ✅ 完了 | N |
| ⏳ 進行中 | N |
| ⬜ 未着手 | N |

### 未完了タスク

- [ ] タスク1
- [ ] タスク2

### 次回の推奨アクション

- <次に着手すべきタスク>
- <確認が必要な点>

---
*セッション終了: <timestamp>*
```

---

## 仕様書の特定ロジック

### ブランチ名からの特定

ブランチ名パターン:
- `feature/spec-<short-id>-<description>`
- `fix/spec-<short-id>-<description>`
- `refactor/spec-<short-id>-<description>`
- `docs/spec-<short-id>-<description>`

抽出手順:
1. ブランチ名を `/spec-` で分割
2. 2番目の部分の先頭8文字を取得
3. その文字列で仕様書を検索

### Glob 検索

```
.cc-craft-kit/specs/*<pattern>*.md
```

複数マッチした場合:
- 完全一致（ID が完全に含まれる）を優先
- なければエラー

---

## エラーハンドリング

| エラー | 対処 |
|---|---|
| 仕様書が見つからない | spec-id を明示的に指定するよう案内 |
| ブランチが main/develop | 作業ブランチに切り替えるよう案内 |
| 未コミットの変更あり（end時） | コミットまたはスタッシュを案内 |
