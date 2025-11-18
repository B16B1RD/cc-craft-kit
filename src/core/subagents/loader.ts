/**
 * サブエージェント定義ファイルのローダー
 *
 * Claude Code形式のサブエージェント定義ファイル（Markdown + YAML frontmatter）を
 * 読み込んで、cc-craft-kitのサブエージェントレジストリに登録する機能を提供します。
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import yaml from 'yaml';
import { Subagent, SubagentContext, SubagentResult } from './types.js';
import { getSubagentRegistry } from './registry.js';

/**
 * Claude Code形式のサブエージェント定義
 */
export interface SubagentDefinition {
  name: string;
  description: string;
  tools?: string;
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  systemPrompt: string;
}

/**
 * YAML frontmatterをパースする
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error('Invalid frontmatter format');
  }

  const frontmatter = yaml.parse(match[1]) as Record<string, unknown>;
  const body = match[2].trim();

  return { frontmatter, body };
}

/**
 * サブエージェント定義ファイルを読み込む
 */
async function loadSubagentDefinition(filePath: string): Promise<SubagentDefinition> {
  const content = await fs.readFile(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);

  // 必須フィールドの検証
  if (!frontmatter.name || typeof frontmatter.name !== 'string') {
    throw new Error(`Missing required field "name" in ${filePath}`);
  }

  if (!frontmatter.description || typeof frontmatter.description !== 'string') {
    throw new Error(`Missing required field "description" in ${filePath}`);
  }

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    tools: frontmatter.tools as string | undefined,
    model: frontmatter.model as 'sonnet' | 'opus' | 'haiku' | 'inherit' | undefined,
    systemPrompt: body,
  };
}

/**
 * Claude Code形式のサブエージェントをcc-craft-kitのSubagentインターフェースに変換
 */
class SubagentAdapter implements Subagent {
  constructor(private definition: SubagentDefinition) {}

  get name(): string {
    return this.definition.name;
  }

  get description(): string {
    return this.definition.description;
  }

  get version(): string {
    return '1.0.0'; // Claude Code形式のサブエージェントにはバージョンがないため固定値
  }

  async execute(_input: unknown, _context: SubagentContext): Promise<SubagentResult> {
    // TODO: 実際のサブエージェント実行ロジックを実装
    // Task toolを使用してサブエージェントを起動する
    throw new Error('Subagent execution not yet implemented');
  }

  async validate(_input: unknown): Promise<boolean> {
    // Claude Code形式のサブエージェントには入力バリデーションがないため、常にtrueを返す
    return true;
  }
}

/**
 * ディレクトリ内のサブエージェント定義ファイルをすべて読み込む
 */
async function loadSubagentsFromDirectory(dirPath: string): Promise<SubagentDefinition[]> {
  try {
    const files = await fs.readdir(dirPath);
    const subagentFiles = files.filter((file) => file.endsWith('.md'));

    const definitions: SubagentDefinition[] = [];

    for (const file of subagentFiles) {
      const filePath = path.join(dirPath, file);
      try {
        const definition = await loadSubagentDefinition(filePath);
        definitions.push(definition);
      } catch (error) {
        console.warn(`Failed to load subagent from ${filePath}:`, error);
      }
    }

    return definitions;
  } catch (error) {
    // ディレクトリが存在しない場合は空配列を返す
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any)?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * プロジェクトレベルとユーザーレベルのサブエージェントを読み込む
 *
 * 優先順位: プロジェクトレベル > ユーザーレベル
 */
export async function loadSubagents(projectRoot?: string): Promise<void> {
  const registry = getSubagentRegistry();

  // ユーザーレベルのサブエージェントを読み込む
  const userAgentsDir = path.join(os.homedir(), '.claude', 'agents');
  const userDefinitions = await loadSubagentsFromDirectory(userAgentsDir);

  // プロジェクトレベルのサブエージェントを読み込む
  const projectAgentsDir = projectRoot
    ? path.join(projectRoot, '.claude', 'agents')
    : path.join(process.cwd(), '.claude', 'agents');
  const projectDefinitions = await loadSubagentsFromDirectory(projectAgentsDir);

  // ユーザーレベルのサブエージェントを登録
  for (const definition of userDefinitions) {
    try {
      registry.register(new SubagentAdapter(definition));
    } catch (error) {
      console.warn(`Failed to register user subagent "${definition.name}":`, error);
    }
  }

  // プロジェクトレベルのサブエージェントを登録（上書き）
  for (const definition of projectDefinitions) {
    // プロジェクトレベルのサブエージェントが既に登録されている場合は上書き
    if (registry.has(definition.name)) {
      registry.unregister(definition.name);
    }

    try {
      registry.register(new SubagentAdapter(definition));
    } catch (error) {
      console.warn(`Failed to register project subagent "${definition.name}":`, error);
    }
  }
}

/**
 * サブエージェント定義を取得する
 */
export async function getSubagentDefinition(
  name: string,
  projectRoot?: string
): Promise<SubagentDefinition | undefined> {
  // プロジェクトレベルを優先的に確認
  const projectAgentsDir = projectRoot
    ? path.join(projectRoot, '.claude', 'agents')
    : path.join(process.cwd(), '.claude', 'agents');
  const projectFilePath = path.join(projectAgentsDir, `${name}.md`);

  try {
    const definition = await loadSubagentDefinition(projectFilePath);
    return definition;
  } catch {
    // プロジェクトレベルに存在しない場合はユーザーレベルを確認
  }

  // ユーザーレベルを確認
  const userAgentsDir = path.join(os.homedir(), '.claude', 'agents');
  const userFilePath = path.join(userAgentsDir, `${name}.md`);

  try {
    const definition = await loadSubagentDefinition(userFilePath);
    return definition;
  } catch {
    return undefined;
  }
}
