# GitHub Projects v2 推奨ビュー設定ガイド

このガイドでは、Takumi と GitHub Projects v2 を効果的に連携させるための推奨ビュー設定を解説します。

## 概要

GitHub Projects v2 を作成すると、デフォルトでテーブルビューが追加されていますが、効果的なプロジェクト管理のためにはビューのカスタマイズが必須です。このガイドでは、Takumi の開発ワークフローに最適化された 3 つの推奨ビュー設定を紹介します。

## 事前準備: Status フィールドの追加

GitHub Projects v2 では、Status フィールドはデフォルトでは存在しません。まず Status フィールドを **Single select カスタムフィールド** として追加する必要があります。

### Status フィールドの作成手順

1. Project の Table ビューを開く
2. 右端のフィールドヘッダーにある **「+」** ボタンをクリック
3. **「New field」** を選択
4. フィールド名に `Status` と入力
5. フィールドタイプで **「Single select」** を選択
6. Options に以下を追加:
   - `Todo`
   - `In Progress`
   - `Done`
7. **「Save」** をクリック

### Takumi の Phase と Project Status のマッピング

Takumi では、仕様書のフェーズ変更時に自動的に GitHub Project の Status フィールドが更新されます。

| Takumi Phase | Project Status |
|--------------|----------------|
| requirements | Todo |
| design | In Progress |
| tasks | In Progress |
| implementation | In Progress |
| completed | Done |

この自動マッピングにより、仕様書のフェーズを更新するだけで Project ボード上のステータスも同期されます。

## 推奨ビュー構成

Takumi プロジェクトでは、以下の 3 つのビューを設定することを推奨します:

1. **Status Board** (Board) - 日々の作業管理用
2. **All Tasks** (Table) - 全タスクの詳細確認・検索用
3. **Timeline** (Roadmap) - リリース計画用（オプション）

---

## 1. Board ビュー - カンバンスタイル

### 用途

タスクの進捗を視覚的に管理し、WIP（Work In Progress）制限を意識した開発を実現します。

### 設定手順

1. Project ページで **「+ New view」** をクリック
2. **「Board」** を選択
3. ビュー名を **「Status Board」** に設定
4. **「Column by」** で **「Status」** フィールドを選択
5. 列の順序を調整: **Todo → In Progress → Done**

### 推奨カスタマイズ

#### フィルター設定

```text
is:open
```

未クローズの Issue のみを表示し、完了済みタスクでボードが混雑するのを防ぎます。

#### 表示フィールド

- Title（タスク名）
- Assignees（担当者）
- Labels（Takumi が自動付与する `phase:requirements` などのラベルを表示）

### 利点

- ✅ 一目で各ステータスのタスク数がわかる
- ✅ ドラッグ&ドロップでステータス変更可能
- ✅ WIP 制限を視覚的に管理しやすい
- ✅ チーム全体の作業状況を共有しやすい

---

## 2. Table ビュー - 詳細管理

### 用途

全タスクの詳細情報を一覧表示し、強力なフィルター・ソート機能で必要な情報を素早く見つけます。

### 設定手順

1. デフォルトの **「Table」** ビューを使用（または新規作成）
2. ビュー名を **「All Tasks」** に設定
3. 表示する列を追加: 必要なフィールドを追加

### 推奨カスタマイズ

#### グループ化

**Group by** 機能を使用してカスタムフィールドでアイテムをグループ化できます。

**Status でグループ化**（Status フィールド追加後）:

```text
Group by: Status
```

これにより、Todo/In Progress/Done ごとにタスクが整理されます。

**注意**: Title、Labels、Reviewers、Linked pull requests ではグループ化できません（GitHub の仕様）。

#### ソート設定

Table ビューでは、各列のヘッダーをクリックしてソートできます。

**Status フィールドでソート**（Status カスタムフィールド追加後）:

```text
Status: Todo → In Progress → Done
```

**Priority フィールドでソート**（Priority カスタムフィールド追加後）:

```text
Priority: High → Medium → Low
```

複数フィールドでのソートも可能です。Priority フィールドの追加方法は、後述の「優先度ビュー」セクションを参照してください。

#### フィルター例

**自分のタスクのみ表示**:

```text
assignee:@me
```

**特定ラベルのみ表示**（Takumi の phase ラベル）:

```text
label:phase:implementation
```

**未クローズの Issue のみ表示**:

```text
is:open
```

**複数条件の組み合わせ（AND 条件）**:

```text
assignee:@me is:open label:phase:implementation
```

**複数ラベルのいずれか（OR 条件）**:

```text
label:phase:implementation,phase:design
```

**条件の否定**:

```text
-assignee:@me
```

### 表示推奨フィールド

| フィールド | 説明 |
|-----------|------|
| Title | タスク名（デフォルト） |
| Status | Todo/In Progress/Done（カスタムフィールドとして追加が必要） |
| Assignees | 担当者（デフォルト） |
| Labels | Takumi が自動付与する `phase:requirements` などのラベル（デフォルト） |

### 利点

- ✅ 詳細な情報を一覧で確認可能
- ✅ 強力なフィルター・ソート機能
- ✅ CSV エクスポート可能
- ✅ 複雑な検索条件に対応

---

## 3. Roadmap ビュー - タイムライン（オプション）

### 用途

タスクのスケジュールをタイムラインで可視化し、プロジェクト全体の進捗とマイルストーンを管理します。

### 設定手順

1. Project ページで **「+ New view」** をクリック
2. **「Roadmap」** を選択
3. ビュー名を **「Timeline」** に設定
4. **「Start date」** と **「End date」** フィールドを設定

### 推奨カスタマイズ

#### グループ化

- **Phase**: フェーズごとにタスクをグループ化
- **Assignees**: 担当者ごとにタスクをグループ化

#### ズームレベル

- **Month**: 月単位でスケジュール表示
- **Quarter**: 四半期単位でロードマップ表示

#### フィルター

```text
is:open
```

未完了タスクのみを表示し、タイムラインをすっきりと保ちます。

### 注意事項

⚠️ **Roadmap ビューを使用するには、各 Issue に開始日・期日を設定する必要があります。**

Takumi では現在、開始日・期日のフィールドは自動設定されないため、以下の方法で手動で追加してください:

1. Project の Settings → Fields → Add field
2. **「Date」** タイプのカスタムフィールドを 2 つ作成:
   - `Start date`
   - `End date`
3. 各 Issue に日付を設定

### 利点

- ✅ プロジェクト全体のスケジュールを把握
- ✅ タスク間の依存関係を視覚化
- ✅ リリース計画の策定に有用
- ✅ マイルストーンとの関連を明確化

---

## その他の推奨設定

### Phase ラベル別ビュー

各フェーズごとに専用ビューを作成すると、フェーズ別の作業に集中しやすくなります。

#### Requirements View (Table)

```text
Filter: label:phase:requirements
Group by: Status
```

要件定義中のタスクのみを表示します。

#### Implementation View (Table)

```text
Filter: label:phase:implementation
Group by: assignee
```

実装中のタスクを担当者別に表示します。

**注意**: Group by では assignee（小文字）を使用します。

#### Completed View (Table)

```text
Filter: label:phase:completed is:closed
```

完了したタスクのみを表示します。

### 優先度ビュー（Priority カスタムフィールドを追加する場合）

Priority カスタムフィールドを追加すると、優先度別のビューも作成できます。

#### Priority フィールドの追加方法

1. Project の **Settings** → **Fields** に移動
2. **Add field** → **Single select** を選択
3. Field name: `Priority`
4. Options を追加:
   - `High`（高）
   - `Medium`（中）
   - `Low`（低）
5. Save

#### High Priority View (Board)

Priority フィールド追加後、以下のビューを作成できます:

```text
Filter: priority:high is:open
Column by: Status
```

---

## Takumi プロジェクトでの実践例

Takumi 開発プロジェクト自身では、以下のビュー構成を使用しています:

### 基本構成（最小セット）

1. **Status Board** (Board)
   - 日々の作業管理
   - Status でグループ化（Todo/In Progress/Done）
   - Filter: `is:open`

2. **All Tasks** (Table)
   - 全タスクの詳細確認
   - Phase でグループ化
   - すべてのフィールドを表示

### 拡張構成（推奨セット）

上記に加えて:

1. **Requirements** (Table)
   - Filter: `phase:requirements`
   - 要件定義フェーズのタスク管理

2. **In Progress** (Table)
   - Filter: `status:"In Progress"`
   - 現在進行中のタスクに集中

3. **Timeline** (Roadmap)
   - リリース計画・スケジュール管理
   - 開始日・期日を設定した Issue のみ表示

---

## ビューの切り替えとベストプラクティス

### 作業フェーズ別の推奨ビュー

| 作業内容 | 推奨ビュー | 理由 |
|---------|-----------|------|
| 日々のタスク管理 | Status Board | 視覚的にステータスを把握 |
| 詳細な検索・フィルタリング | All Tasks | 強力な検索機能 |
| フェーズ別レビュー | Phase フィルタービュー | 各フェーズに集中 |
| スケジュール確認 | Timeline | 全体像とマイルストーンを把握 |
| 担当者別レビュー | Assignees でグループ化 | 個人の作業状況を確認 |

### 効率的な運用のコツ

1. **デフォルトビューを設定**: 最もよく使うビューをデフォルトに設定
2. **フィルターを保存**: よく使う検索条件はビューとして保存
3. **定期的に見直し**: プロジェクトの成長に合わせてビューを調整
4. **チームで共有**: ビュー設定をチーム全体で統一

---

## トラブルシューティング

### Status フィールドが見つからない

GitHub Projects v2 では、Status フィールドはデフォルトでは存在しません。本ドキュメント冒頭の「事前準備: Status フィールドの追加」セクションを参照して、カスタムフィールドとして追加してください。

### Phase ラベルが自動更新されない

Takumi の GitHub 統合が正しく設定されているか確認してください。

**チェック項目**:

- `.env` ファイルに `GITHUB_TOKEN` が設定されている
- `takumi github init <owner> <repo>` を実行済み
- 仕様書に GitHub Issue が紐づいている

### Project に Issue が自動追加されない

環境変数または config.json で Project 設定が必要です。

**設定方法**:

`.env` に以下を追加:

```env
GITHUB_PROJECT_NAME="Your Project Name"
```

または `.takumi/config.json` に以下を追加:

```json
{
  "github": {
    "owner": "your-username",
    "repo": "your-repo",
    "project_id": 1
  }
}
```

---

## 参考情報

- [GitHub Projects v2 公式ドキュメント](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [Takumi クイックスタートガイド](./QUICK_START.md)
- [Takumi GitHub 統合ガイド](./QUICK_START.md#github連携を有効にする場合)

---

**Takumi (匠)** - 匠の技で、開発ワークフローを磨き上げる。
