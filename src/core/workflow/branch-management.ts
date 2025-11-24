/**
 * ブランチ管理機能
 *
 * フェーズ移行時のブランチ自動作成・切り替えを担当します。
 *
 * 注意: completed フェーズ移行時の PR 自動作成処理は、
 * プロンプトベース実装（spec-phase.md）に移行されました。
 */

import { Kysely } from 'kysely';
import { Database } from '../database/schema.js';
import { EventBus } from './event-bus.js';

/**
 * ブランチ管理のイベントハンドラーを登録
 *
 * 現在、このファイルにはイベントハンドラーは登録されていません。
 * completed フェーズ移行時の PR 作成は、spec-phase.md のプロンプト指示で実現されます。
 */
export function registerBranchManagementHandlers(_eventBus: EventBus, _db: Kysely<Database>): void {
  // 現在、登録するイベントハンドラーはありません
  // completed フェーズ移行時の PR 作成は、spec-phase.md のプロンプト指示で実現されます
}
