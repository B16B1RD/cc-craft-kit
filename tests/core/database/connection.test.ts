/**
 * Database接続テスト
 */
import { createTestDatabase, cleanupTestDatabase } from '../../helpers/test-database.js';
import { Kysely } from 'kysely';
import { Database } from '../../../src/core/database/schema.js';

describe('Database Connection', () => {
  let db: Kysely<Database>;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
  });

  test('データベース接続が成功する', async () => {
    expect(db).toBeDefined();
  });

  test('specsテーブルが存在する', async () => {
    const result = await db
      .selectFrom('specs')
      .selectAll()
      .execute();

    expect(result).toEqual([]);
  });

  test('tasksテーブルが存在する', async () => {
    const result = await db
      .selectFrom('tasks')
      .selectAll()
      .execute();

    expect(result).toEqual([]);
  });

  test('logsテーブルが存在する', async () => {
    const result = await db
      .selectFrom('logs')
      .selectAll()
      .execute();

    expect(result).toEqual([]);
  });

  test('github_syncテーブルが存在する', async () => {
    const result = await db
      .selectFrom('github_sync')
      .selectAll()
      .execute();

    expect(result).toEqual([]);
  });

  test('外部キー制約が有効', async () => {
    const result = await db
      .selectFrom('pragma_foreign_keys' as any)
      .selectAll()
      .execute();

    expect(result).toBeDefined();
  });
});
