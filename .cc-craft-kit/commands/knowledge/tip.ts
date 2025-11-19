/**
 * Tips記録コマンド
 */

import { recordTip } from './record.js';
import { handleCLIError } from '../utils/error-handler.js';

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const specId = process.argv[2];
  const category = process.argv[3];
  const tip = process.argv[4];

  if (!specId || !category || !tip) {
    console.error('Usage: npx tsx tip.ts <spec-id> <category> <tip>');
    process.exit(1);
  }

  recordTip(specId, category, tip).catch((error) => handleCLIError(error));
}

export { recordTip };
