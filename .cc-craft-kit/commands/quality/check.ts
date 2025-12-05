/**
 * 品質チェック不足検出コマンド
 */

import { QualityMapper } from '../../core/quality/mapper.js';
import type { TriggerPhase } from '../../core/quality/schema.js';
import {
  formatSuccess,
  formatHeading,
  formatInfo,
  formatWarning,
  formatError,
} from '../utils/output.js';
import { handleCLIError } from '../utils/error-handler.js';
import { getSpec } from '../../core/storage/index.js';

/**
 * 品質チェック不足検出
 */
export async function checkQualityRequirements(
  specId?: string,
  options: { color: boolean } = { color: true }
): Promise<void> {
  console.log(formatHeading('Quality Requirements Check', 1, options.color));
  console.log('');

  const mapper = new QualityMapper();

  // 仕様書 ID が指定されている場合、そのフェーズを取得
  let targetPhase: TriggerPhase | null = null;

  if (specId) {
    const spec = getSpec(specId);

    if (!spec) {
      throw new Error(`Spec not found: ${specId}`);
    }

    targetPhase = spec.phase as TriggerPhase;
    console.log(formatInfo(`Checking quality requirements for spec: ${spec.name}`, options.color));
    console.log(formatInfo(`Phase: ${targetPhase}`, options.color));
    console.log('');
  } else {
    console.log(formatInfo('Checking quality requirements for all phases...', options.color));
    console.log('');
  }

  // 品質チェック不足を検出
  let gaps;

  if (targetPhase) {
    const phaseGaps = mapper.detectQualityGaps(targetPhase);
    gaps = new Map<TriggerPhase, typeof phaseGaps>();
    if (phaseGaps.length > 0) {
      gaps.set(targetPhase, phaseGaps);
    }
  } else {
    gaps = mapper.detectAllQualityGaps();
  }

  // 結果表示
  if (gaps.size === 0) {
    console.log(formatSuccess('All quality requirements are satisfied!', options.color));
    console.log('');
    return;
  }

  console.log(
    formatWarning(`Found ${gaps.size} phase(s) with missing quality checks.`, options.color)
  );
  console.log('');

  for (const [phase, phaseGaps] of gaps) {
    console.log(formatHeading(`Phase: ${phase}`, 2, options.color));
    console.log('');

    for (const gap of phaseGaps) {
      console.log(formatError(`  Missing: ${gap.requirementName}`, options.color));
      console.log(formatInfo(`  Type: ${gap.type}`, options.color));
      console.log(formatInfo(`  Description: ${gap.description}`, options.color));
      console.log(formatInfo(`  Template: ${gap.template}`, options.color));
      console.log(formatWarning(`  Reason: ${gap.reason}`, options.color));
      console.log('');
      console.log(
        formatInfo(
          `  Generate: /cft:quality-generate ${gap.type} ${gap.requirementName}`,
          options.color
        )
      );
      console.log('');
    }
  }

  console.log('Next steps:');
  console.log('  1. Generate missing subagents/skills with /cft:quality-generate');
  console.log('  2. Or update .cc-craft-kit/quality-requirements.yaml to remove unneeded checks');
  console.log('');
}

// CLI エントリーポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const specId = args[0];

  checkQualityRequirements(specId, { color: true }).catch((error) => {
    handleCLIError(error);
    process.exit(1);
  });
}
