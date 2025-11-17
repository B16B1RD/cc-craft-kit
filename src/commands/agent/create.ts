#!/usr/bin/env node
/**
 * サブエージェント作成コマンド
 *
 * 新しいサブエージェント定義ファイルを作成します。
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

async function main(): Promise<void> {
  const [name, ...descriptionParts] = process.argv.slice(2);

  if (!name || descriptionParts.length === 0) {
    console.error(chalk.red('Error: Missing required arguments'));
    console.log('\nUsage:');
    console.log('  /takumi:agent-create <name> <description>');
    console.log('\nExample:');
    console.log('  /takumi:agent-create my-agent "A helpful agent for specific tasks"');
    process.exit(1);
  }

  const description = descriptionParts.join(' ');

  // サブエージェント名のバリデーション
  if (!/^[a-z0-9-]+$/.test(name)) {
    console.error(
      chalk.red('Error: Subagent name must contain only lowercase letters, numbers, and hyphens')
    );
    process.exit(1);
  }

  try {
    console.log(chalk.bold('# Creating Subagent\n'));
    console.log(chalk.bold('Name:'), name);
    console.log(chalk.bold('Description:'), description);

    // プロジェクトルートの .claude/agents ディレクトリを確認
    const agentsDir = path.join(process.cwd(), '.claude', 'agents');
    await fs.mkdir(agentsDir, { recursive: true });

    const agentFilePath = path.join(agentsDir, `${name}.md`);

    // ファイルが既に存在するか確認
    try {
      await fs.access(agentFilePath);
      console.error(chalk.red(`\nError: Subagent "${name}" already exists at ${agentFilePath}`));
      process.exit(1);
    } catch {
      // ファイルが存在しない場合は続行
    }

    // サブエージェント定義テンプレート
    const template = `---
name: ${name}
description: ${description}
tools: Read, Grep, Glob, Edit, Write, Bash
model: sonnet
---

# ${name
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')} Agent

You are a specialized agent for ${description.toLowerCase()}.

## Your Responsibilities

1. **[Responsibility 1]**
   - [Detail 1]
   - [Detail 2]

2. **[Responsibility 2]**
   - [Detail 1]
   - [Detail 2]

## Guidelines

- [Guideline 1]
- [Guideline 2]
- [Guideline 3]

## Output Format

Provide your output in a clear, structured format:

\`\`\`markdown
# [Report Title]

## Summary
[Brief overview]

## Details
[Detailed information]

## Recommendations
[Actionable suggestions]
\`\`\`

## Examples

### Example 1: [Use Case]

[Description of how to use this agent]

### Example 2: [Use Case]

[Description of another use case]
`;

    // ファイルを作成
    await fs.writeFile(agentFilePath, template, 'utf-8');

    console.log(chalk.green('\n✓ Subagent created successfully!'));
    console.log(chalk.bold('\nFile:'), agentFilePath);
    console.log('\n' + chalk.bold('Next steps:'));
    console.log('  1. Edit the agent definition file to customize its behavior');
    console.log('  2. Specify the appropriate tools for your agent');
    console.log('  3. Define clear responsibilities and guidelines');
    console.log('  4. Test the agent by invoking it in your workflow');
    console.log('\n' + chalk.bold('List subagents:'));
    console.log('  /takumi:agent-list');
  } catch (error) {
    console.error(chalk.red('Error creating subagent:'), error);
    process.exit(1);
  }
}

main();
