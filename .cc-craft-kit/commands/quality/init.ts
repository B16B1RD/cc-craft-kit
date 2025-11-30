/**
 * 品質要件定義ファイル初期化コマンド
 */

import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { DEFAULT_QUALITY_REQUIREMENTS_TEMPLATE } from '../../core/quality/schema.js';
import { formatSuccess, formatHeading, formatInfo, formatWarning } from '../utils/output.js';
import { handleCLIError } from '../utils/error-handler.js';

/**
 * 品質要件定義ファイル初期化
 */
export async function initQualityRequirements(options: {
  color: boolean;
  force?: boolean;
}): Promise<void> {
  const cwd = process.cwd();
  const ccCraftKitDir = join(cwd, '.cc-craft-kit');
  const qualityRequirementsPath = join(ccCraftKitDir, 'quality-requirements.yaml');

  console.log(formatHeading('Initializing Quality Requirements', 1, options.color));
  console.log('');

  // .cc-craft-kit/ ディレクトリ存在チェック
  if (!existsSync(ccCraftKitDir)) {
    throw new Error('cc-craft-kit is not initialized. Run /cft:init first.');
  }

  // 既存ファイルチェック
  if (existsSync(qualityRequirementsPath) && !options.force) {
    console.log(formatWarning('Quality requirements file already exists.', options.color));
    console.log(formatInfo(`Path: ${qualityRequirementsPath}`, options.color));
    console.log('');
    console.log('Use --force to overwrite.');
    return;
  }

  // デフォルトテンプレートを YAML として出力
  console.log(formatInfo('Generating quality requirements template...', options.color));

  const yamlContent = yaml.dump(DEFAULT_QUALITY_REQUIREMENTS_TEMPLATE, {
    indent: 2,
    lineWidth: 80,
    noRefs: true,
  });

  writeFileSync(qualityRequirementsPath, yamlContent, 'utf-8');

  console.log('');
  console.log(formatSuccess('Quality requirements file created successfully!', options.color));
  console.log('');
  console.log(formatInfo(`File: ${qualityRequirementsPath}`, options.color));
  console.log('');
  console.log('Next steps:');
  console.log('  1. Edit the quality requirements file');
  console.log('  2. Generate subagents/skills: /cft:quality-generate <type> <name>');
  console.log('  3. Check quality requirements: /cft:quality-check <spec-id>');
  console.log('');
}

// CLI エントリーポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes('--force');

  initQualityRequirements({ color: true, force }).catch((error) => {
    handleCLIError(error);
    process.exit(1);
  });
}
