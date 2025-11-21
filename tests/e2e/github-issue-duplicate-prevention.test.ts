/**
 * GitHub Issue 重複作成防止の E2E テスト
 *
 * 実際のコマンド実行シナリオで連続実行 10 回で重複 0 件を検証
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../helpers/db-lifecycle.js';
import { GitHubSyncService } from '../../src/integrations/github/sync.js';
import { GitHubIssues } from '../../src/integrations/github/issues.js';
import { GitHubProjects } from '../../src/integrations/github/projects.js';
import { GitHubClient } from '../../src/integrations/github/client.js';

// モジュールモック
jest.mock('../../src/integrations/github/client.js');
jest.mock('../../src/integrations/github/issues.js');
jest.mock('../../src/integrations/github/projects.js');

describe('GitHub Issue 重複防止 E2E', () => {
  let lifecycle: DatabaseLifecycle;
  let syncService: GitHubSyncService;
  let mockIssues: jest.Mocked<GitHubIssues>;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();

    // モックを作成
    const mockClient = new GitHubClient({ token: 'test-token' }) as jest.Mocked<GitHubClient>;
    mockIssues = new GitHubIssues(mockClient) as jest.Mocked<GitHubIssues>;
    const mockProjects = new GitHubProjects(mockClient) as jest.Mocked<GitHubProjects>;

    // GitHubSyncService のインスタンス作成
    syncService = new GitHubSyncService(lifecycle.db, mockIssues, mockProjects);
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
    jest.clearAllMocks();
  });

  test('連続実行 10 回で重複 0 件を検証', async () => {
    const specId = randomUUID();
    const owner = 'testowner';
    const repo = 'testrepo';

    // 仕様書作成
    await lifecycle.db
      .insertInto('specs')
      .values({
        id: specId,
        name: 'E2E テスト仕様書',
        description: '連続実行テスト',
        phase: 'requirements',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // Issue 作成APIのモック（常に同じ Issue を返す）
    let issueCounter = 0;
    mockIssues.create = jest.fn().mockImplementation(() => {
      issueCounter++;
      return Promise.resolve({
        number: 1,
        id: 123456,
        node_id: 'node_123',
        html_url: `https://github.com/${owner}/${repo}/issues/1`,
        title: '[requirements] E2E テスト仕様書',
        body: '仕様書本文',
        state: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    // 連続実行 10 回（順次実行）
    const results: Array<PromiseSettledResult<number>> = [];
    for (let i = 0; i < 10; i++) {
      try {
        const issueNumber = await syncService.syncSpecToIssue({
          specId,
          owner,
          repo,
          createIfNotExists: true,
        });
        results.push({ status: 'fulfilled', value: issueNumber });
      } catch (error) {
        results.push({ status: 'rejected', reason: error });
      }
    }

    // 成功と失敗を集計
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter(
      (r) =>
        r.status === 'rejected' &&
        ((r.reason as Error).message.includes('既に GitHub Issue が作成されています') ||
          (r.reason as Error).message.includes('UNIQUE constraint failed'))
    );

    // 順次実行のため、1回目は成功し、残り9回は重複チェックでエラー
    expect(succeeded.length + failed.length).toBe(10);
    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(9);

    // Issue 作成 API が 1 回のみ呼び出されたことを確認
    expect(mockIssues.create).toHaveBeenCalledTimes(1);

    // github_sync テーブルに 1 レコードのみ存在することを確認
    const syncRecords = await lifecycle.db
      .selectFrom('github_sync')
      .where('entity_type', '=', 'spec')
      .where('entity_id', '=', specId)
      .selectAll()
      .execute();

    expect(syncRecords).toHaveLength(1);
    expect(syncRecords[0].github_number).toBe(1);
    expect(syncRecords[0].sync_status).toBe('success');
  });

  test('並列実行時の競合状態でも重複が発生しないことを確認', async () => {
    const specId = randomUUID();
    const owner = 'testowner';
    const repo = 'testrepo';

    // 仕様書作成
    await lifecycle.db
      .insertInto('specs')
      .values({
        id: specId,
        name: '並列実行テスト仕様書',
        description: '競合状態テスト',
        phase: 'requirements',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // Issue 作成APIのモック（遅延を追加して競合状態を再現）
    mockIssues.create = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              number: 2,
              id: 123457,
              node_id: 'node_124',
              html_url: `https://github.com/${owner}/${repo}/issues/2`,
              title: '[requirements] 並列実行テスト仕様書',
              body: '仕様書本文',
              state: 'open',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }, 10); // 10ms の遅延
        })
    );

    // 並列実行（Promise.all で同時実行）
    const results = await Promise.allSettled(
      Array(10)
        .fill(null)
        .map(() =>
          syncService.syncSpecToIssue({
            specId,
            owner,
            repo,
            createIfNotExists: true,
          })
        )
    );

    // 成功と失敗を集計
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter(
      (r) =>
        r.status === 'rejected' &&
        ((r.reason as Error).message.includes('既に GitHub Issue が作成されています') ||
          (r.reason as Error).message.includes('UNIQUE constraint failed'))
    );

    // 並列実行でも最終的に github_sync テーブルには 1 レコードのみ存在することを確認
    // （UNIQUE 制約により、競合状態でも重複が防止される）
    expect(succeeded.length + failed.length).toBe(10);
    expect(succeeded.length).toBeGreaterThanOrEqual(1);

    // github_sync テーブルに 1 レコードのみ存在することを確認
    const syncRecords = await lifecycle.db
      .selectFrom('github_sync')
      .where('entity_type', '=', 'spec')
      .where('entity_id', '=', specId)
      .selectAll()
      .execute();

    expect(syncRecords).toHaveLength(1);
    expect(syncRecords[0].sync_status).toBe('success');
  });
});
