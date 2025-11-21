# 品質要件定義ファイル初期化

品質要件定義ファイル (`.cc-craft-kit/quality-requirements.yaml`) のテンプレートを生成します。

## 使用例

```bash
/cft:quality-init
/cft:quality-init --force  # 既存ファイルを上書き
```

## 実行内容

1. `.cc-craft-kit/quality-requirements.yaml` ファイルを生成
2. デフォルトの品質要件テンプレートを出力
   - セキュリティ監査 (security-audit)
   - API ドキュメント生成 (api-documentation-generator)

## 生成されるファイル

```yaml
version: "1.0"

quality_requirements:
  - name: "security-audit"
    type: "subagent"
    trigger_phase: "implementation"
    description: "OWASP Top 10 に基づくセキュリティ脆弱性チェック"
    template: "security-auditor"
    tools: ["Read", "Grep", "Bash"]
    parameters:
      owasp_version: "2021"
      severity_threshold: "high"

  - name: "api-documentation-generator"
    type: "skill"
    trigger_phase: "completed"
    description: "OpenAPI 仕様書から API ドキュメントを自動生成"
    template: "api-doc-generator"
    tools: ["Read", "Write"]
    parameters:
      spec_format: "OpenAPI 3.0"
      output_format: "Markdown"
```

---

以下のコマンドを実行して品質要件定義ファイルを初期化してください。

```bash
npx tsx .cc-craft-kit/commands/quality/init.ts "$@"
```
