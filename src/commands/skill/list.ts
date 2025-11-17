#!/usr/bin/env node
/**
 * スキル一覧コマンド
 *
 * 登録されているスキルの一覧を表示します。
 */

import { loadSkills } from '../../core/skills/loader.js';
import { getSkillRegistry } from '../../core/skills/registry.js';
import chalk from 'chalk';

async function main(): Promise<void> {
  try {
    console.log(chalk.bold('# Skills\n'));

    // スキルを読み込む
    await loadSkills();

    // レジストリから一覧を取得
    const registry = getSkillRegistry();
    const skills = registry.list();

    if (skills.length === 0) {
      console.log(chalk.yellow('No skills found.'));
      console.log('\nTo create a skill:');
      console.log('  /takumi:skill-create <name> <description>');
      return;
    }

    console.log(chalk.bold(`Total: ${skills.length}\n`));

    // カテゴリ別グループ化
    const skillsByCategory = skills.reduce(
      (acc, skill) => {
        if (!acc[skill.category]) {
          acc[skill.category] = [];
        }
        acc[skill.category].push(skill);
        return acc;
      },
      {} as Record<string, typeof skills>
    );

    // カテゴリ別に表示
    for (const [category, categorySkills] of Object.entries(skillsByCategory)) {
      console.log(chalk.bold(`\n## ${category.charAt(0).toUpperCase() + category.slice(1)}`));
      console.log(chalk.gray('-'.repeat(80)));

      for (const skill of categorySkills) {
        const description =
          skill.description.length > 60
            ? skill.description.slice(0, 57) + '...'
            : skill.description;

        console.log(`${chalk.cyan(skill.name.padEnd(30))} | ${description}`);
      }
    }

    console.log('\n' + chalk.bold('Next actions:'));
    console.log('  • Create a skill: /takumi:skill-create <name> <description>');
  } catch (error) {
    console.error(chalk.red('Error loading skills:'), error);
    process.exit(1);
  }
}

main();
