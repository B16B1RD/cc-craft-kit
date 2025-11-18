import { Kysely } from 'kysely';
import { Database } from '../../database/schema.js';
import { Subagent, SubagentContext, SubagentResult } from '../types.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * DocumentationWriter入力
 */
export interface DocumentationWriterInput {
  specId: string;
  targetType: 'api' | 'readme' | 'architecture' | 'user-guide' | 'inline-code';
  sourceFiles?: string[]; // コードドキュメント生成時
  metadata?: {
    projectName?: string;
    version?: string;
    description?: string;
    architecture?: {
      pattern?: string;
      components?: Array<{
        name?: string;
        type?: string;
        responsibilities?: string[];
        dependencies?: string[];
      }>;
      dataFlow?: string[];
      technologyStack?: {
        frontend?: string[];
        backend?: string[];
        database?: string[];
        infrastructure?: string[];
      };
      [key: string]: unknown;
    };
  };
  outputDirectory: string;
}

/**
 * DocumentationWriter出力
 */
export interface DocumentationWriterOutput {
  documents: Array<{
    path: string;
    content: string;
    type: 'markdown' | 'html' | 'jsdoc';
  }>;
  summary: string;
}

/**
 * DocumentationWriter Subagent
 * プロジェクトドキュメントを自動生成
 */
export class DocumentationWriter
  implements Subagent<DocumentationWriterInput, DocumentationWriterOutput>
{
  name = 'documentation-writer';
  description = 'プロジェクトドキュメントを自動生成します';
  version = '1.0.0';

  constructor(_db: Kysely<Database>) {}

  async execute(
    input: DocumentationWriterInput,
    _context: SubagentContext
  ): Promise<SubagentResult<DocumentationWriterOutput>> {
    try {
      const output = await this.generateDocumentation(input);

      // ドキュメントを保存
      await this.saveDocuments(output.documents);

      return {
        success: true,
        data: output,
        logs: [
          `Generated ${output.documents.length} documentation files`,
          `Type: ${input.targetType}`,
          `Output: ${input.outputDirectory}`,
        ],
        nextActions: ['ドキュメントのレビュー', 'GitHubへのコミット'],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async validate(input: DocumentationWriterInput): Promise<boolean> {
    return !!input.specId && !!input.targetType && !!input.outputDirectory;
  }

  /**
   * ドキュメント生成ロジック
   */
  private async generateDocumentation(
    input: DocumentationWriterInput
  ): Promise<DocumentationWriterOutput> {
    const documents: DocumentationWriterOutput['documents'] = [];

    switch (input.targetType) {
      case 'readme':
        documents.push(await this.generateReadme(input));
        break;
      case 'api':
        documents.push(await this.generateApiDocumentation(input));
        break;
      case 'architecture':
        documents.push(await this.generateArchitectureDocumentation(input));
        break;
      case 'user-guide':
        documents.push(await this.generateUserGuide(input));
        break;
      case 'inline-code':
        if (input.sourceFiles) {
          const inlineDocs = await this.generateInlineDocumentation(input.sourceFiles);
          documents.push(...inlineDocs);
        }
        break;
    }

    const summary = `Generated ${documents.length} ${input.targetType} documentation files`;

    return { documents, summary };
  }

  /**
   * README.md生成
   */
  private async generateReadme(
    input: DocumentationWriterInput
  ): Promise<DocumentationWriterOutput['documents'][0]> {
    const projectName = input.metadata?.projectName || 'Project';
    const description = input.metadata?.description || 'プロジェクトの説明';
    const version = input.metadata?.version || '1.0.0';

    const content = `# ${projectName}

${description}

## バージョン

\`${version}\`

## インストール

\`\`\`bash
npm install
\`\`\`

## 使い方

\`\`\`bash
npm start
\`\`\`

## 開発

### セットアップ

\`\`\`bash
npm install
npm run dev
\`\`\`

### テスト

\`\`\`bash
npm test
\`\`\`

### ビルド

\`\`\`bash
npm run build
\`\`\`

## アーキテクチャ

このプロジェクトは以下のアーキテクチャを採用しています:

- パターン: ${input.metadata?.architecture?.pattern || 'Layered Architecture'}
- 構成: ${input.metadata?.architecture?.components?.length || 0}個のコンポーネント

詳細は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照してください。

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## 作成者

Takumi (匠) - Claude Code開発支援ツールキット
`;

    return {
      path: path.join(input.outputDirectory, 'README.md'),
      content,
      type: 'markdown',
    };
  }

  /**
   * API ドキュメント生成
   */
  private async generateApiDocumentation(
    input: DocumentationWriterInput
  ): Promise<DocumentationWriterOutput['documents'][0]> {
    const content = `# API ドキュメント

## 概要

このAPIは${input.metadata?.projectName || 'プロジェクト'}の機能を提供します。

## エンドポイント

### GET /api/v1/resource

リソースを取得します。

**リクエスト**

\`\`\`bash
curl -X GET http://localhost:3000/api/v1/resource
\`\`\`

**レスポンス**

\`\`\`json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Sample Resource"
  }
}
\`\`\`

### POST /api/v1/resource

リソースを作成します。

**リクエスト**

\`\`\`bash
curl -X POST http://localhost:3000/api/v1/resource \\
  -H "Content-Type: application/json" \\
  -d '{"name": "New Resource"}'
\`\`\`

**レスポンス**

\`\`\`json
{
  "success": true,
  "data": {
    "id": "124",
    "name": "New Resource"
  }
}
\`\`\`

## エラーレスポンス

\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ"
  }
}
\`\`\`

## 認証

APIキーを使用した認証が必要です。

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`
`;

    return {
      path: path.join(input.outputDirectory, 'API.md'),
      content,
      type: 'markdown',
    };
  }

  /**
   * アーキテクチャドキュメント生成
   */
  private async generateArchitectureDocumentation(
    input: DocumentationWriterInput
  ): Promise<DocumentationWriterOutput['documents'][0]> {
    const architecture = input.metadata?.architecture || {};

    const content = `# アーキテクチャドキュメント

## アーキテクチャパターン

**${architecture.pattern || 'Layered Architecture'}**

## コンポーネント構成

${
  architecture.components
    ? architecture.components
        .map(
          (comp) => `
### ${comp.name} (${comp.type})

**責務**:
${comp.responsibilities?.map((r: string) => `- ${r}`).join('\n') || '- 未定義'}

**依存関係**:
${comp.dependencies?.map((d: string) => `- ${d}`).join('\n') || '- なし'}
`
        )
        .join('\n')
    : '（コンポーネント情報なし）'
}

## データフロー

${
  architecture.dataFlow
    ? architecture.dataFlow.map((flow) => `- ${flow}`).join('\n')
    : '（データフロー情報なし）'
}

## 技術スタック

${
  architecture.technologyStack
    ? `
### フロントエンド
${architecture.technologyStack.frontend?.map((tech) => `- ${tech}`).join('\n') || '- N/A'}

### バックエンド
${architecture.technologyStack.backend?.map((tech) => `- ${tech}`).join('\n') || '- N/A'}

### データベース
${architecture.technologyStack.database?.map((tech) => `- ${tech}`).join('\n') || '- N/A'}

### インフラ
${architecture.technologyStack.infrastructure?.map((tech) => `- ${tech}`).join('\n') || '- N/A'}
`
    : '（技術スタック情報なし）'
}

## 設計原則

- 単一責任の原則 (SRP)
- 依存性逆転の原則 (DIP)
- インターフェース分離の原則 (ISP)

## 今後の改善

- スケーラビリティの向上
- パフォーマンス最適化
- セキュリティ強化
`;

    return {
      path: path.join(input.outputDirectory, 'ARCHITECTURE.md'),
      content,
      type: 'markdown',
    };
  }

  /**
   * ユーザーガイド生成
   */
  private async generateUserGuide(
    input: DocumentationWriterInput
  ): Promise<DocumentationWriterOutput['documents'][0]> {
    const content = `# ユーザーガイド

## はじめに

${input.metadata?.projectName || 'このプロジェクト'}へようこそ。
このガイドでは、基本的な使い方を説明します。

## インストール

### 必要な環境

- Node.js 18以上
- npm または yarn

### インストール手順

1. リポジトリをクローン

\`\`\`bash
git clone <repository-url>
cd ${input.metadata?.projectName || 'project'}
\`\`\`

2. 依存関係をインストール

\`\`\`bash
npm install
\`\`\`

3. 環境変数を設定

\`\`\`bash
cp .env.example .env
# .envファイルを編集
\`\`\`

## 基本的な使い方

### 起動

\`\`\`bash
npm start
\`\`\`

### 設定

設定ファイルは \`config/\` ディレクトリにあります。

### トラブルシューティング

#### 問題1: 起動できない

**解決方法**: Node.jsのバージョンを確認してください。

\`\`\`bash
node --version
\`\`\`

#### 問題2: 依存関係エラー

**解決方法**: node_modulesを削除して再インストールしてください。

\`\`\`bash
rm -rf node_modules package-lock.json
npm install
\`\`\`

## FAQ

### Q: どのように設定をカスタマイズしますか?

A: \`.env\` ファイルで環境変数を設定できます。

### Q: サポートはどこで受けられますか?

A: GitHubのIssuesで質問してください。

## まとめ

詳細なドキュメントは [README.md](./README.md) を参照してください。
`;

    return {
      path: path.join(input.outputDirectory, 'USER_GUIDE.md'),
      content,
      type: 'markdown',
    };
  }

  /**
   * インラインコードドキュメント生成 (JSDoc形式)
   */
  private async generateInlineDocumentation(
    sourceFiles: string[]
  ): Promise<DocumentationWriterOutput['documents']> {
    const documents: DocumentationWriterOutput['documents'] = [];

    for (const filePath of sourceFiles) {
      try {
        const sourceCode = await fs.readFile(filePath, 'utf-8');

        // 既にドキュメントがある場合はスキップ
        if (sourceCode.includes('/**')) {
          continue;
        }

        // 関数/クラスにJSDocを追加
        const documentedCode = this.addJSDoc(sourceCode);

        documents.push({
          path: filePath,
          content: documentedCode,
          type: 'jsdoc',
        });
      } catch {
        // ファイル読み込みエラーは無視
      }
    }

    return documents;
  }

  /**
   * JSDocコメントを追加
   */
  private addJSDoc(sourceCode: string): string {
    let documentedCode = sourceCode;

    // クラスにJSDocを追加
    documentedCode = documentedCode.replace(
      /^(export\s+)?class\s+(\w+)/gm,
      (match, _exportKeyword, className) => {
        return `/**
 * ${className}クラス
 * TODO: クラスの説明を追加
 */
${match}`;
      }
    );

    // 関数にJSDocを追加
    documentedCode = documentedCode.replace(
      /^(export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm,
      (match, _exportKeyword, functionName) => {
        return `/**
 * ${functionName}
 * TODO: 関数の説明を追加
 * @param {any} params - パラメータ
 * @returns {any} 戻り値
 */
${match}`;
      }
    );

    return documentedCode;
  }

  /**
   * ドキュメントを保存
   */
  private async saveDocuments(documents: DocumentationWriterOutput['documents']): Promise<void> {
    for (const doc of documents) {
      const dir = path.dirname(doc.path);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(doc.path, doc.content, 'utf-8');
    }
  }
}
