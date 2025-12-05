/**
 * Jest グローバルセットアップ（ユニットテスト用）
 *
 * JSON ストレージベースのテスト環境をセットアップします。
 */
import path from 'path';
import fs from 'fs';
import { ensureMetaDir } from '../src/core/storage/index.js';

// E2E テスト専用の環境変数でスキップ判定
const isE2ETest = process.env.E2E_TEST === 'true';

// テスト専用ストレージディレクトリを設定
if (!isE2ETest) {
  const testStorageDir = path.join(process.cwd(), '.cc-craft-kit-test');
  if (!fs.existsSync(testStorageDir)) {
    fs.mkdirSync(testStorageDir, { recursive: true });
  }
  process.env.CC_CRAFT_KIT_DIR = testStorageDir;
}

// テスト開始前に JSON ストレージを初期化
beforeAll(async () => {
  if (isE2ETest) {
    return; // E2E テストは各テストファイルで独自にセットアップ
  }
  ensureMetaDir();
});

// テスト後のクリーンアップ
afterAll(async () => {
  if (isE2ETest) {
    return; // E2E テストは各テストファイルで独自にクリーンアップ
  }
  // JSON ストレージはクリーンアップ不要（ファイルベース）
});
