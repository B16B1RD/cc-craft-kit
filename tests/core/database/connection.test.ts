/**
 * Database接続テスト
 */
import { setupDatabaseLifecycle, getDatabaseState, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';

describe('Database Connection', () => {
  let lifecycle: DatabaseLifecycle;
  let skipCleanup = false;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
    skipCleanup = false;
  });

  afterEach(async () => {
    if (skipCleanup) return;
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  test('データベース接続が成功する', async () => {
    expect(lifecycle.db).toBeDefined();
  });

  test('specsテーブルが存在する', async () => {
    const result = await lifecycle.db
      .selectFrom('specs')
      .selectAll()
      .execute();

    expect(result).toEqual([]);
  });

  test('tasksテーブルが存在する', async () => {
    const result = await lifecycle.db
      .selectFrom('tasks')
      .selectAll()
      .execute();

    expect(result).toEqual([]);
  });

  test('logsテーブルが存在する', async () => {
    const result = await lifecycle.db
      .selectFrom('logs')
      .selectAll()
      .execute();

    expect(result).toEqual([]);
  });

  test('github_syncテーブルが存在する', async () => {
    const result = await lifecycle.db
      .selectFrom('github_sync')
      .selectAll()
      .execute();

    expect(result).toEqual([]);
  });

  test('外部キー制約が有効', async () => {
    // SQLite の PRAGMA foreign_keys を確認
    const result = await lifecycle.db.executeQuery<{ foreign_keys: number }>({
      kind: 'SelectQueryNode',
      sql: 'PRAGMA foreign_keys',
      parameters: [],
    } as any);

    // foreign_keys = 1 なら有効
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0]).toHaveProperty('foreign_keys', 1);
  });

  test('データベース状態を取得できる', async () => {
    const state = await getDatabaseState(lifecycle.db);

    expect(state).toEqual({
      specs: 0,
      tasks: 0,
      logs: 0,
      githubSync: 0,
    });
  });

  test('マイグレーション後にテーブルが作成されている', async () => {
    // すべてのテーブルが存在することを確認
    const tables = ['specs', 'tasks', 'logs', 'github_sync'] as const;

    for (const table of tables) {
      const result = await lifecycle.db
        .selectFrom(table)
        .selectAll()
        .execute();

      expect(result).toEqual([]);
    }
  });

  test('データベース接続をクローズできる', async () => {
    await lifecycle.close();
    skipCleanup = true;

    // 再接続を試みてエラーが発生することを確認
    await expect(
      lifecycle.db.selectFrom('specs').selectAll().execute()
    ).rejects.toThrow();
  });
});
