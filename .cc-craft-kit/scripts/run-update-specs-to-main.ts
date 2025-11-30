#!/usr/bin/env tsx

/**
 * データベース内のすべての仕様書の branch_name を main に更新するCLIスクリプト
 */

import {
  verifySpecsBeforeUpdate,
  updateAllSpecsToMain,
  verifyAllSpecsOnMain,
} from './update-specs-to-main.js';

const mode = process.argv[2] || 'update';

if (mode === 'dry-run') {
  console.log('dry-run モード: 更新対象の仕様書を確認します\n');
  await verifySpecsBeforeUpdate();
} else if (mode === 'update') {
  console.log('更新モード: すべての仕様書のブランチを main に更新します\n');
  await verifySpecsBeforeUpdate();
  console.log('');
  await updateAllSpecsToMain();
  console.log('');
  await verifyAllSpecsOnMain();
} else if (mode === 'verify') {
  console.log('検証モード: すべての仕様書が main になっているか確認します\n');
  await verifyAllSpecsOnMain();
} else {
  console.error(`無効なモード: ${mode}`);
  console.error(
    '使用方法: npx tsx src/scripts/run-update-specs-to-main.ts [dry-run|update|verify]'
  );
  process.exit(1);
}
