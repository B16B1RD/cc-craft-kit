/**
 * 品質チェック自動実行ハンドラー
 *
 * @module core/quality/automation
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Kysely } from 'kysely';
import { QualityMapper } from './mapper.js';
import type { TriggerPhase } from './schema.js';
import type { Database } from '../database/schema.js';
import { getDatabase } from '../database/connection.js';

/**
 * 品質チェック自動実行結果
 */
export interface QualityCheckResult {
  /**
   * チェック対象フェーズ
   */
  phase: TriggerPhase;

  /**
   * 不足している品質チェック数
   */
  missingCount: number;

  /**
   * 不足している品質チェックの詳細
   */
  gaps: Array<{
    requirementName: string;
    type: 'subagent' | 'skill';
    description: string;
  }>;

  /**
   * 品質要件ファイルが存在しない場合 true
   */
  notConfigured: boolean;
}

/**
 * 品質チェック自動実行ハンドラー
 */
export class QualityCheckAutomation {
  private cwd: string;
  private db: Kysely<Database>;

  constructor(cwd?: string, db?: Kysely<Database>) {
    this.cwd = cwd || process.cwd();
    this.db = db || getDatabase();
  }

  /**
   * フェーズ移行時の品質チェック実行
   *
   * @param phase - チェック対象フェーズ
   * @returns チェック結果
   */
  async checkQualityRequirements(phase: TriggerPhase): Promise<QualityCheckResult> {
    // 品質要件ファイルの存在チェック
    const qualityRequirementsPath = join(this.cwd, '.cc-craft-kit', 'quality-requirements.yaml');

    if (!existsSync(qualityRequirementsPath)) {
      return {
        phase,
        missingCount: 0,
        gaps: [],
        notConfigured: true,
      };
    }

    try {
      const mapper = new QualityMapper(this.cwd);
      const gaps = mapper.detectQualityGaps(phase);

      return {
        phase,
        missingCount: gaps.length,
        gaps: gaps.map((gap) => ({
          requirementName: gap.requirementName,
          type: gap.type,
          description: gap.description,
        })),
        notConfigured: false,
      };
    } catch (error) {
      // 品質要件ファイルが不正な場合、エラーをスローせずに空の結果を返す
      console.warn(
        `⚠️  品質要件ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );

      return {
        phase,
        missingCount: 0,
        gaps: [],
        notConfigured: true,
      };
    }
  }

  /**
   * 品質チェック結果をユーザーに通知
   *
   * @param result - チェック結果
   * @param specId - 仕様書 ID（ログ記録用）
   */
  async reportQualityCheckResult(result: QualityCheckResult, specId?: string): Promise<void> {
    if (result.notConfigured) {
      console.log(
        `\nℹ️  品質要件が未設定です。/cft:quality-init で品質要件定義ファイルを作成できます。`
      );
      await this.logQualityCheck(result, specId, 'skipped');
      return;
    }

    if (result.missingCount === 0) {
      console.log(`\n✓ ${result.phase} フェーズの品質要件をすべて満たしています。`);
      await this.logQualityCheck(result, specId, 'success');
      return;
    }

    console.log(
      `\n⚠️  ${result.phase} フェーズで ${result.missingCount} 個の品質チェックが不足しています:`
    );

    for (const gap of result.gaps) {
      console.log(`  - ${gap.requirementName} (${gap.type}): ${gap.description}`);
    }

    console.log(`\n詳細を確認: /cft:quality-check`);
    console.log(`生成コマンド: /cft:quality-generate <type> <name>`);

    await this.logQualityCheck(result, specId, 'failed');
  }

  /**
   * 品質チェック結果をログに記録
   *
   * @param result - チェック結果
   * @param specId - 仕様書 ID
   * @param status - ステータス
   */
  private async logQualityCheck(
    result: QualityCheckResult,
    specId: string | undefined,
    status: 'success' | 'failed' | 'skipped'
  ): Promise<void> {
    try {
      const metadata = {
        phase: result.phase,
        missing_count: result.missingCount,
        gaps: result.gaps,
        not_configured: result.notConfigured,
        spec_id: specId || null,
      };

      await this.db
        .insertInto('logs')
        .values({
          action: 'quality_check',
          level: status === 'failed' ? 'warn' : 'info',
          message: `品質チェック ${status}: ${result.phase} フェーズ (不足数: ${result.missingCount})`,
          metadata: JSON.stringify(metadata),
          spec_id: specId || null,
          timestamp: new Date().toISOString(),
        })
        .execute();
    } catch (error) {
      // ログ記録失敗時も処理を継続
      console.warn(
        `⚠️  品質チェックログの記録に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
