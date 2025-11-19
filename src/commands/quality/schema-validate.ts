/**
 * スキーマ検証コマンド
 *
 * このコマンドは database-schema-validator スキルの実行をトリガーします。
 * 実際の検証処理は Claude Code がスラッシュコマンドの指示に従って実行します。
 */

import { handleCLIError } from '../utils/error-handler.js';

export async function schemaValidate(): Promise<void> {
  console.log('🗄️  Database Schema Validation Started');
  console.log('');
  console.log('Target: src/core/database/ (schema and migrations)');
  console.log('');
  console.log('Running database-schema-validator skill...');
  console.log('');
  console.log('The skill will validate:');
  console.log('  • Schema type definition consistency');
  console.log('  • Foreign key constraints');
  console.log('  • Index configuration');
  console.log('  • Migration destructive changes');
  console.log('');
  console.log('✓ Command executed successfully');
  console.log('');
  console.log('Claude Code will now proceed with schema validation.');
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  schemaValidate().catch((error) => handleCLIError(error));
}
