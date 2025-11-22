import { PhaseChangedEvent } from './event-bus.js';
import { QualityCheckAutomation } from '../quality/automation.js';
import type { TriggerPhase } from '../quality/schema.js';
import { getDatabase } from '../database/connection.js';
import { getSpecWithGitHubInfo } from '../database/helpers.js';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { parseAcceptanceCriteria, parseTaskList, hasTaskListSection } from '../spec/parser.js';
import { generateTaskList } from '../tasks/generator.js';
import { addTaskListSection } from '../spec/updater.js';
import { spawnSync } from 'node:child_process';

/**
 * UUID フォーマット検証
 */
function validateSpecId(specId: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(specId)) {
    throw new Error(`Invalid spec ID format: ${specId}`);
  }
}

/**
 * フェーズ自動処理ハンドラー
 *
 * 各フェーズ切り替え時に必要な作業を自動的に実行します。
 * spec.phase_changed イベントをトリガーとして動作します。
 *
 * Note: フェーズ自動処理は TypeScript コードで実装されており、CLAUDE.md に依存しません。
 * - tasks フェーズ: 受け入れ基準から実装タスクリストを自動生成
 * - implementation フェーズ: 実装タスクリストを表示し、進捗を追跡
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
        case 'testing':
          await this.handleTestingPhase(specId);
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
   * - 品質要件チェックを実行
   */
  private async handleDesignPhase(specId: string): Promise<void> {
    console.log(`✓ 設計フェーズに移行しました`);
    console.log(`\n次のステップ: 仕様書の設計セクションを記述してください`);

    // 品質チェック実行
    await this.runQualityCheck('design', specId);
  }

  /**
   * tasks フェーズの自動処理
   *
   * - 受け入れ基準（3. 受け入れ基準）を解析
   * - 実装タスクリストを自動生成
   * - 仕様書ファイルに「## 8. 実装タスクリスト」セクションを追加
   * - /cft:spec-update で GitHub Issue に更新を通知
   * - 品質要件チェックを実行
   */
  private async handleTasksPhase(specId: string): Promise<void> {
    console.log(`✓ タスク分解フェーズに移行しました`);

    try {
      // データベースから仕様書情報を取得
      const db = getDatabase();
      const spec = await getSpecWithGitHubInfo(db, specId);

      if (!spec) {
        throw new Error(`仕様書が見つかりません: ${specId}`);
      }

      // UUIDフォーマット検証（パストラバーサル攻撃防止）
      validateSpecId(spec.id);

      // 仕様書ファイルのパスを構築
      const specFilePath = join(process.cwd(), '.cc-craft-kit', 'specs', `${spec.id}.md`);

      if (!existsSync(specFilePath)) {
        throw new Error(`仕様書ファイルが見つかりません: ${specFilePath}`);
      }

      // 既にタスクリストセクションが存在する場合はスキップ
      if (hasTaskListSection(specFilePath)) {
        console.log(`\nℹ タスクリストセクションは既に存在します。スキップします。`);
        await this.runQualityCheck('tasks', specId);
        return;
      }

      console.log(`\n📋 受け入れ基準から実装タスクリストを生成しています...`);

      // 受け入れ基準を解析
      const criteria = parseAcceptanceCriteria(specFilePath);

      if (criteria.length === 0) {
        console.warn(`\n⚠️  受け入れ基準が見つかりませんでした。手動でタスクを追加してください。`);
        await this.runQualityCheck('tasks', specId);
        return;
      }

      // タスクリストを生成
      const taskListMarkdown = generateTaskList(criteria);

      // 仕様書ファイルにセクションを追加
      addTaskListSection(specFilePath, taskListMarkdown);

      console.log(
        `\n✓ 実装タスクリストを生成しました (${criteria.length} 件の受け入れ基準から生成)`
      );

      // GitHub Issue へ更新を通知
      if (spec.github_issue_number) {
        console.log(`\n📢 GitHub Issue へ更新を通知しています...`);
        try {
          // spawnSync を使用してコマンドインジェクションを防止
          const result = spawnSync(
            'npx',
            ['tsx', '.cc-craft-kit/commands/spec/update.ts', specId],
            {
              stdio: 'inherit',
            }
          );

          if (result.error || result.status !== 0) {
            throw new Error('GitHub Issue update failed');
          }
        } catch (error) {
          console.warn(
            `\n⚠️  GitHub Issue の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    } catch (error) {
      console.error(
        `\n⚠️  タスクリスト生成中にエラーが発生しました。手動でタスクを追加してください。\n` +
          `   エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 品質チェック実行
    await this.runQualityCheck('tasks', specId);
  }

  /**
   * implementation フェーズの自動処理
   *
   * - 「## 8. 実装タスクリスト」を読み込み、タスクを表示
   * - 最初の未完了タスクを強調表示
   * - 品質要件チェックを実行
   */
  private async handleImplementationPhase(specId: string): Promise<void> {
    console.log(`✓ 実装フェーズに移行しました`);

    try {
      // データベースから仕様書情報を取得
      const db = getDatabase();
      const spec = await getSpecWithGitHubInfo(db, specId);

      if (!spec) {
        throw new Error(`仕様書が見つかりません: ${specId}`);
      }

      // UUIDフォーマット検証（パストラバーサル攻撃防止）
      validateSpecId(spec.id);

      // 仕様書ファイルのパスを構築
      const specFilePath = join(process.cwd(), '.cc-craft-kit', 'specs', `${spec.id}.md`);

      if (!existsSync(specFilePath)) {
        throw new Error(`仕様書ファイルが見つかりません: ${specFilePath}`);
      }

      // タスクリストセクションが存在するかチェック
      if (!hasTaskListSection(specFilePath)) {
        console.warn(
          `\n⚠️  実装タスクリストセクションが見つかりません。tasks フェーズを先に実行してください。`
        );
        await this.runQualityCheck('implementation', specId);
        return;
      }

      console.log(`\n📋 実装タスクリストを読み込んでいます...`);

      // タスクリストを解析
      const tasks = parseTaskList(specFilePath);

      if (tasks.length === 0) {
        console.warn(`\n⚠️  実装タスクが見つかりませんでした。手動でタスクを追加してください。`);
        await this.runQualityCheck('implementation', specId);
        return;
      }

      // タスク一覧を表示
      console.log(`\n## 実装タスクリスト\n`);

      const uncompletedTasks = tasks.filter((t) => !t.checked);
      const completedTasks = tasks.filter((t) => t.checked);

      console.log(`進捗: ${completedTasks.length}/${tasks.length} 完了\n`);

      // 最初の未完了タスクを強調表示
      let firstUncompleted = true;
      for (const task of tasks) {
        const indent = '  '.repeat(task.indentLevel);
        const checkbox = task.checked ? '[x]' : '[ ]';
        const prefix = !task.checked && firstUncompleted ? '👉' : '  ';

        console.log(`${prefix} ${indent}- ${checkbox} ${task.text}`);

        if (!task.checked && firstUncompleted) {
          firstUncompleted = false;
        }
      }

      if (uncompletedTasks.length > 0) {
        console.log(`\n次のステップ: 👉 で示されたタスクから実装を開始してください\n`);
      } else {
        console.log(`\n✓ すべてのタスクが完了しています！completed フェーズに移行できます。\n`);
      }
    } catch (error) {
      console.error(
        `\n⚠️  タスクリスト表示中にエラーが発生しました。\n` +
          `   エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 品質チェック実行
    await this.runQualityCheck('implementation', specId);
  }

  /**
   * testing フェーズの自動処理
   *
   * - テスト実行とカバレッジ確認
   * - 品質要件チェックを実行
   */
  private async handleTestingPhase(specId: string): Promise<void> {
    console.log(`✓ テストフェーズに移行しました`);
    console.log(`\n次のステップ: テストを実装し、実行してください`);

    // 品質チェック実行
    await this.runQualityCheck('testing', specId);
  }

  /**
   * completed フェーズの自動処理
   *
   * - Git 自動コミットを実行（イベント駆動で実装済み）
   * - GitHub Issue のステータスを Done に更新
   * - 品質要件チェックを実行
   */
  private async handleCompletedPhase(specId: string): Promise<void> {
    // Note: Git 自動コミットは、git-integration.ts のイベントハンドラーで実行される

    console.log(`✓ 完了フェーズに移行しました`);
    console.log(`\n🎉 実装が完了しました！変更内容を確認し、プルリクエストを作成してください。`);

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
