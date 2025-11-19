/**
 * Jest グローバルセットアップ
 */
import { getDatabase, closeDatabase } from '../src/core/database/connection.js';
import { migrateToLatest } from '../src/core/database/migrator.js';

// テスト開始前にデータベースマイグレーションを実行
beforeAll(async () => {
  const db = getDatabase();
  await migrateToLatest(db);
});

// テスト後のクリーンアップ
afterAll(async () => {
  await closeDatabase();
});

// テストタイムアウト設定
// jest.setTimeout(10000); // ESM モードでは使用できないためコメントアウト
