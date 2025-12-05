/**
 * フェーズ更新スクリプト
 *
 * DB の phase カラムを更新し、イベントを発火します。
 * プロンプトから呼び出される最小限のスクリプトです。
 */

import '../../core/config/env.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findSpecByIdPrefix, updateSpec } from '../../core/storage/index.js';
import { getEventBusAsync, getEventBus } from '../../core/workflow/event-bus.js';
import { validateSpecId, validatePhase, Phase } from '../utils/validation.js';

/**
 * 更新結果の型定義
 */
interface UpdatePhaseOutput {
  success: boolean;
  oldPhase?: string;
  newPhase?: string;
  specId?: string;
  specName?: string;
  error?: string;
}

/**
 * フェーズを更新してイベントを発火
 */
async function updatePhase(specId: string, newPhase: string): Promise<UpdatePhaseOutput> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');

  // プロジェクト初期化チェック
  if (!existsSync(ccCraftKitDir)) {
    return {
      success: false,
      error: 'Project not initialized. Run /cft:init first.',
    };
  }

  // 仕様書IDの検証
  try {
    validateSpecId(specId);
  } catch {
    return {
      success: false,
      error: `Invalid spec ID: ${specId}. Must be at least 8 characters.`,
    };
  }

  // フェーズの検証（省略形を正規化）
  let validatedPhase: Phase;
  try {
    validatedPhase = validatePhase(newPhase);
  } catch {
    return {
      success: false,
      error: `Invalid phase: ${newPhase}. Valid phases: requirements, design, tasks, implementation, testing, completed`,
    };
  }

  // 仕様書検索（前方一致）
  const spec = findSpecByIdPrefix(specId);

  if (!spec) {
    return {
      success: false,
      error: `Spec not found: ${specId}`,
    };
  }

  const oldPhase = spec.phase;

  // JSON ストレージ更新
  try {
    updateSpec(spec.id, { phase: validatedPhase });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to update storage: ${message}`,
    };
  }

  // イベント発火
  try {
    let eventBus;
    try {
      eventBus = await getEventBusAsync();
    } catch {
      // タイムアウトしても EventBus インスタンスは取得可能
      eventBus = getEventBus();
    }

    await eventBus.emit(
      eventBus.createEvent('spec.phase_changed', spec.id, {
        oldPhase,
        newPhase: validatedPhase,
      })
    );
  } catch (error: unknown) {
    // イベント発火エラーは警告として扱い、処理は継続
    console.error(
      `Warning: Event emission failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return {
    success: true,
    oldPhase,
    newPhase: validatedPhase,
    specId: spec.id,
    specName: spec.name,
  };
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const specId = args[0];
  const newPhase = args[1];

  if (!specId || !newPhase) {
    const errorOutput: UpdatePhaseOutput = {
      success: false,
      error: 'Usage: npx tsx update-phase.ts <spec-id> <new-phase>',
    };
    console.log(JSON.stringify(errorOutput, null, 2));
    process.exit(1);
  }

  updatePhase(specId, newPhase)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      const errorOutput: UpdatePhaseOutput = {
        success: false,
        error: message,
      };
      console.log(JSON.stringify(errorOutput, null, 2));
      process.exit(1);
    });
}

export { updatePhase, type UpdatePhaseOutput };
