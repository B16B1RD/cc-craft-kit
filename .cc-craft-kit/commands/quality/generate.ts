/**
 * サブエージェント・スキル生成コマンド
 */

import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { getTemplateEngine } from '../../core/templates/engine.js';
import type { SubagentTemplateVars, SkillTemplateVars } from '../../core/templates/engine.js';
import {
  formatSuccess,
  formatHeading,
  formatInfo,
  formatWarning,
  formatError,
} from '../utils/output.js';
import { handleCLIError } from '../utils/error-handler.js';

type GenerationType = 'subagent' | 'skill';

/**
 * サブエージェント・スキル生成
 */
export async function generateQualityArtifact(
  type: GenerationType,
  name: string,
  options: { color: boolean; force?: boolean }
): Promise<void> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const templatesDir = join(ccCraftKitDir, 'quality-templates');

  console.log(
    formatHeading(`Generating ${type === 'subagent' ? 'Subagent' : 'Skill'}`, 1, options.color)
  );
  console.log('');

  // .cc-craft-kit/ ディレクトリ存在チェック
  if (!existsSync(ccCraftKitDir)) {
    throw new Error('cc-craft-kit is not initialized. Run /cft:init first.');
  }

  // テンプレートディレクトリ存在チェック
  if (!existsSync(templatesDir)) {
    throw new Error(
      'Quality templates directory not found. Ensure .cc-craft-kit/quality-templates/ exists.'
    );
  }

  // テンプレート名から custom- プレフィックスを付与
  const customName = name.startsWith('custom-') ? name : `custom-${name}`;

  // 出力先パスを決定
  let outputPath: string;
  let templateName: string;

  if (type === 'subagent') {
    outputPath = join(cwd, '.claude', 'agents', `${customName}.md`);
    templateName = 'security-auditor'; // デフォルトテンプレート
  } else {
    const skillDir = join(cwd, '.claude', 'skills', customName);
    outputPath = join(skillDir, 'SKILL.md');
    templateName = 'api-doc-generator'; // デフォルトテンプレート
  }

  // 既存ファイルチェック
  if (existsSync(outputPath) && !options.force) {
    console.log(
      formatWarning(`${type === 'subagent' ? 'Subagent' : 'Skill'} already exists.`, options.color)
    );
    console.log(formatInfo(`Path: ${outputPath}`, options.color));
    console.log('');
    console.log('Use --force to overwrite.');
    return;
  }

  // 既存のサブエージェント・スキル名との衝突チェック
  await checkNamingConflict(type, customName, options.color);

  // テンプレートレンダリング
  console.log(formatInfo(`Rendering template: ${templateName}...`, options.color));

  const engine = getTemplateEngine(
    join(templatesDir, type === 'subagent' ? 'subagents' : 'skills')
  );

  let content: string;

  if (type === 'subagent') {
    const vars: SubagentTemplateVars = {
      name: customName,
      description: `Custom subagent for ${name}`,
      tools: ['Read', 'Grep', 'Bash'],
      model: 'sonnet',
      responsibilities: [
        'Analyze code for specific quality requirements',
        'Generate detailed reports',
        'Suggest improvements',
      ],
      outputFormat: 'Markdown report with findings and recommendations',
    };

    content = await engine.renderSubagent(templateName, vars);
  } else {
    const vars: SkillTemplateVars = {
      name: customName,
      description: `Custom skill for ${name}`,
      capabilities: [
        'Perform specialized quality checks',
        'Generate documentation',
        'Automate quality assurance processes',
      ],
      usageExamples: [
        `Use this skill when you need to ${name}`,
        'Execute the quality check process',
      ],
    };

    content = await engine.renderSkill(`${templateName}-SKILL`, vars);
  }

  // 出力ディレクトリ作成
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // ファイル書き込み
  writeFileSync(outputPath, content, 'utf-8');

  console.log('');
  console.log(
    formatSuccess(
      `${type === 'subagent' ? 'Subagent' : 'Skill'} generated successfully!`,
      options.color
    )
  );
  console.log('');
  console.log(formatInfo(`File: ${outputPath}`, options.color));
  console.log('');
  console.log('Next steps:');
  console.log('  1. Edit the generated file to customize');
  console.log(
    '  2. Test the ' + (type === 'subagent' ? 'subagent' : 'skill') + ' with Task/Skill tool'
  );
  console.log('');
}

/**
 * 既存のサブエージェント・スキル名との衝突チェック
 */
async function checkNamingConflict(
  type: GenerationType,
  name: string,
  color: boolean
): Promise<void> {
  const cwd = process.cwd();

  if (type === 'subagent') {
    const agentsDir = join(cwd, '.claude', 'agents');
    if (existsSync(agentsDir)) {
      const agents = readdirSync(agentsDir)
        .filter((file) => file.endsWith('.md'))
        .map((file) => file.replace('.md', ''));

      if (agents.includes(name)) {
        console.log(formatWarning(`Subagent name '${name}' conflicts with existing agent.`, color));
        console.log('');
      }
    }
  } else {
    const skillsDir = join(cwd, '.claude', 'skills');
    if (existsSync(skillsDir)) {
      const skills = readdirSync(skillsDir);

      if (skills.includes(name)) {
        console.log(formatWarning(`Skill name '${name}' conflicts with existing skill.`, color));
        console.log('');
      }
    }
  }
}

// CLI エントリーポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const filteredArgs = args.filter((arg) => arg !== '--force');

  if (filteredArgs.length < 2) {
    console.error(formatError('Usage: quality-generate <type> <name> [--force]', true));
    console.error('');
    console.error('Arguments:');
    console.error('  type: subagent | skill');
    console.error('  name: Name of the subagent or skill');
    console.error('');
    console.error('Options:');
    console.error('  --force: Overwrite existing file');
    process.exit(1);
  }

  const [type, name] = filteredArgs;

  if (type !== 'subagent' && type !== 'skill') {
    console.error(formatError('Invalid type. Use "subagent" or "skill".', true));
    process.exit(1);
  }

  generateQualityArtifact(type as GenerationType, name, {
    color: true,
    force,
  }).catch((error) => {
    handleCLIError(error);
    process.exit(1);
  });
}
