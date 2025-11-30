/**
 * フェーズ遷移前バリデーター
 *
 * フェーズ遷移前に仕様書の品質をチェックし、
 * 不足情報がある場合は自動補完を促す
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Phase,
  checkRequirementsPhase,
  checkDesignPhase,
  type PlaceholderDetectionResult,
  detectPlaceholders,
} from '../validators/placeholder-detector.js';

/**
 * バリデーション結果
 */
export interface ValidationResult {
  isValid: boolean;
  needsCompletion: boolean;
  placeholders?: PlaceholderDetectionResult;
  missingSections?: string[];
  phase: Phase;
  message?: string;
}

/**
 * フェーズ遷移のバリデーション設定
 */
interface PhaseValidationRule {
  fromPhase: Phase;
  toPhase: Phase;
  validator: (content: string) => string[];
  errorMessage: string;
}

/**
 * フェーズ遷移ルール
 *
 * 各フェーズ遷移時にチェックすべき内容を定義
 */
const PHASE_TRANSITION_RULES: PhaseValidationRule[] = [
  {
    fromPhase: 'requirements',
    toPhase: 'design',
    validator: checkRequirementsPhase,
    errorMessage: 'Requirements フェーズの必須セクションが不足しています。自動補完が必要です。',
  },
  {
    fromPhase: 'design',
    toPhase: 'tasks',
    validator: checkDesignPhase,
    errorMessage: 'Design フェーズの設計詳細セクションが不足しています。自動補完が必要です。',
  },
];

/**
 * フェーズ遷移前のバリデーションを実行
 *
 * @param specId 仕様書ID
 * @param fromPhase 現在のフェーズ
 * @param toPhase 遷移先のフェーズ
 * @param options オプション（force: バリデーションをスキップ）
 * @returns バリデーション結果
 */
export async function validatePhaseTransition(
  specId: string,
  fromPhase: Phase,
  toPhase: Phase,
  options: { force?: boolean; dryRun?: boolean } = {}
): Promise<ValidationResult> {
  // force フラグが指定されている場合はスキップ
  if (options.force) {
    return {
      isValid: true,
      needsCompletion: false,
      phase: toPhase,
      message: 'フェーズ遷移バリデーションをスキップしました（--force フラグが指定されています）',
    };
  }

  // テスト環境ではスキップ
  if (process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true') {
    return {
      isValid: true,
      needsCompletion: false,
      phase: toPhase,
      message: 'テスト環境のため、フェーズ遷移バリデーションをスキップしました',
    };
  }

  // 仕様書ファイルを読み込む
  const specFilePath = join(process.cwd(), '.cc-craft-kit/specs', `${specId}.md`);
  let content: string;
  try {
    content = readFileSync(specFilePath, 'utf-8');
  } catch (error) {
    return {
      isValid: false,
      needsCompletion: false,
      phase: toPhase,
      message: `仕様書ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // 適用されるバリデーションルールを検索
  const rule = PHASE_TRANSITION_RULES.find(
    (r) => r.fromPhase === fromPhase && r.toPhase === toPhase
  );

  if (!rule) {
    // ルールが定義されていない遷移は許可
    return {
      isValid: true,
      needsCompletion: false,
      phase: toPhase,
      message: `${fromPhase} → ${toPhase} の遷移にバリデーションルールは定義されていません`,
    };
  }

  // バリデーターを実行
  const missingSections = rule.validator(content);

  if (missingSections.length > 0) {
    // プレースホルダーを検出
    const placeholders = detectPlaceholders(content, fromPhase);

    return {
      isValid: false,
      needsCompletion: true,
      phase: toPhase,
      missingSections,
      placeholders,
      message: rule.errorMessage,
    };
  }

  // バリデーション成功
  return {
    isValid: true,
    needsCompletion: false,
    phase: toPhase,
    message: `${fromPhase} → ${toPhase} の遷移バリデーションに成功しました`,
  };
}

/**
 * バリデーション結果を表示
 *
 * @param result バリデーション結果
 */
export function displayValidationResult(result: ValidationResult): void {
  if (result.isValid) {
    console.log(`✓ ${result.message}`);
    return;
  }

  console.log(`\n⚠️  ${result.message}\n`);

  if (result.missingSections && result.missingSections.length > 0) {
    console.log('不足しているセクション:');
    for (const section of result.missingSections) {
      console.log(`  - ${section}`);
    }
    console.log();
  }

  if (result.placeholders && result.placeholders.hasPlaceholders) {
    console.log(`検出されたプレースホルダー: ${result.placeholders.placeholders.length} 件`);
    console.log();

    // プレースホルダーを最大5件表示
    const displayCount = Math.min(5, result.placeholders.placeholders.length);
    for (let i = 0; i < displayCount; i++) {
      const p = result.placeholders.placeholders[i];
      console.log(`  - ${p.section} (${p.lineNumber}行目): ${p.placeholder}`);
    }

    if (result.placeholders.placeholders.length > 5) {
      console.log(`  ... 他 ${result.placeholders.placeholders.length - 5} 件`);
    }
    console.log();
  }

  if (result.needsCompletion) {
    console.log('次のステップ:');
    console.log('  1. 自動補完を実行する場合: /cft:spec-phase <spec-id> <phase> --retry');
    console.log('  2. 手動で編集する場合: 仕様書ファイルを編集してから再度実行');
    console.log('  3. バリデーションをスキップする場合: /cft:spec-phase <spec-id> <phase> --force');
    console.log();
  }
}
