---
description: "プロジェクトの現在の状況を表示します"
---

# プロジェクト状況

Takumiプロジェクトの現在の状況を表示します。

## 実行内容

1. プロジェクト設定の読み込み
2. 仕様書統計の取得
3. タスク統計の取得
4. GitHub同期状況の確認

## 使用例

```
/takumi:status
```

---

以下のMCPツールを呼び出して、プロジェクトの状況を集計してください:

1. `.takumi/config.json` を読み込んでプロジェクト情報を取得
2. `takumi:list_specs` を呼び出して全仕様書を取得
3. 各フェーズごとの仕様書数を集計

以下の形式で状況を表示してください:

## 📊 Takumiプロジェクト状況

### プロジェクト情報
- **プロジェクト名:** {name}
- **説明:** {description}
- **GitHubリポジトリ:** {githubRepo}
- **作成日:** {createdAt}

### 仕様書統計
- **総数:** X件
- **Requirements:** Y件
- **Design:** Z件
- **Tasks:** A件
- **Implementation:** B件
- **Completed:** C件

### 最近の活動
(最新5件の仕様書を表示)

### 次のアクション
- 新しい仕様書を作成: `/takumi:spec-create <name>`
- 仕様書一覧を見る: `/takumi:spec-list`
