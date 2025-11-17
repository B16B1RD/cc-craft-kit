/**
 * エラー解決策記録コマンド
 */

import { recordErrorSolution } from './record.js';

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const specId = process.argv[2];
  const error = process.argv[3];
  const solution = process.argv[4];

  if (!specId || !error || !solution) {
    console.error('Usage: npx tsx error.ts <spec-id> <error> <solution>');
    process.exit(1);
  }

  recordErrorSolution(specId, error, solution).catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

export { recordErrorSolution };
