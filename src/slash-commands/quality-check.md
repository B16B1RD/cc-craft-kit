# 品質チェック不足検出

品質要件定義ファイルに基づき、現在不足している品質チェック（サブエージェント・スキル）を検出します。

## 引数

- `$1` (オプション): 仕様書 ID（部分一致可、最低 8 文字）

## 使用例

```bash
# すべてのフェーズの品質チェック不足を検出
/cft:quality-check

# 特定の仕様書のフェーズに対する品質チェック不足を検出
/cft:quality-check f6621295
```

## 実行内容

1. 品質要件定義ファイル (`.cc-craft-kit/quality-requirements.yaml`) を読み込む
2. 既存のサブエージェント (`.claude/agents/`) とスキル (`.claude/skills/`) を取得
3. 各フェーズで不足している品質チェックを検出
4. 不足しているサブエージェント・スキルのリストを表示

## 出力例

```text
# Quality Requirements Check

Found 1 phase(s) with missing quality checks.

## Phase: implementation

  Missing: security-audit
  Type: subagent
  Description: OWASP Top 10 に基づくセキュリティ脆弱性チェック
  Template: security-auditor
  Reason: Subagent 'security-audit' or 'custom-security-audit' not found in .claude/agents/

  Generate: /cft:quality-generate subagent security-audit

Next steps:
  1. Generate missing subagents/skills with /cft:quality-generate
  2. Or update .cc-craft-kit/quality-requirements.yaml to remove unneeded checks
```

---

以下のコマンドを実行して品質チェック不足を検出してください。

```bash
npx tsx .cc-craft-kit/commands/quality/check.ts "$1"
```
