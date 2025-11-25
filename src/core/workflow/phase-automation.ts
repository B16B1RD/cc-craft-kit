import { PhaseChangedEvent } from './event-bus.js';
import { QualityCheckAutomation } from '../quality/automation.js';
import type { TriggerPhase } from '../quality/schema.js';

/**
 * フェーズ自動処理ハンドラー
 *
 * 各フェーズ切り替え時に必要な作業を自動的に実行します。
 * spec.phase_changed イベントをトリガーとして動作します。
 *
 * Note: このハンドラーは Claude Code 側で実行される自動処理の「トリガー」として機能します。
 * 実際の自動処理（設計生成、タスクリスト生成など）は CLAUDE.md の指示に従って Claude が実行します。
 */
export class PhaseAutomationHandler {
  private qualityCheckAutomation: QualityCheckAutomation;

  constructor() {
    this.qualityCheckAutomation = new QualityCheckAutomation();
  }

  /**
   * フェーズ変更イベントを処理
   */
  async handlePhaseChange(event: PhaseChangedEvent): Promise<void> {
    const { specId, newPhase, oldPhase } = event.data;

    if (process.env.DEBUG) {
      console.log(
        `[PhaseAutomation] ${newPhase}: フェーズ自動処理を開始します (specId: ${specId}, oldPhase: ${oldPhase})`
      );
    }

    try {
      switch (newPhase) {
        case 'requirements':
          await this.handleRequirementsPhase(specId);
          break;
        case 'design':
          await this.handleDesignPhase(specId);
          break;
        case 'tasks':
          await this.handleTasksPhase(specId);
          break;
        case 'implementation':
          await this.handleImplementationPhase(specId);
          break;
        case 'completed':
          await this.handleCompletedPhase(specId);
          break;
        default:
          if (process.env.DEBUG) {
            console.warn(`[PhaseAutomation] ${newPhase}: 未対応のフェーズです (specId: ${specId})`);
          }
      }

      if (process.env.DEBUG) {
        console.log(
          `[PhaseAutomation] ${newPhase}: フェーズ自動処理が完了しました (specId: ${specId})`
        );
      }
    } catch (error) {
      console.error(
        `⚠️ フェーズ自動処理でエラーが発生しましたが、フェーズ移行は完了しています。\n` +
          `   手動で必要な作業を実施してください。\n` +
          `   エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * requirements フェーズの自動処理
   *
   * - 仕様書ファイルを読み込み、不足セクションを検出
   * - 不足情報がある場合は、Claude が AskUserQuestion で問い合わせる
   * - GitHub Issue を自動作成（GitHub 統合が有効な場合）
   * - 品質要件チェックを実行
   */
  private async handleRequirementsPhase(specId: string): Promise<void> {
    // Note: 仕様書テンプレートは既に create.ts で展開されているため、ここでは追加処理なし
    // GitHub Issue の自動作成は、spec.created イベントで既に実行されているため、ここでは不要

    console.log(`✓ 要件定義フェーズに移行しました`);
    console.log(`\n次のステップ: 仕様書を編集し、要件定義を記述してください`);

    // 品質チェック実行
    await this.runQualityCheck('requirements', specId);
  }

  /**
   * design フェーズの自動処理
   *
   * - 要件定義セクションを解析
   * - 設計セクション（7. 設計）を自動生成（Claude が実行）
   * - 不足情報がある場合は、Claude が AskUserQuestion で問い合わせる
   * - 品質要件チェックを実行
   */
  private async handleDesignPhase(specId: string): Promise<void> {
    // Note: 設計セクションの自動生成は Claude Code 側で実行される
    // この関数では、設計フェーズに移行したことをユーザーに通知するのみ

    console.log(`✓ 設計フェーズに移行しました`);
    console.log(`\n次のステップ: Claude が設計セクションを自動生成します（CLAUDE.md の指示通り）`);

    // 品質チェック実行
    await this.runQualityCheck('design', specId);
  }

  /**
   * tasks フェーズの自動処理
   *
   * - 受け入れ基準（3. 受け入れ基準）を解析
   * - Claude が TodoWrite で実装タスクリストを生成
   * - Claude が仕様書ファイルに「## 9. 実装タスクリスト」セクションを追加
   * - /cft:spec-update で GitHub Issue に更新を通知
   * - 品質要件チェックを実行
   */
  private async handleTasksPhase(specId: string): Promise<void> {
    // Note: タスクリストの生成は Claude Code 側で実行される
    // この関数では、タスク分解フェーズに移行したことをユーザーに通知するのみ

    console.log(`✓ タスク分解フェーズに移行しました`);
    console.log(
      `\n次のステップ: Claude が実装タスクリストを自動生成します（CLAUDE.md の指示通り）`
    );

    // 品質チェック実行
    await this.runQualityCheck('tasks', specId);
  }

  /**
   * implementation フェーズの自動処理
   *
   * - Claude が typescript-eslint スキルを実行し、既存コードをチェック
   * - 「## 9. 実装タスクリスト」を読み込み、Claude が TodoWrite で表示
   * - Claude が最初の未完了タスクを in_progress に設定
   * - 実装対象ファイルを確認し、準備完了を通知
   * - 品質要件チェックを実行
   */
  private async handleImplementationPhase(specId: string): Promise<void> {
    // Note: TypeScript/ESLint チェック、タスク表示は Claude Code 側で実行される
    // この関数では、実装フェーズに移行したことをユーザーに通知するのみ

    console.log(`✓ 実装フェーズに移行しました`);
    console.log(
      `\n次のステップ: Claude が TypeScript/ESLint チェックを実行し、実装を開始します（CLAUDE.md の指示通り）`
    );

    // 品質チェック実行
    await this.runQualityCheck('implementation', specId);
  }

  /**
   * completed フェーズの自動処理
   *
   * - Claude が code-reviewer サブエージェントで最終レビューを実行
   * - Claude が git-operations スキルで変更差分を確認
   * - Git 自動コミットを実行（イベント駆動で実装済み）
   * - GitHub Issue のステータスを Done に更新
   * - 品質要件チェックを実行
   */
  private async handleCompletedPhase(specId: string): Promise<void> {
    // Note: 最終レビュー、変更差分確認は Claude Code 側で実行される
    // Git 自動コミットは、git-integration.ts のイベントハンドラーで実行される
    // この関数では、完了フェーズに移行したことをユーザーに通知するのみ

    console.log(`✓ 完了フェーズに移行しました`);
    console.log(
      `\n次のステップ: Claude が最終レビューと変更差分確認を実行します（CLAUDE.md の指示通り）`
    );

    // 品質チェック実行
    await this.runQualityCheck('completed', specId);
  }

  /**
   * 品質チェック実行
   *
   * @param phase - チェック対象フェーズ
   * @param specId - 仕様書 ID
   */
  private async runQualityCheck(phase: TriggerPhase, specId?: string): Promise<void> {
    try {
      const result = await this.qualityCheckAutomation.checkQualityRequirements(phase);
      await this.qualityCheckAutomation.reportQualityCheckResult(result, specId);
    } catch (error) {
      console.warn(
        `⚠️  品質チェック中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
