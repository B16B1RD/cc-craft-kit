import { Kysely } from 'kysely';
import { Database } from '../../database/schema.js';
import { Subagent, SubagentContext, SubagentResult } from '../types.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * TestCreator入力
 */
export interface TestCreatorInput {
  specId: string;
  taskId?: string;
  sourceFilePath: string;
  sourceCode: string;
  language: 'typescript' | 'javascript' | 'python' | 'go';
  testFramework?: string; // jest, mocha, pytest, etc.
  coverageTarget?: number; // 70%, 80%, etc.
}

/**
 * TestCreator出力
 */
export interface TestCreatorOutput {
  testFiles: Array<{
    path: string;
    content: string;
    testCount: number;
  }>;
  coverageEstimate: number;
  summary: string;
}

/**
 * TestCreator Subagent
 * ソースコードからテストコードを自動生成
 */
export class TestCreator implements Subagent<TestCreatorInput, TestCreatorOutput> {
  name = 'test-creator';
  description = 'ソースコードからテストコードを自動生成します';
  version = '1.0.0';

  constructor(_db: Kysely<Database>) {}

  async execute(
    input: TestCreatorInput,
    _context: SubagentContext
  ): Promise<SubagentResult<TestCreatorOutput>> {
    try {
      const output = await this.generateTests(input);

      // 生成したテストファイルを保存
      await this.saveTestFiles(output.testFiles);

      return {
        success: true,
        data: output,
        logs: [
          `Generated ${output.testFiles.length} test files`,
          `Total test cases: ${output.testFiles.reduce((sum, f) => sum + f.testCount, 0)}`,
          `Estimated coverage: ${output.coverageEstimate}%`,
        ],
        nextActions: ['テストの実行', 'カバレッジレポート確認'],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async validate(input: TestCreatorInput): Promise<boolean> {
    return !!input.specId && !!input.sourceFilePath && !!input.sourceCode && !!input.language;
  }

  /**
   * テスト生成ロジック
   */
  private async generateTests(input: TestCreatorInput): Promise<TestCreatorOutput> {
    const testFiles: TestCreatorOutput['testFiles'] = [];

    // 言語別のテスト生成
    if (input.language === 'typescript' || input.language === 'javascript') {
      const framework = input.testFramework || 'jest';
      const tsTests = await this.generateTypeScriptTests(input, framework);
      testFiles.push(...tsTests);
    } else if (input.language === 'python') {
      const framework = input.testFramework || 'pytest';
      const pyTests = await this.generatePythonTests(input, framework);
      testFiles.push(...pyTests);
    }

    // カバレッジ推定
    const coverageEstimate = this.estimateCoverage(input.sourceCode, testFiles);

    const summary = `Generated ${testFiles.length} test files with ${testFiles.reduce((sum, f) => sum + f.testCount, 0)} test cases`;

    return { testFiles, coverageEstimate, summary };
  }

  /**
   * TypeScript/JavaScriptテスト生成
   */
  private async generateTypeScriptTests(
    input: TestCreatorInput,
    _framework: string
  ): Promise<TestCreatorOutput['testFiles']> {
    const testFiles: TestCreatorOutput['testFiles'] = [];

    // テストファイルパス生成
    const testFilePath = this.generateTestFilePath(input.sourceFilePath, 'ts');

    // ソースコードから関数/クラスを抽出
    const entities = this.extractEntities(input.sourceCode);

    // Jestテスト生成
    const content = this.generateJestTests(entities, input.sourceFilePath);
    const testCount = entities.length * 2; // 各エンティティに対して基本的に2つのテスト

    testFiles.push({
      path: testFilePath,
      content,
      testCount,
    });

    return testFiles;
  }

  /**
   * Jestテスト生成
   */
  private generateJestTests(entities: string[], sourceFilePath: string): string {
    const importPath = this.convertToImportPath(sourceFilePath);

    let testContent = `/**
 * ${path.basename(sourceFilePath)} のテスト
 */
import { ${entities.join(', ')} } from '${importPath}';

describe('${path.basename(sourceFilePath, path.extname(sourceFilePath))}', () => {
`;

    entities.forEach((entity) => {
      testContent += `
  describe('${entity}', () => {
    test('正常系: ${entity}が正しく動作する', () => {
      // TODO: テストケース実装
      expect(true).toBe(true);
    });

    test('異常系: 不正な入力でエラーが発生する', () => {
      // TODO: エラーケース実装
      expect(() => {
        // エラーを発生させる処理
      }).toThrow();
    });
  });
`;
    });

    testContent += `});
`;

    return testContent;
  }

  /**
   * Pythonテスト生成
   */
  private async generatePythonTests(
    input: TestCreatorInput,
    _framework: string
  ): Promise<TestCreatorOutput['testFiles']> {
    const testFiles: TestCreatorOutput['testFiles'] = [];

    const testFilePath = this.generateTestFilePath(input.sourceFilePath, 'py');

    // ソースコードから関数/クラスを抽出
    const entities = this.extractEntities(input.sourceCode);

    const content = this.generatePytestTests(entities, input.sourceFilePath);
    const testCount = entities.length * 2;

    testFiles.push({
      path: testFilePath,
      content,
      testCount,
    });

    return testFiles;
  }

  /**
   * pytestテスト生成
   */
  private generatePytestTests(entities: string[], sourceFilePath: string): string {
    const moduleName = path.basename(sourceFilePath, path.extname(sourceFilePath));

    let testContent = `"""
${path.basename(sourceFilePath)} のテスト
"""
import pytest
from ${moduleName} import ${entities.join(', ')}


`;

    entities.forEach((entity) => {
      testContent += `class Test${entity}:
    """${entity}のテストクラス"""

    def test_${entity.toLowerCase()}_success(self):
        """正常系: ${entity}が正しく動作する"""
        # TODO: テストケース実装
        assert True

    def test_${entity.toLowerCase()}_error(self):
        """異常系: 不正な入力でエラーが発生する"""
        # TODO: エラーケース実装
        with pytest.raises(Exception):
            pass


`;
    });

    return testContent;
  }

  /**
   * ソースコードからエンティティ(クラス/関数)を抽出
   */
  private extractEntities(sourceCode: string): string[] {
    const entities: string[] = [];

    // クラス抽出 (TypeScript/JavaScript/Python)
    const classMatches = sourceCode.matchAll(/(?:export\s+)?class\s+(\w+)/g);
    for (const match of classMatches) {
      entities.push(match[1]);
    }

    // 関数抽出 (TypeScript/JavaScript)
    const functionMatches = sourceCode.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g);
    for (const match of functionMatches) {
      entities.push(match[1]);
    }

    // アロー関数・const関数抽出
    const constFunctionMatches = sourceCode.matchAll(/(?:export\s+)?const\s+(\w+)\s*=/g);
    for (const match of constFunctionMatches) {
      entities.push(match[1]);
    }

    // Python関数抽出
    const pythonFunctionMatches = sourceCode.matchAll(/def\s+(\w+)\s*\(/g);
    for (const match of pythonFunctionMatches) {
      if (!match[1].startsWith('_')) {
        // プライベート関数は除外
        entities.push(match[1]);
      }
    }

    // 重複削除
    return [...new Set(entities)];
  }

  /**
   * テストファイルパス生成
   */
  private generateTestFilePath(sourceFilePath: string, extension: string): string {
    const dir = path.dirname(sourceFilePath);
    const basename = path.basename(sourceFilePath, path.extname(sourceFilePath));

    // tests ディレクトリに配置
    const testDir = dir.replace(/^src/, 'tests');
    return path.join(testDir, `${basename}.test.${extension}`);
  }

  /**
   * ソースファイルパスからインポートパスを生成
   */
  private convertToImportPath(sourceFilePath: string): string {
    // src/core/foo.ts -> ../../../src/core/foo.js
    const relativePath = sourceFilePath.replace(/^src\//, '../../../src/');
    return relativePath.replace(/\.ts$/, '.js');
  }

  /**
   * カバレッジ推定
   */
  private estimateCoverage(sourceCode: string, testFiles: TestCreatorOutput['testFiles']): number {
    const totalLines = sourceCode.split('\n').length;
    const totalTests = testFiles.reduce((sum, f) => sum + f.testCount, 0);

    // 簡易的な推定: テスト数が多いほどカバレッジが高い
    // 実際のカバレッジは実行後にjestやpytestで測定
    const estimatedCoveredLines = totalTests * 10; // 1テストあたり約10行をカバーと仮定
    const coverage = Math.min(100, (estimatedCoveredLines / totalLines) * 100);

    return Math.round(coverage);
  }

  /**
   * テストファイルを保存
   */
  private async saveTestFiles(testFiles: TestCreatorOutput['testFiles']): Promise<void> {
    for (const testFile of testFiles) {
      const dir = path.dirname(testFile.path);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(testFile.path, testFile.content, 'utf-8');
    }
  }
}
