/**
 * 仕様書登録コア機能
 *
 * 責務: DB INSERT + イベント発火のみ
 * CLI エントリポイントとは分離してテスト可能にする
 */

import { z } from 'zod';
import { getDatabase } from '../database/connection.js';
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
 * 仕様書をデータベースに登録し、イベントを発火
 */
export async function registerSpec(args: RegisterArgs): Promise<RegisterResult> {
  const db = getDatabase();
  const now = new Date().toISOString();

  try {
    // 1. DB INSERT
    await db
      .insertInto('specs')
      .values({
        id: args.id,
        name: args.name,
        description: args.description || null,
        phase: 'requirements',
        branch_name: args.branchName,
        created_at: now,
        updated_at: now,
      })
      .execute();

    // 2. spec.created イベント発火
    const eventBus = await getEventBusAsync();
    await eventBus.emit(
      eventBus.createEvent('spec.created', args.id, {
        name: args.name,
        description: args.description || null,
        phase: 'requirements',
      })
    );

    return {
      success: true,
      specId: args.id,
      message: 'Spec registered successfully',
    };
  } catch (error) {
    // エラー時は DB レコードを削除（ロールバック）
    try {
      await db.deleteFrom('specs').where('id', '=', args.id).execute();
    } catch {
      // ロールバック失敗は無視（レコードが存在しない可能性）
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
