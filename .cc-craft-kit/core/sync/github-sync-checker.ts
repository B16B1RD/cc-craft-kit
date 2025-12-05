import { getSpecsWithGitHubInfo, loadGitHubSync } from '../storage/index.js';

/**
 * GitHub同期チェックレポート
 */
export interface GitHubSyncReport {
  /** GitHub Issueが作成済みの仕様書数 */
  synced: number;
  /** GitHub Issue未作成の仕様書数 */
  notSynced: number;
  /** 同期エラーが発生している仕様書 */
  syncErrors: Array<{
    specId: string;
    specName: string;
    errorMessage: string;
  }>;
  /** GitHub同期率 (%) */
  syncRate: number;
  /** 未同期の仕様書ID一覧 */
  notSyncedSpecIds: string[];
}

/**
 * GitHub同期状態チェッカー
 */
export class GitHubSyncChecker {
  constructor() {}

  /**
   * GitHub Issue同期状態をチェック
   *
   * @returns GitHub同期レポート
   */
  check(): GitHubSyncReport {
    // 1. 全仕様書を取得（GitHub 同期情報付き）
    const allSpecs = getSpecsWithGitHubInfo();

    // 2. GitHub同期レコードを取得
    const syncRecords = loadGitHubSync().filter((r) => r.entity_type === 'spec');

    // 3. 同期済み・未同期の分類
    const synced = allSpecs.filter((s) => s.github_issue_number !== null);
    const notSynced = allSpecs.filter((s) => s.github_issue_number === null);

    // 4. 同期エラーの検出
    const syncErrors = syncRecords
      .filter((r) => r.sync_status === 'failed')
      .map((r) => {
        const spec = allSpecs.find((s) => s.id === r.entity_id);
        return {
          specId: r.entity_id,
          specName: spec?.name || 'Unknown',
          errorMessage: r.error_message || 'Unknown error',
        };
      });

    // 5. 同期率の計算
    const totalSpecs = allSpecs.length;
    const syncRate = totalSpecs > 0 ? Math.round((synced.length / totalSpecs) * 100) : 0;

    return {
      synced: synced.length,
      notSynced: notSynced.length,
      syncErrors,
      syncRate,
      notSyncedSpecIds: notSynced.map((s) => s.id),
    };
  }
}
