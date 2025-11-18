# サブエージェント作成

新しいサブエージェント定義ファイルを作成します。

## 引数

- `$1` (必須): サブエージェント名（小文字英数字とハイフンのみ）
- `$2` (必須): サブエージェントの説明

## 使用例

```bash
/cft:agent-create documentation-writer "Creates comprehensive documentation for code and APIs"
/cft:agent-create security-auditor "Performs security audits and identifies vulnerabilities"
```

---

以下のコマンドを実行してサブエージェントを作成してください。

```bash
npx tsx .cc-craft-kit/commands/agent/create.ts "$1" "$2"
```

作成が完了したら、結果を要約して表示してください。

- サブエージェント一覧: `/cft:agent-list`

ARGUMENTS: $*
