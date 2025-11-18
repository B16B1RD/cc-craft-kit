import { Kysely } from 'kysely';
import { Database } from '../../database/schema.js';
import { Subagent, SubagentContext, SubagentResult } from '../types.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * CodeGenerator入力
 */
export interface CodeGeneratorInput {
  specId: string;
  taskId: string;
  taskDescription: string;
  architecture?: {
    pattern: string;
    targetComponent: string;
  };
  language: 'typescript' | 'javascript' | 'python' | 'go';
  outputDirectory: string;
}

/**
 * CodeGenerator出力
 */
export interface CodeGeneratorOutput {
  generatedFiles: Array<{
    path: string;
    content: string;
    type: 'source' | 'test' | 'config';
  }>;
  imports: string[];
  summary: string;
}

/**
 * CodeGenerator Subagent
 * タスクから実装コードを生成
 */
export class CodeGenerator implements Subagent<CodeGeneratorInput, CodeGeneratorOutput> {
  name = 'code-generator';
  description = 'タスクから実装コードを自動生成します';
  version = '1.0.0';

  constructor(private db: Kysely<Database>) {}

  async execute(
    input: CodeGeneratorInput,
    _context: SubagentContext
  ): Promise<SubagentResult<CodeGeneratorOutput>> {
    try {
      const output = await this.generateCode(input);

      // 生成したファイルを保存
      await this.saveGeneratedFiles(output.generatedFiles);

      // タスクのステータスを更新
      await this.db
        .updateTable('tasks')
        .set({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .where('id', '=', input.taskId)
        .execute();

      return {
        success: true,
        data: output,
        logs: [
          `Generated ${output.generatedFiles.length} files`,
          `Language: ${input.language}`,
          `Output: ${input.outputDirectory}`,
        ],
        nextActions: ['進行: テスト作成フェーズへ移行', 'コードレビューの実施'],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async validate(input: CodeGeneratorInput): Promise<boolean> {
    return (
      !!input.specId &&
      !!input.taskId &&
      !!input.taskDescription &&
      !!input.language &&
      !!input.outputDirectory
    );
  }

  /**
   * コード生成ロジック
   */
  private async generateCode(input: CodeGeneratorInput): Promise<CodeGeneratorOutput> {
    const generatedFiles: CodeGeneratorOutput['generatedFiles'] = [];
    const imports: string[] = [];

    // 言語別のコード生成
    if (input.language === 'typescript') {
      const tsFiles = await this.generateTypeScriptCode(input);
      generatedFiles.push(...tsFiles.files);
      imports.push(...tsFiles.imports);
    } else if (input.language === 'python') {
      const pyFiles = await this.generatePythonCode(input);
      generatedFiles.push(...pyFiles.files);
      imports.push(...pyFiles.imports);
    }

    const summary = `Generated ${generatedFiles.length} files for ${input.taskDescription}`;

    return { generatedFiles, imports, summary };
  }

  /**
   * TypeScriptコード生成
   */
  private async generateTypeScriptCode(input: CodeGeneratorInput): Promise<{
    files: CodeGeneratorOutput['generatedFiles'];
    imports: string[];
  }> {
    const files: CodeGeneratorOutput['generatedFiles'] = [];
    const imports: string[] = [];

    // タスク名からファイル名を生成
    const fileName = this.generateFileName(input.taskDescription, 'ts');
    const filePath = path.join(input.outputDirectory, fileName);

    // コンポーネントタイプに応じたコード生成
    const componentType = input.architecture?.targetComponent || 'service';

    let content = '';
    if (componentType.includes('Controller') || componentType.includes('controller')) {
      content = this.generateTypeScriptController(input.taskDescription);
      imports.push('express');
    } else if (componentType.includes('Service') || componentType.includes('service')) {
      content = this.generateTypeScriptService(input.taskDescription);
    } else if (componentType.includes('Repository') || componentType.includes('repository')) {
      content = this.generateTypeScriptRepository(input.taskDescription);
      imports.push('kysely');
    } else {
      content = this.generateTypeScriptUtility(input.taskDescription);
    }

    files.push({
      path: filePath,
      content,
      type: 'source',
    });

    return { files, imports };
  }

  /**
   * TypeScript Controllerコード生成
   */
  private generateTypeScriptController(taskDescription: string): string {
    const className = this.extractClassName(taskDescription) + 'Controller';

    return `import { Request, Response, NextFunction } from 'express';

/**
 * ${taskDescription}
 */
export class ${className} {
  /**
   * ${taskDescription}の処理
   */
  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // TODO: ビジネスロジック実装
      const result = await this.processRequest(req.body);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * リクエスト処理
   */
  private async processRequest(data: any): Promise<any> {
    // TODO: 実装
    return { message: 'Not implemented yet' };
  }
}
`;
  }

  /**
   * TypeScript Serviceコード生成
   */
  private generateTypeScriptService(taskDescription: string): string {
    const className = this.extractClassName(taskDescription) + 'Service';

    return `/**
 * ${taskDescription}
 */
export class ${className} {
  /**
   * メイン処理
   */
  async execute(input: any): Promise<any> {
    // TODO: ビジネスロジック実装

    // 入力バリデーション
    this.validate(input);

    // 処理実行
    const result = await this.process(input);

    return result;
  }

  /**
   * 入力バリデーション
   */
  private validate(input: any): void {
    if (!input) {
      throw new Error('Input is required');
    }
  }

  /**
   * 処理実行
   */
  private async process(input: any): Promise<any> {
    // TODO: 実装
    return { success: true };
  }
}
`;
  }

  /**
   * TypeScript Repositoryコード生成
   */
  private generateTypeScriptRepository(taskDescription: string): string {
    const className = this.extractClassName(taskDescription) + 'Repository';

    return `import { Kysely } from 'kysely';
import { Database } from '../database/schema.js';

/**
 * ${taskDescription}
 */
export class ${className} {
  constructor(private db: Kysely<Database>) {}

  /**
   * データ取得
   */
  async findById(id: string): Promise<any | null> {
    // TODO: テーブル名を修正
    return this.db
      .selectFrom('table_name')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();
  }

  /**
   * データ作成
   */
  async create(data: any): Promise<any> {
    // TODO: テーブル名とカラムを修正
    return this.db
      .insertInto('table_name')
      .values(data)
      .returningAll()
      .executeTakeFirst();
  }

  /**
   * データ更新
   */
  async update(id: string, data: any): Promise<any> {
    // TODO: テーブル名とカラムを修正
    return this.db
      .updateTable('table_name')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
  }

  /**
   * データ削除
   */
  async delete(id: string): Promise<void> {
    // TODO: テーブル名を修正
    await this.db
      .deleteFrom('table_name')
      .where('id', '=', id)
      .execute();
  }
}
`;
  }

  /**
   * TypeScript Utilityコード生成
   */
  private generateTypeScriptUtility(taskDescription: string): string {
    const functionName = this.extractFunctionName(taskDescription);

    return `/**
 * ${taskDescription}
 */
export function ${functionName}(input: any): any {
  // TODO: 実装
  return input;
}

/**
 * ${taskDescription}のバリデーション
 */
export function validate${functionName.charAt(0).toUpperCase() + functionName.slice(1)}(input: any): boolean {
  // TODO: バリデーションロジック
  return !!input;
}
`;
  }

  /**
   * Pythonコード生成
   */
  private async generatePythonCode(input: CodeGeneratorInput): Promise<{
    files: CodeGeneratorOutput['generatedFiles'];
    imports: string[];
  }> {
    const files: CodeGeneratorOutput['generatedFiles'] = [];
    const imports: string[] = [];

    const fileName = this.generateFileName(input.taskDescription, 'py');
    const filePath = path.join(input.outputDirectory, fileName);

    const className = this.extractClassName(input.taskDescription);
    const content = `"""
${input.taskDescription}
"""

class ${className}:
    """${input.taskDescription}のクラス"""

    def __init__(self):
        pass

    def execute(self, input_data: dict) -> dict:
        """メイン処理

        Args:
            input_data: 入力データ

        Returns:
            処理結果
        """
        # TODO: 実装
        return {"success": True}

    def validate(self, input_data: dict) -> bool:
        """入力バリデーション

        Args:
            input_data: 入力データ

        Returns:
            バリデーション結果
        """
        # TODO: 実装
        return input_data is not None
`;

    files.push({
      path: filePath,
      content,
      type: 'source',
    });

    return { files, imports };
  }

  /**
   * ファイル名生成
   */
  private generateFileName(taskDescription: string, extension: string): string {
    const name = taskDescription
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    return `${name}.${extension}`;
  }

  /**
   * クラス名抽出
   */
  private extractClassName(taskDescription: string): string {
    // タスク説明から最初の単語を抽出してPascalCaseに変換
    const words = taskDescription.split(/\s+/).slice(0, 3);
    return words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
      .replace(/[^\w]/g, '');
  }

  /**
   * 関数名抽出
   */
  private extractFunctionName(taskDescription: string): string {
    // タスク説明から最初の単語を抽出してcamelCaseに変換
    const words = taskDescription.split(/\s+/).slice(0, 3);
    return words
      .map((word, i) =>
        i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('')
      .replace(/[^\w]/g, '');
  }

  /**
   * 生成したファイルを保存
   */
  private async saveGeneratedFiles(files: CodeGeneratorOutput['generatedFiles']): Promise<void> {
    for (const file of files) {
      const dir = path.dirname(file.path);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file.path, file.content, 'utf-8');
    }
  }
}
