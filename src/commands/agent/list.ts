#!/usr/bin/env node
/**
 * サブエージェント一覧コマンド
 *
 * 登録されているサブエージェントの一覧を表示します。
 */

import { loadSubagents } from '../../core/subagents/loader.js';
import { getSubagentRegistry } from '../../core/subagents/registry.js';
import chalk from 'chalk';

async function main(): Promise<void> {
  try {
    console.log(chalk.bold('# Subagents\n'));

    // サブエージェントを読み込む
    await loadSubagents();

    // レジストリから一覧を取得
    const registry = getSubagentRegistry();
    const subagents = registry.list();

    if (subagents.length === 0) {
      console.log(chalk.yellow('No subagents found.'));
      console.log('\nTo create a subagent:');
      console.log('  /takumi:agent-create <name> <description>');
      return;
    }

    console.log(chalk.bold(`Total: ${subagents.length}\n`));

    // テーブルヘッダー
    console.log(chalk.bold(`${'Name'.padEnd(30)} | ${'Version'.padEnd(10)} | Description`));
    console.log(chalk.gray('-'.repeat(80)));

    // サブエージェント一覧
    for (const subagent of subagents) {
      const name = subagent.name.padEnd(30);
      const version = subagent.version.padEnd(10);
      const description =
        subagent.description.length > 40
          ? subagent.description.slice(0, 37) + '...'
          : subagent.description;

      console.log(`${name} | ${version} | ${description}`);
    }

    console.log('\n' + chalk.bold('Next actions:'));
    console.log('  • Create a subagent: /takumi:agent-create <name> <description>');
  } catch (error) {
    console.error(chalk.red('Error loading subagents:'), error);
    process.exit(1);
  }
}

main();
