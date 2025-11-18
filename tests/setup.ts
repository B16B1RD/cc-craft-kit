/**
 * Jest グローバルセットアップ
 */
import { closeDatabase } from '../src/core/database/connection.js';

// テスト後のクリーンアップ
afterAll(async () => {
  await closeDatabase();
});

// テストタイムアウト設定
// jest.setTimeout(10000); // ESM モードでは使用できないためコメントアウト
