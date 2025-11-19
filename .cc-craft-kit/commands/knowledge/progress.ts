/**
 * 進捗記録コマンド
 */

import { recordProgress } from './record.js';
import { handleCLIError } from '../utils/error-handler.js';

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const specId = process.argv[2];
  const message = process.argv[3];

  if (!specId || !message) {
    console.error('Usage: npx tsx progress.ts <spec-id> <message>');
    process.exit(1);
  }

  recordProgress(specId, message).catch((error) => handleCLIError(error));
}

export { recordProgress };
