/**
 * 仕様書メタデータ管理
 *
 * specs.json ファイルを読み書きし、仕様書メタデータを管理します。
 */

import { randomUUID } from 'node:crypto';
import { readJsonFile, writeJsonFile, getJsonFilePath } from './json-storage.js';
import { SpecDataSchema, SpecsFileSchema, type SpecData, type SpecPhase } from './schemas.js';

const SPECS_FILE = 'specs.json';

/**
 * 仕様書ファイルパスを取得
 */
function getSpecsFilePath(baseDir?: string): string {
  return getJsonFilePath(SPECS_FILE, baseDir);
}

/**
 * すべての仕様書を読み込む
 */
export function loadSpecs(baseDir?: string): SpecData[] {
  const filePath = getSpecsFilePath(baseDir);
  const data = readJsonFile<SpecData>(filePath);

  // バリデーション
  const result = SpecsFileSchema.safeParse(data);
  if (!result.success) {
    console.warn(`Warning: Invalid data in ${filePath}:`, result.error.issues);
    // 有効なデータのみをフィルタリング
    return data.filter((item) => SpecDataSchema.safeParse(item).success);
  }

  return result.data;
}

/**
 * すべての仕様書を保存する
 */
export function saveSpecs(specs: SpecData[], baseDir?: string): void {
  const filePath = getSpecsFilePath(baseDir);

  // 保存前にバリデーション
  const result = SpecsFileSchema.safeParse(specs);
  if (!result.success) {
    throw new Error(`Invalid specs data: ${result.error.message}`);
  }

  writeJsonFile(filePath, result.data);
}

/**
 * 仕様書を ID で取得
 */
export function getSpec(id: string, baseDir?: string): SpecData | undefined {
  const specs = loadSpecs(baseDir);
  return specs.find((s) => s.id === id);
}

/**
 * 仕様書を ID プレフィックスで検索
 *
 * @param idPrefix ID の先頭部分（最低 8 文字推奨）
 * @returns 一致した仕様書（複数の場合は undefined）
 */
export function findSpecByIdPrefix(idPrefix: string, baseDir?: string): SpecData | undefined {
  const specs = loadSpecs(baseDir);
  const matches = specs.filter((s) => s.id.startsWith(idPrefix));

  if (matches.length === 1) {
    return matches[0];
  }

  return undefined;
}

/**
 * 新しい仕様書を追加
 */
export function addSpec(
  spec: Omit<SpecData, 'id' | 'created_at' | 'updated_at'>,
  baseDir?: string
): SpecData {
  const specs = loadSpecs(baseDir);
  const now = new Date().toISOString();

  const newSpec: SpecData = {
    id: randomUUID(),
    ...spec,
    created_at: now,
    updated_at: now,
  };

  // バリデーション
  SpecDataSchema.parse(newSpec);

  specs.push(newSpec);
  saveSpecs(specs, baseDir);

  return newSpec;
}

/**
 * 仕様書を更新
 */
export function updateSpec(
  id: string,
  updates: Partial<Omit<SpecData, 'id' | 'created_at'>>,
  baseDir?: string
): SpecData | undefined {
  const specs = loadSpecs(baseDir);
  const index = specs.findIndex((s) => s.id === id);

  if (index === -1) {
    return undefined;
  }

  const updatedSpec: SpecData = {
    ...specs[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // バリデーション
  SpecDataSchema.parse(updatedSpec);

  specs[index] = updatedSpec;
  saveSpecs(specs, baseDir);

  return updatedSpec;
}

/**
 * 仕様書を削除
 */
export function deleteSpec(id: string, baseDir?: string): boolean {
  const specs = loadSpecs(baseDir);
  const index = specs.findIndex((s) => s.id === id);

  if (index === -1) {
    return false;
  }

  specs.splice(index, 1);
  saveSpecs(specs, baseDir);

  return true;
}

/**
 * フェーズで仕様書をフィルタリング
 */
export function getSpecsByPhase(phase: SpecPhase, baseDir?: string): SpecData[] {
  const specs = loadSpecs(baseDir);
  return specs.filter((s) => s.phase === phase);
}

/**
 * 仕様書のフェーズを更新
 */
export function updateSpecPhase(
  id: string,
  phase: SpecPhase,
  baseDir?: string
): SpecData | undefined {
  return updateSpec(id, { phase }, baseDir);
}

/**
 * 仕様書の数を取得
 */
export function countSpecs(baseDir?: string): number {
  const specs = loadSpecs(baseDir);
  return specs.length;
}
