/**
 * 環境変数読み込みユーティリティ
 *
 * .env ファイルの値を優先的に読み込みます。
 * すべてのコマンドファイルの先頭で import してください。
 */

import { config } from 'dotenv';

// .env ファイルの値を環境変数より優先する
config({ override: true });
