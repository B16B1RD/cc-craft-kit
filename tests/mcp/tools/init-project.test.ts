/**
 * init-project MCPツールテスト
 */
import { initProjectTool } from '../../../src/mcp/tools/init-project.js';
import fs from 'fs/promises';
import path from 'path';

describe('initProjectTool', () => {
  const testProjectName = 'test-project';
  const testProjectDir = path.join(process.cwd(), '.cc-craft-kit');
  const testConfigFile = path.join(testProjectDir, 'config.json');

  afterEach(async () => {
    // テスト後のクリーンアップ
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      // ディレクトリが存在しない場合は無視
    }
  });

  test('プロジェクトが正常に初期化される', async () => {
    const result = await initProjectTool.handler({
      projectName: testProjectName,
      description: 'テストプロジェクト',
    });

    expect(result.success).toBe(true);
    expect(result.config.name).toBe(testProjectName);
    expect(result.config.description).toBe('テストプロジェクト');

    // ディレクトリが作成されていることを確認
    const dirExists = await fs
      .access(testProjectDir)
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(true);

    // 設定ファイルが作成されていることを確認
    const configExists = await fs
      .access(testConfigFile)
      .then(() => true)
      .catch(() => false);
    expect(configExists).toBe(true);

    // 設定ファイルの内容を確認
    const configContent = await fs.readFile(testConfigFile, 'utf-8');
    const config = JSON.parse(configContent);
    expect(config.name).toBe(testProjectName);
  });

  test('GitHubリポジトリ情報が保存される', async () => {
    const result = await initProjectTool.handler({
      projectName: testProjectName,
      githubRepo: 'username/repo',
    });

    expect(result.config.githubRepo).toBe('username/repo');

    const configContent = await fs.readFile(testConfigFile, 'utf-8');
    const config = JSON.parse(configContent);
    expect(config.githubRepo).toBe('username/repo');
  });

  test('必須パラメータが欠けている場合はエラーになる', async () => {
    await expect(
      initProjectTool.handler({} as any)
    ).rejects.toThrow();
  });
});
