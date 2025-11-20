/**
 * 日時フォーマットユーティリティ
 *
 * 仕様書ファイルの日時形式を統一するためのヘルパー関数
 */

/**
 * ISO 8601 形式の日時を仕様書用の日時形式に変換
 *
 * @param isoDateTime ISO 8601 形式の日時文字列 (例: "2025-11-20T12:34:56.789Z")
 * @returns 仕様書用の日時形式 (YYYY/MM/DD HH:MM:SS)
 *
 * @example
 * formatDateTimeForSpec(new Date().toISOString())
 * // => "2025/11/20 12:34:56"
 */
export function formatDateTimeForSpec(isoDateTime: string): string {
  const date = new Date(isoDateTime);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 現在時刻を仕様書用の日時形式で取得
 *
 * @returns 仕様書用の日時形式 (YYYY/MM/DD HH:MM:SS)
 *
 * @example
 * getCurrentDateTimeForSpec()
 * // => "2025/11/20 12:34:56"
 */
export function getCurrentDateTimeForSpec(): string {
  return formatDateTimeForSpec(new Date().toISOString());
}
