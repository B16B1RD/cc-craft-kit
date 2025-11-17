# スキル作成

新しいスキル定義ファイルを作成します。

## 引数

- `$1` (必須): スキル名（小文字英数字とハイフンのみ、最大 64 文字）
- `$2` (必須): スキルの説明（最大 1024 文字）

## 使用例

```bash
/takumi:skill-create api-documentation "Generates comprehensive API documentation from code"
/takumi:skill-create performance-analysis "Analyzes code performance and identifies bottlenecks"
```

---

以下のコマンドを実行してスキルを作成してください。

```bash
npx tsx .takumi/commands/skill/create.ts "$1" "$2"
```

作成が完了したら、結果を要約して表示してください。

- スキル一覧: `/takumi:skill-list`

ARGUMENTS: $*
