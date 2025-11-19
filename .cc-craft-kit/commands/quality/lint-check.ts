/**
 * Lint チェックコマンド
 *
 * このコマンドは typescript-eslint スキルの実行をトリガーします。
 * 実際のチェック処理は Claude Code がスラッシュコマンドの指示に従って実行します。
 */

import { handleCLIError } from '../utils/error-handler.js';

export async function lintCheck(): Promise<void> {
  console.log('✨ Lint Check Started');
  console.log('');
  console.log('Target: All project files');
  console.log('');
  console.log('Running typescript-eslint skill...');
  console.log('');
  console.log('The skill will check:');
  console.log('  • TypeScript type errors (npx tsc --noEmit)');
  console.log('  • ESLint warnings (npm run lint)');
  console.log('  • Unused variables and imports');
  console.log('  • Code style violations');
  console.log('  • Best practice violations');
  console.log('');
  console.log('✓ Command executed successfully');
  console.log('');
  console.log('Claude Code will now proceed with lint checks.');
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  lintCheck().catch((error) => handleCLIError(error));
}
