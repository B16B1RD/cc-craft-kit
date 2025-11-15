---
description: "プロジェクトの現在の状況を表示します"
---

# プロジェクト状況

Takumi プロジェクトの現在の状況を表示します。

## 実行内容

1. プロジェクト設定の読み込み
2. 仕様書統計の取得
3. タスク統計の取得
4. GitHub 同期状況の確認

## 使用例

```bash
/takumi:status
```

---

以下の MCP ツールを呼び出して、プロジェクトの状況を集計してください。

1. `.takumi/config.json` を読み込んでプロジェクト情報を取得してください。
2. `takumi:list_specs` を呼び出して全仕様書を取得してください。
3. 各フェーズごとの仕様書数を集計してください。

以下の形式で状況を表示してください。

## 📊 Takumiプロジェクト状況

### プロジェクト情報

- **プロジェクト名:** {name}
- **説明:** {description}
- **GitHubリポジトリ:** {githubRepo}
- **作成日:** {createdAt}

### 仕様書統計

- **総数:** X 件
- **Requirements:** Y 件
- **Design:** Z 件
- **Tasks:** A 件
- **Implementation:** B 件
- **Completed:** C 件

### 最近の活動

(最新 5 件の仕様書を表示)

### 次のアクション

- 新しい仕様書を作成: `/takumi:spec-create <name>`
- 仕様書一覧を見る: `/takumi:spec-list`
