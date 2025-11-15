import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

/**
 * プロジェクト初期化ツール
 */
const InitProjectSchema = z.object({
  projectName: z.string().describe('プロジェクト名'),
  description: z.string().optional().describe('プロジェクトの説明'),
  githubRepo: z.string().optional().describe('GitHubリポジトリ (owner/repo形式)'),
});

type InitProjectParams = z.infer<typeof InitProjectSchema>;

interface InitProjectResult {
  success: boolean;
  message: string;
  config: {
    name: string;
    description: string;
    githubRepo: string | null;
    createdAt: string;
    version: string;
  };
  paths: {
    projectDir: string;
    specsDir: string;
    configFile: string;
    database: string;
  };
}

export const initProjectTool: Tool & {
  handler: (params: InitProjectParams) => Promise<InitProjectResult>;
} = {
  name: 'takumi:init_project',
  description: 'Takumiプロジェクトを初期化します。.takumiディレクトリとデータベースを作成します。',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'プロジェクト名',
      },
      description: {
        type: 'string',
        description: 'プロジェクトの説明',
      },
      githubRepo: {
        type: 'string',
        description: 'GitHubリポジトリ (owner/repo形式)',
      },
    },
    required: ['projectName'],
  },

  async handler(params: InitProjectParams): Promise<InitProjectResult> {
    // バリデーション
    const validated = InitProjectSchema.parse(params);

    const projectDir = path.join(process.cwd(), '.takumi');

    // .takumiディレクトリ作成
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.join(projectDir, 'specs'), { recursive: true });

    // プロジェクト設定ファイル作成
    const config = {
      name: validated.projectName,
      description: validated.description || '',
      githubRepo: validated.githubRepo || null,
      createdAt: new Date().toISOString(),
      version: '0.1.0',
    };

    await fs.writeFile(path.join(projectDir, 'config.json'), JSON.stringify(config, null, 2));

    return {
      success: true,
      message: `プロジェクト "${validated.projectName}" を初期化しました`,
      config,
      paths: {
        projectDir,
        specsDir: path.join(projectDir, 'specs'),
        configFile: path.join(projectDir, 'config.json'),
        database: path.join(projectDir, 'takumi.db'),
      },
    };
  },
};
