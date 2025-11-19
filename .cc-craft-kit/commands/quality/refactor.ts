/**
 * リファクタリングコマンド
 *
 * このコマンドは refactoring-assistant サブエージェントの実行をトリガーします。
 * 実際のリファクタリング処理は Claude Code がスラッシュコマンドの指示に従って実行します。
 */

import { handleCLIError } from '../utils/error-handler.js';

export async function refactor(filePattern?: string): Promise<void> {
  console.log('🔧 Refactoring Started');
  console.log('');

  if (filePattern) {
    console.log(`Target: ${filePattern}`);
  } else {
    console.log('Target: All source files (src/**/*.ts)');
  }

  console.log('');
  console.log('Running refactoring-assistant subagent...');
  console.log('');
  console.log('The refactoring-assistant will analyze:');
  console.log('  • Code duplication (DRY violations)');
  console.log('  • High complexity functions');
  console.log('  • Performance bottlenecks');
  console.log('  • Design pattern opportunities');
  console.log('');
  console.log('✓ Command executed successfully');
  console.log('');
  console.log('Claude Code will now proceed with refactoring analysis.');
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const filePattern = process.argv[2];
  refactor(filePattern).catch((error) => handleCLIError(error));
}
