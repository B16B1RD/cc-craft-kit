#!/usr/bin/env node
import 'reflect-metadata';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { getDatabase, closeDatabase } from '../core/database/connection.js';
import { migrateToLatest } from '../core/database/migrator.js';
import { initProjectTool } from './tools/init-project.js';
import { createSpecTool } from './tools/create-spec.js';
import { listSpecsTool } from './tools/list-specs.js';
import { getSpecTool } from './tools/get-spec.js';
import { initGitHubTool, createGitHubIssueTool } from './tools/github-init.js';
import {
  syncSpecToGitHubTool,
  syncGitHubToSpecTool,
  addSpecToProjectTool,
} from './tools/github-sync-spec.js';
import {
  recordProgressTool,
  recordErrorSolutionTool,
  recordTipTool,
} from './tools/github-knowledge.js';

/**
 * Takumi MCPサーバー
 */
class TakumiMCPServer {
  private server: Server;
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: 'takumi',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerTools();
    this.setupHandlers();
  }

  /**
   * ツール登録
   */
  private registerTools(): void {
    const tools = [
      initProjectTool,
      createSpecTool,
      listSpecsTool,
      getSpecTool,
      // GitHub統合ツール
      initGitHubTool,
      createGitHubIssueTool,
      syncSpecToGitHubTool,
      syncGitHubToSpecTool,
      addSpecToProjectTool,
      // ナレッジベースツール
      recordProgressTool,
      recordErrorSolutionTool,
      recordTipTool,
    ];

    tools.forEach((tool) => {
      this.tools.set(tool.name, tool);
    });
  }

  /**
   * ハンドラーセットアップ
   */
  private setupHandlers(): void {
    // ツール一覧
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Array.from(this.tools.values()),
    }));

    // ツール実行
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tool = this.tools.get(request.params.name);

      if (!tool) {
        throw new Error(`Unknown tool: ${request.params.name}`);
      }

      // ツールハンドラー実行
      const handler = (tool as { handler?: (args: unknown) => Promise<unknown> }).handler;
      if (!handler) {
        throw new Error(`Tool ${request.params.name} has no handler`);
      }

      try {
        const result = await handler(request.params.arguments);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: errorMessage,
                  tool: request.params.name,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * サーバー起動
   */
  async start(): Promise<void> {
    // データベース初期化
    const db = getDatabase();
    await migrateToLatest(db);

    // Studioトランスポートで起動
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('Takumi MCP Server started');
  }

  /**
   * グレースフルシャットダウン
   */
  async stop(): Promise<void> {
    await closeDatabase();
    await this.server.close();
    console.error('Takumi MCP Server stopped');
  }
}

/**
 * メイン
 */
async function main() {
  const server = new TakumiMCPServer();

  // シグナルハンドラー
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });

  try {
    await server.start();
  } catch (error) {
    console.error('Server error:', error);
    process.exit(1);
  }
}

main();
