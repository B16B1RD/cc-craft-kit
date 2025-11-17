#!/usr/bin/env node
/**
 * スキル作成コマンド
 *
 * 新しいスキル定義ファイルを作成します。
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

async function main(): Promise<void> {
  const [name, ...descriptionParts] = process.argv.slice(2);

  if (!name || descriptionParts.length === 0) {
    console.error(chalk.red('Error: Missing required arguments'));
    console.log('\nUsage:');
    console.log('  /takumi:skill-create <name> <description>');
    console.log('\nExample:');
    console.log(
      '  /takumi:skill-create api-documentation "Generates comprehensive API documentation from code"'
    );
    process.exit(1);
  }

  const description = descriptionParts.join(' ');

  // スキル名のバリデーション（小文字英数字とハイフンのみ、最大64文字）
  if (!/^[a-z0-9-]{1,64}$/.test(name)) {
    console.error(
      chalk.red(
        'Error: Skill name must contain only lowercase letters, numbers, and hyphens (max 64 characters)'
      )
    );
    process.exit(1);
  }

  // 説明の長さバリデーション（最大1024文字）
  if (description.length > 1024) {
    console.error(chalk.red('Error: Description must be at most 1024 characters'));
    process.exit(1);
  }

  try {
    console.log(chalk.bold('# Creating Skill\n'));
    console.log(chalk.bold('Name:'), name);
    console.log(chalk.bold('Description:'), description);

    // プロジェクトルートの .claude/skills ディレクトリを確認
    const skillsDir = path.join(process.cwd(), '.claude', 'skills', name);
    await fs.mkdir(skillsDir, { recursive: true });

    const skillFilePath = path.join(skillsDir, 'SKILL.md');

    // ファイルが既に存在するか確認
    try {
      await fs.access(skillFilePath);
      console.error(chalk.red(`\nError: Skill "${name}" already exists at ${skillFilePath}`));
      process.exit(1);
    } catch {
      // ファイルが存在しない場合は続行
    }

    // スキル定義テンプレート
    const displayName = name
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const template = `---
name: ${name}
description: ${description}
---

# ${displayName} Skill

This skill provides ${description.toLowerCase()}.

## Capabilities

- [Capability 1]
- [Capability 2]
- [Capability 3]

## Usage Examples

### Example 1: [Use Case]

\`\`\`bash
# Command to demonstrate usage
\`\`\`

**Expected output:**
\`\`\`
[Example output]
\`\`\`

### Example 2: [Another Use Case]

\`\`\`bash
# Another command example
\`\`\`

## Common Patterns

### Pattern 1: [Pattern Name]

Description of the pattern and when to use it.

\`\`\`typescript
// Code example
\`\`\`

### Pattern 2: [Pattern Name]

Description of another pattern.

\`\`\`typescript
// Code example
\`\`\`

## Best Practices

- [Best practice 1]
- [Best practice 2]
- [Best practice 3]

## Output Format

When using this skill, provide results in the following format:

\`\`\`markdown
# [Result Title]

## Summary
[Brief overview]

## Details
[Detailed information]

## Recommendations
[Suggestions]
\`\`\`

## Troubleshooting

### Common Issue 1

**Problem:** [Description]

**Solution:**
\`\`\`bash
# Fix command
\`\`\`

### Common Issue 2

**Problem:** [Description]

**Solution:**
\`\`\`bash
# Fix command
\`\`\`
`;

    // ファイルを作成
    await fs.writeFile(skillFilePath, template, 'utf-8');

    console.log(chalk.green('\n✓ Skill created successfully!'));
    console.log(chalk.bold('\nFile:'), skillFilePath);
    console.log('\n' + chalk.bold('Next steps:'));
    console.log('  1. Edit the SKILL.md file to customize the skill');
    console.log('  2. Add detailed capabilities and usage examples');
    console.log('  3. Create additional support files if needed:');
    console.log(`     - ${skillsDir}/reference.md (detailed reference)`);
    console.log(`     - ${skillsDir}/examples.md (usage examples)`);
    console.log(`     - ${skillsDir}/templates/ (template files)`);
    console.log('  4. Test the skill by using it in your workflow');
    console.log('\n' + chalk.bold('List skills:'));
    console.log('  /takumi:skill-list');
  } catch (error) {
    console.error(chalk.red('Error creating skill:'), error);
    process.exit(1);
  }
}

main();
