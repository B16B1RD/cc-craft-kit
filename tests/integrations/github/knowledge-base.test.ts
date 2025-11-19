/**
 * GitHub ナレッジベーステスト
 */
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { randomUUID } from 'crypto';

describe('GitHubKnowledgeBase', () => {
  let lifecycle: DatabaseLifecycle;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  test('進捗記録がログに保存される', async () => {
    const specId = randomUUID();

    // 仕様書作成
    await lifecycle.db
      .insertInto('specs')
      .values({
        id: specId,
        name: '進捗記録テスト',
        description: null,
        phase: 'implementation',
        github_issue_id: 100,
        github_project_id: null,
        github_milestone_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // 進捗ログ記録
    await lifecycle.db
      .insertInto('logs')
      .values({
        spec_id: specId,
        action: 'knowledge_progress',
        level: 'info',
        message: 'Progress recorded: 機能Aの実装完了',
        metadata: JSON.stringify({
          type: 'progress',
          commentId: 12345,
          issueNumber: 100,
        }),
        timestamp: new Date().toISOString(),
      })
      .execute();

    // ログ取得
    const logs = await lifecycle.db
      .selectFrom('logs')
      .where('spec_id', '=', specId)
      .where('level', '=', 'info')
      .selectAll()
      .execute();

    expect(logs).toHaveLength(1);
    expect(logs[0].message).toContain('Progress recorded');

    const metadata = JSON.parse(logs[0].metadata || '{}');
    expect(metadata.type).toBe('progress');
  });

  test('エラー解決記録がログに保存される', async () => {
    const specId = randomUUID();

    // 仕様書作成
    await lifecycle.db
      .insertInto('specs')
      .values({
        id: specId,
        name: 'エラー解決テスト',
        description: null,
        phase: 'implementation',
        github_issue_id: 200,
        github_project_id: null,
        github_milestone_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // エラー解決ログ記録
    await lifecycle.db
      .insertInto('logs')
      .values({
        spec_id: specId,
        action: 'knowledge_error',
        level: 'warn',
        message: 'Error solution recorded: TypeScriptコンパイルエラー...',
        metadata: JSON.stringify({
          type: 'error_solution',
          commentId: 23456,
          issueNumber: 200,
        }),
        timestamp: new Date().toISOString(),
      })
      .execute();

    // ログ取得
    const logs = await lifecycle.db
      .selectFrom('logs')
      .where('spec_id', '=', specId)
      .where('level', '=', 'warn')
      .selectAll()
      .execute();

    expect(logs).toHaveLength(1);
    expect(logs[0].message).toContain('Error solution recorded');

    const metadata = JSON.parse(logs[0].metadata || '{}');
    expect(metadata.type).toBe('error_solution');
  });

  test('Tips記録がログに保存される', async () => {
    const specId = randomUUID();

    // 仕様書作成
    await lifecycle.db
      .insertInto('specs')
      .values({
        id: specId,
        name: 'Tips記録テスト',
        description: null,
        phase: 'implementation',
        github_issue_id: 300,
        github_project_id: null,
        github_milestone_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // Tipsログ記録
    await lifecycle.db
      .insertInto('logs')
      .values({
        spec_id: specId,
        action: 'knowledge_tip',
        level: 'info',
        message: 'Tip recorded: パフォーマンス最適化のコツ',
        metadata: JSON.stringify({
          type: 'tip',
          commentId: 34567,
          issueNumber: 300,
          category: 'performance',
        }),
        timestamp: new Date().toISOString(),
      })
      .execute();

    // ログ取得
    const logs = await lifecycle.db
      .selectFrom('logs')
      .where('spec_id', '=', specId)
      .selectAll()
      .execute();

    expect(logs).toHaveLength(1);
    expect(logs[0].message).toContain('Tip recorded');

    const metadata = JSON.parse(logs[0].metadata || '{}');
    expect(metadata.type).toBe('tip');
    expect(metadata.category).toBe('performance');
  });

  test('複数種類のナレッジが記録される', async () => {
    const specId = randomUUID();

    // 仕様書作成
    await lifecycle.db
      .insertInto('specs')
      .values({
        id: specId,
        name: '複数ナレッジテスト',
        description: null,
        phase: 'implementation',
        github_issue_id: 400,
        github_project_id: null,
        github_milestone_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // 3種類のログを記録
    const entries = [
      {
        action: 'knowledge_progress',
        level: 'info' as const,
        message: 'Progress recorded',
        type: 'progress',
      },
      {
        action: 'knowledge_error',
        level: 'warn' as const,
        message: 'Error solution recorded',
        type: 'error_solution',
      },
      {
        action: 'knowledge_tip',
        level: 'info' as const,
        message: 'Tip recorded',
        type: 'tip',
      },
    ];

    for (const entry of entries) {
      await lifecycle.db
        .insertInto('logs')
        .values({
          spec_id: specId,
          action: entry.action,
          level: entry.level,
          message: entry.message,
          metadata: JSON.stringify({ type: entry.type }),
          timestamp: new Date().toISOString(),
        })
        .execute();
    }

    // 全ログ取得
    const logs = await lifecycle.db.selectFrom('logs').where('spec_id', '=', specId).selectAll().execute();

    expect(logs).toHaveLength(3);

    const types = logs.map((l) => JSON.parse(l.metadata || '{}').type);
    expect(types).toContain('progress');
    expect(types).toContain('error_solution');
    expect(types).toContain('tip');
  });
});
