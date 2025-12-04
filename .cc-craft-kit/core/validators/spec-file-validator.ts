/**
 * 仕様書ファイルメタデータバリデーター
 *
 * 仕様書ファイルのメタデータ形式を検証し、必要に応じて自動修正する
 */

import { readFileSync, writeFileSync } from 'node:fs';

/**
 * 仕様書メタデータ
 */
export interface SpecMetadata {
  id: string;
  name: string;
  phase: 'requirements' | 'design' | 'tasks' | 'implementation' | 'review' | 'completed';
  createdAt: string;
  updatedAt: string;
  description?: string;
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: SpecMetadata | null;
}

/**
 * 仕様書ファイルからメタデータを抽出
 */
export function parseSpecFile(content: string): SpecMetadata | null {
  const lines = content.split('\n');

  // タイトル（1行目）
  const titleMatch = lines[0]?.match(/^# (.+)$/);
  if (!titleMatch) return null;
  const name = titleMatch[1];

  // メタデータ行を探す
  let id = '';
  let phase = '';
  let createdAt = '';
  let updatedAt = '';

  for (const line of lines) {
    // 仕様書 ID（スペース+コロン）最初のマッチのみ
    if (!id) {
      const idMatch = line.match(/^\*\*仕様書 ID:\*\* ([0-9a-f-]+)\s*$/i);
      if (idMatch) id = idMatch[1];
    }

    // フェーズ - 最初のマッチのみ
    if (!phase) {
      const phaseMatch = line.match(/^\*\*フェーズ:\*\* (\w+)\s*$/);
      if (phaseMatch) phase = phaseMatch[1];
    }

    // 作成日時 - 最初のマッチのみ
    if (!createdAt) {
      const createdMatch = line.match(/^\*\*作成日時:\*\* (.+)\s*$/);
      if (createdMatch) createdAt = createdMatch[1].trim();
    }

    // 更新日時 - 最初のマッチのみ
    if (!updatedAt) {
      const updatedMatch = line.match(/^\*\*更新日時:\*\* (.+)\s*$/);
      if (updatedMatch) updatedAt = updatedMatch[1].trim();
    }
  }

  if (!id || !phase || !createdAt || !updatedAt) {
    return null;
  }

  // 背景セクションから説明を抽出
  const backgroundIndex = lines.findIndex((line) => line.includes('### 背景'));
  let description = '';
  if (backgroundIndex !== -1) {
    // 背景の次の行から、次のセクションまでを取得
    for (let i = backgroundIndex + 2; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#') || line.startsWith('**')) break;
      if (line.trim()) {
        description = line.trim();
        break;
      }
    }
  }

  return {
    id,
    name,
    phase: phase as SpecMetadata['phase'],
    createdAt,
    updatedAt,
    description: description || `${name}の仕様書`,
  };
}

/**
 * メタデータを検証
 */
export function validateMetadata(metadata: SpecMetadata): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // UUID形式のチェック
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(metadata.id)) {
    errors.push(`Invalid UUID format: ${metadata.id}`);
  }

  // フェーズのチェック
  const validPhases = ['requirements', 'design', 'tasks', 'implementation', 'review', 'completed'];
  if (!validPhases.includes(metadata.phase)) {
    errors.push(`Invalid phase: ${metadata.phase}`);
  }

  // 日時形式のチェック (YYYY/MM/DD HH:MM:SS)
  const dateTimeRegex = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/;

  if (!dateTimeRegex.test(metadata.createdAt)) {
    errors.push(`Invalid createdAt format: ${metadata.createdAt} (expected: YYYY/MM/DD HH:MM:SS)`);
  }

  if (!dateTimeRegex.test(metadata.updatedAt)) {
    errors.push(`Invalid updatedAt format: ${metadata.updatedAt} (expected: YYYY/MM/DD HH:MM:SS)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    metadata,
  };
}

/**
 * ファイルのメタデータを検証
 */
export function validateSpecFile(filePath: string): ValidationResult {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const metadata = parseSpecFile(content);

    if (!metadata) {
      return {
        isValid: false,
        errors: ['Failed to parse spec file metadata'],
        warnings: [],
        metadata: null,
      };
    }

    return validateMetadata(metadata);
  } catch (error) {
    return {
      isValid: false,
      errors: [`Failed to read file: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      metadata: null,
    };
  }
}

/**
 * 不正なメタデータを自動修正
 */
export function fixSpecFileMetadata(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8');
    let fixed = content;

    // 1. フィールド名の修正（スペースなし → スペースあり）
    // パターン1: **仕様書ID**: (太字の後にコロン)
    fixed = fixed.replace(/\*\*仕様書ID:\*\*/g, '**仕様書 ID:**');
    fixed = fixed.replace(/\*\*仕様書Id:\*\*/g, '**仕様書 ID:**');
    // パターン2: **仕様書ID**: (太字の中にIDのみ、コロンは外)
    fixed = fixed.replace(/\*\*仕様書ID\*\*:/g, '**仕様書 ID:**');
    fixed = fixed.replace(/\*\*仕様書Id\*\*:/g, '**仕様書 ID:**');

    // 2. 日時形式の修正（時刻情報がない場合は 00:00:00 を追加）
    // パターン1: **作成日**: YYYY/MM/DD (太字の後にコロン)
    fixed = fixed.replace(
      /\*\*作成日:\*\* (\d{4}\/\d{2}\/\d{2})\s*$/gm,
      '**作成日時:** $1 00:00:00'
    );
    // パターン2: **作成日**: YYYY/MM/DD (太字の中に「作成日」のみ)
    fixed = fixed.replace(
      /\*\*作成日\*\*:\s*(\d{4}\/\d{2}\/\d{2})\s*$/gm,
      '**作成日時:** $1 00:00:00'
    );

    // 更新日 → 更新日時
    // パターン1: **更新日**: YYYY/MM/DD (太字の後にコロン)
    fixed = fixed.replace(
      /\*\*更新日:\*\* (\d{4}\/\d{2}\/\d{2})\s*$/gm,
      '**更新日時:** $1 00:00:00'
    );
    // パターン2: **更新日**: YYYY/MM/DD (太字の中に「更新日」のみ)
    fixed = fixed.replace(
      /\*\*更新日\*\*:\s*(\d{4}\/\d{2}\/\d{2})\s*$/gm,
      '**更新日時:** $1 00:00:00'
    );

    // 3. フェーズのコロン修正
    // パターン1: **フェーズ**: (太字の後にコロン)
    fixed = fixed.replace(/\*\*フェーズ:\*\*/g, '**フェーズ:**');
    // パターン2: **フェーズ**: (太字の中に「フェーズ」のみ)
    fixed = fixed.replace(/\*\*フェーズ\*\*:/g, '**フェーズ:**');

    // 4. 時刻の先頭ゼロパディング修正（YYYY/MM/DD H:MM:SS → YYYY/MM/DD HH:MM:SS）
    fixed = fixed.replace(
      /(\*\*(?:作成|更新)日時:\*\*\s+\d{4}\/\d{2}\/\d{2}\s+)(\d):(\d{2}):(\d{2})/g,
      (_match, prefix, hour, minute, second) => {
        return `${prefix}${hour.padStart(2, '0')}:${minute}:${second}`;
      }
    );

    // 変更があった場合のみ書き込み
    if (fixed !== content) {
      writeFileSync(filePath, fixed, 'utf-8');
      console.log(`✓ Fixed metadata in ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Failed to fix metadata in ${filePath}:`, error);
    return false;
  }
}

/**
 * 日時文字列をISO形式に変換
 */
export function parseDateTime(dateStr: string): string {
  // "2025/11/18 21:54:20" -> "2025-11-18T21:54:20Z"
  const match = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    console.warn(`Invalid date format: ${dateStr}, using current time`);
    return new Date().toISOString();
  }

  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}
