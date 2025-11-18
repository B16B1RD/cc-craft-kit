/**
 * スキル定義ファイルのローダー
 *
 * Claude Code形式のスキル定義ファイル（SKILL.md + YAML frontmatter）を
 * 読み込んで、cc-craft-kitのスキルレジストリに登録する機能を提供します。
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import yaml from 'yaml';
import { Skill, SkillCategory, SkillContext, SkillResult } from './types.js';
import { getSkillRegistry } from './registry.js';

/**
 * Claude Code形式のスキル定義
 */
export interface SkillDefinition {
  name: string;
  description: string;
  content: string;
  supportFiles: string[];
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
 * スキル定義ファイルを読み込む
 */
async function loadSkillDefinition(skillDir: string): Promise<SkillDefinition> {
  const skillFilePath = path.join(skillDir, 'SKILL.md');
  const content = await fs.readFile(skillFilePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);

  // 必須フィールドの検証
  if (!frontmatter.name || typeof frontmatter.name !== 'string') {
    throw new Error(`Missing required field "name" in ${skillFilePath}`);
  }

  if (!frontmatter.description || typeof frontmatter.description !== 'string') {
    throw new Error(`Missing required field "description" in ${skillFilePath}`);
  }

  // スキル名のバリデーション（小文字英数字とハイフンのみ、最大64文字）
  if (!/^[a-z0-9-]{1,64}$/.test(frontmatter.name)) {
    throw new Error(
      `Invalid skill name "${frontmatter.name}": must be lowercase alphanumeric with hyphens only, max 64 characters`
    );
  }

  // 説明の長さバリデーション（最大1024文字）
  if (frontmatter.description.length > 1024) {
    throw new Error(
      `Invalid skill description for "${frontmatter.name}": max 1024 characters, got ${frontmatter.description.length}`
    );
  }

  // サポートファイルの一覧を取得
  const supportFiles: string[] = [];
  try {
    const files = await fs.readdir(skillDir);
    for (const file of files) {
      if (file !== 'SKILL.md') {
        const filePath = path.join(skillDir, file);
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          supportFiles.push(file);
        }
      }
    }
  } catch {
    // サポートファイルが存在しない場合はスキップ
  }

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    content: body,
    supportFiles,
  };
}

/**
 * スキルのカテゴリを推定する
 * 説明文からキーワードを抽出してカテゴリを決定
 */
function inferCategory(description: string): SkillCategory {
  const lowerDesc = description.toLowerCase();

  if (lowerDesc.includes('requirement') || lowerDesc.includes('要件')) {
    return 'requirements';
  }
  if (
    lowerDesc.includes('design') ||
    lowerDesc.includes('設計') ||
    lowerDesc.includes('architecture')
  ) {
    return 'design';
  }
  if (lowerDesc.includes('test') || lowerDesc.includes('テスト')) {
    return 'testing';
  }
  if (lowerDesc.includes('document') || lowerDesc.includes('ドキュメント')) {
    return 'documentation';
  }
  if (lowerDesc.includes('analy') || lowerDesc.includes('分析')) {
    return 'analysis';
  }
  if (lowerDesc.includes('integration') || lowerDesc.includes('統合')) {
    return 'integration';
  }

  // デフォルトは implementation
  return 'implementation';
}

/**
 * Claude Code形式のスキルをcc-craft-kitのSkillインターフェースに変換
 */
class SkillAdapter implements Skill {
  private definition: SkillDefinition;
  public readonly category: SkillCategory;

  constructor(definition: SkillDefinition) {
    this.definition = definition;
    this.category = inferCategory(definition.description);
  }

  get name(): string {
    return this.definition.name;
  }

  get description(): string {
    return this.definition.description;
  }

  get version(): string {
    return '1.0.0'; // Claude Code形式のスキルにはバージョンがないため固定値
  }

  async execute(_input: unknown, _context: SkillContext): Promise<SkillResult> {
    // TODO: 実際のスキル実行ロジックを実装
    // Skill toolを使用してスキルを実行する
    throw new Error('Skill execution not yet implemented');
  }

  async validate(_input: unknown): Promise<boolean> {
    // Claude Code形式のスキルには入力バリデーションがないため、常にtrueを返す
    return true;
  }

  getSummary(): string {
    // SKILL.mdの内容の最初の200文字を要約として返す
    return (
      this.definition.content.slice(0, 200) + (this.definition.content.length > 200 ? '...' : '')
    );
  }
}

/**
 * ディレクトリ内のスキル定義ファイルをすべて読み込む
 */
async function loadSkillsFromDirectory(dirPath: string): Promise<SkillDefinition[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const skillDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    const definitions: SkillDefinition[] = [];

    for (const dir of skillDirs) {
      const skillDir = path.join(dirPath, dir);
      try {
        const definition = await loadSkillDefinition(skillDir);
        definitions.push(definition);
      } catch (error) {
        console.warn(`Failed to load skill from ${skillDir}:`, error);
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
 * プロジェクトレベルとユーザーレベルのスキルを読み込む
 *
 * 優先順位: プロジェクトレベル > ユーザーレベル
 */
export async function loadSkills(projectRoot?: string): Promise<void> {
  const registry = getSkillRegistry();

  // ユーザーレベルのスキルを読み込む
  const userSkillsDir = path.join(os.homedir(), '.claude', 'skills');
  const userDefinitions = await loadSkillsFromDirectory(userSkillsDir);

  // プロジェクトレベルのスキルを読み込む
  const projectSkillsDir = projectRoot
    ? path.join(projectRoot, '.claude', 'skills')
    : path.join(process.cwd(), '.claude', 'skills');
  const projectDefinitions = await loadSkillsFromDirectory(projectSkillsDir);

  // ユーザーレベルのスキルを登録
  for (const definition of userDefinitions) {
    try {
      registry.register(new SkillAdapter(definition));
    } catch (error) {
      console.warn(`Failed to register user skill "${definition.name}":`, error);
    }
  }

  // プロジェクトレベルのスキルを登録（上書き）
  for (const definition of projectDefinitions) {
    // プロジェクトレベルのスキルが既に登録されている場合は上書き
    if (registry.has(definition.name)) {
      registry.unregister(definition.name);
    }

    try {
      registry.register(new SkillAdapter(definition));
    } catch (error) {
      console.warn(`Failed to register project skill "${definition.name}":`, error);
    }
  }
}

/**
 * スキル定義を取得する
 */
export async function getSkillDefinition(
  name: string,
  projectRoot?: string
): Promise<SkillDefinition | undefined> {
  // プロジェクトレベルを優先的に確認
  const projectSkillsDir = projectRoot
    ? path.join(projectRoot, '.claude', 'skills')
    : path.join(process.cwd(), '.claude', 'skills');
  const projectSkillDir = path.join(projectSkillsDir, name);

  try {
    const definition = await loadSkillDefinition(projectSkillDir);
    return definition;
  } catch {
    // プロジェクトレベルに存在しない場合はユーザーレベルを確認
  }

  // ユーザーレベルを確認
  const userSkillsDir = path.join(os.homedir(), '.claude', 'skills');
  const userSkillDir = path.join(userSkillsDir, name);

  try {
    const definition = await loadSkillDefinition(userSkillDir);
    return definition;
  } catch {
    return undefined;
  }
}
