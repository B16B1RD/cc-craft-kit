/**
 * 仕様書登録コア機能
 *
 * 責務: JSON ストレージへの追加 + イベント発火のみ
 * CLI エントリポイントとは分離してテスト可能にする
 */

import { z } from 'zod';
import { addSpec } from '../storage/index.js';
import { getEventBusAsync } from '../workflow/event-bus.js';

/**
 * 引数スキーマ
 */
export const registerArgsSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  description: z.string().nullable().optional(),
  branchName: z.string().min(1, 'Branch name is required'),
  specPath: z.string().min(1, 'Spec path is required'),
});

export type RegisterArgs = z.infer<typeof registerArgsSchema>;

/**
 * 出力型
 */
export interface RegisterResult {
  success: boolean;
  specId?: string;
  message?: string;
  error?: string;
}

/**
 * 仕様書を JSON ストレージに登録し、イベントを発火
 */
export async function registerSpec(args: RegisterArgs): Promise<RegisterResult> {
  try {
    // 1. JSON ストレージに追加
    const spec = addSpec({
      id: args.id,
      name: args.name,
      description: args.description || null,
      phase: 'requirements',
      branch_name: args.branchName,
    });

    // 2. spec.created イベント発火
    const eventBus = await getEventBusAsync();
    await eventBus.emit(
      eventBus.createEvent('spec.created', spec.id, {
        name: spec.name,
        description: spec.description,
        phase: spec.phase,
      })
    );

    return {
      success: true,
      specId: spec.id,
      message: 'Spec registered successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
