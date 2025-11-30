/**
 * 仕様書登録コマンド CLI エントリポイント
 *
 * コア機能: src/core/spec/register-spec.ts
 */

import '../../core/config/env.js';
import { z } from 'zod';
import { closeDatabase } from '../../core/database/connection.js';
import {
  registerSpec,
  registerArgsSchema,
  type RegisterResult,
} from '../../core/spec/register-spec.js';

/**
 * CLI 引数をパース
 */
function parseCliArgs(argv: string[]) {
  const args: Record<string, string | undefined> = {};

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[++i];
      args[key] = value;
    }
  }

  // kebab-case → camelCase 変換
  return registerArgsSchema.parse({
    id: args['id'],
    name: args['name'],
    description: args['description'] || null,
    branchName: args['branch-name'],
    specPath: args['spec-path'],
  });
}

/**
 * CLI エントリポイント実行
 */
export async function runCli(): Promise<void> {
  try {
    const args = parseCliArgs(process.argv);
    const result = await registerSpec(args);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const result: RegisterResult = {
        success: false,
        error: `Validation failed: ${error.errors.map((e) => e.message).join(', ')}`,
      };
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }
    const result: RegisterResult = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// CLI エントリポイント（直接実行時のみ）
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  runCli();
}
