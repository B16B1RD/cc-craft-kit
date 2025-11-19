/**
 * コードレビューコマンド
 *
 * このコマンドは code-reviewer サブエージェントの実行をトリガーします。
 * 実際のレビュー処理は Claude Code がスラッシュコマンドの指示に従って実行します。
 */

import { handleCLIError } from '../utils/error-handler.js';

export async function codeReview(filePattern?: string): Promise<void> {
  console.log('🔍 Code Review Started');
  console.log('');

  if (filePattern) {
    console.log(`Target: ${filePattern}`);
  } else {
    console.log('Target: All project files (src/**/*.ts, tests/**/*.ts)');
  }

  console.log('');
  console.log('Running code-reviewer subagent...');
  console.log('');
  console.log('The code-reviewer will analyze:');
  console.log('  • Code quality and readability');
  console.log('  • Security vulnerabilities');
  console.log('  • Performance issues');
  console.log('  • Best practice adherence');
  console.log('  • Potential bugs');
  console.log('');
  console.log('✓ Command executed successfully');
  console.log('');
  console.log('Claude Code will now proceed with the code review.');
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const filePattern = process.argv[2];
  codeReview(filePattern).catch((error) => handleCLIError(error));
}
