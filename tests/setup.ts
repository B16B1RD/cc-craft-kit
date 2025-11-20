/**
 * Jest グローバルセットアップ（ユニットテスト用）
 *
 * E2E テストは独自のデータベースセットアップを行うため、
 * このファイルでは通常のユニットテストのみをサポートします。
 */
import { getDatabase, closeDatabase } from '../src/core/database/connection.js';
import { migrateToLatest } from '../src/core/database/migrator.js';

// E2E テスト専用の環境変数でスキップ判定
const isE2ETest = process.env.E2E_TEST === 'true';

// テスト開始前にデータベースマイグレーションを実行
beforeAll(async () => {
  if (isE2ETest) {
    return; // E2E テストは各テストファイルで独自にセットアップ
  }
  const db = getDatabase();
  await migrateToLatest(db);
});

// テスト後のクリーンアップ
afterAll(async () => {
  if (isE2ETest) {
    return; // E2E テストは各テストファイルで独自にクリーンアップ
  }
  await closeDatabase();
});

// テストタイムアウト設定
// jest.setTimeout(10000); // ESM モードでは使用できないためコメントアウト
