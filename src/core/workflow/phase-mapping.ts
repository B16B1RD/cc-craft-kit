/**
 * フェーズ省略形マッピング
 *
 * ユーザーフレンドリーなフェーズ名の省略形をサポートします。
 * 例: req → requirements, impl → implementation
 */

import type { SpecPhase } from '../storage/index.js';

/**
 * フェーズの省略形マッピング
 */
export const PHASE_ALIASES: Record<string, SpecPhase> = {
  // requirements の省略形
  req: 'requirements',
  reqs: 'requirements',

  // design の省略形
  des: 'design',

  // tasks の省略形
  task: 'tasks',

  // implementation の省略形
  impl: 'implementation',
  imp: 'implementation', // 後方互換性のため保持

  // review の省略形
  rev: 'review',

  // completed の省略形
  comp: 'completed',
  done: 'completed',
} as const;

/**
 * 入力されたフェーズ名を正規化
 *
 * 省略形が入力された場合は完全形に変換し、
 * そうでない場合はそのまま返します。
 *
 * @param input - ユーザー入力のフェーズ名（省略形または完全形）
 * @returns 正規化されたフェーズ名
 *
 * @example
 * ```typescript
 * normalizePhase('req') // => 'requirements'
 * normalizePhase('requirements') // => 'requirements'
 * normalizePhase('IMPL') // => 'implementation'
 * normalizePhase('  design  ') // => 'design'
 * ```
 */
export function normalizePhase(input: string): string {
  const normalized = input.toLowerCase().trim();
  return PHASE_ALIASES[normalized] ?? normalized;
}

/**
 * フェーズ省略形のヘルプメッセージを生成
 *
 * ユーザーに利用可能な省略形を案内します。
 *
 * @returns フェーズ省略形のヘルプメッセージ
 *
 * @example
 * ```typescript
 * console.log(getPhaseAliasesHelp());
 * // Available phase abbreviations:
 * //   req, reqs → requirements
 * //   des → design
 * //   task → tasks
 * //   impl, imp → implementation
 * //   comp, done → completed
 * ```
 */
export function getPhaseAliasesHelp(): string {
  const aliasGroups: Record<SpecPhase, string[]> = {
    requirements: [],
    design: [],
    tasks: [],
    implementation: [],
    review: [],
    completed: [],
  };

  // 省略形をフェーズごとにグループ化
  for (const [alias, phase] of Object.entries(PHASE_ALIASES)) {
    aliasGroups[phase].push(alias);
  }

  // ヘルプメッセージを構築
  const lines = ['Available phase abbreviations:'];
  for (const [phase, aliases] of Object.entries(aliasGroups)) {
    if (aliases.length > 0) {
      lines.push(`  ${aliases.join(', ')} → ${phase}`);
    }
  }

  return lines.join('\n');
}
