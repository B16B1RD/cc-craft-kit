/**
 * 出力フォーマットユーティリティ
 */

export interface OutputOptions {
  format: 'json' | 'table' | 'markdown';
  color: boolean;
}

/**
 * ANSI カラーコード
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * カラーテキストを生成（color オプションが false の場合は色なし）
 */
function colorText(text: string, color: keyof typeof colors, useColor: boolean): string {
  if (!useColor) {
    return text;
  }
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * 表形式で出力
 */
export function formatTable(
  headers: string[],
  rows: string[][],
  options: OutputOptions = { format: 'table', color: true }
): string {
  if (rows.length === 0) {
    return '';
  }

  // 各列の最大幅を計算
  const columnWidths = headers.map((header, i) => {
    const cellWidths = rows.map((row) => (row[i] || '').length);
    return Math.max(header.length, ...cellWidths);
  });

  // ヘッダー行
  const headerRow = headers.map((header, i) => header.padEnd(columnWidths[i])).join(' | ');

  // セパレーター行
  const separator = columnWidths.map((width) => '-'.repeat(width)).join('-+-');

  // データ行
  const dataRows = rows.map((row) =>
    row.map((cell, i) => (cell || '').padEnd(columnWidths[i])).join(' | ')
  );

  const lines = [
    colorText(headerRow, 'bold', options.color),
    colorText(separator, 'gray', options.color),
    ...dataRows,
  ];

  return lines.join('\n');
}

/**
 * JSON 形式で出力
 */
export function formatJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Markdown 形式で出力
 */
export function formatMarkdown(content: string): string {
  return content;
}

/**
 * 成功メッセージをフォーマット
 */
export function formatSuccess(message: string, useColor = true): string {
  const checkmark = useColor ? colorText('✓', 'green', true) : '✓';
  return `${checkmark} ${message}`;
}

/**
 * エラーメッセージをフォーマット
 */
export function formatError(message: string, useColor = true): string {
  const cross = useColor ? colorText('✗', 'red', true) : '✗';
  return `${cross} ${colorText(message, 'red', useColor)}`;
}

/**
 * 警告メッセージをフォーマット
 */
export function formatWarning(message: string, useColor = true): string {
  const warning = useColor ? colorText('⚠', 'yellow', true) : '⚠';
  return `${warning} ${colorText(message, 'yellow', useColor)}`;
}

/**
 * 情報メッセージをフォーマット
 */
export function formatInfo(message: string, useColor = true): string {
  const info = useColor ? colorText('ℹ', 'blue', true) : 'i';
  return `${info} ${colorText(message, 'blue', useColor)}`;
}

/**
 * 見出しをフォーマット
 */
export function formatHeading(text: string, level: 1 | 2 | 3 = 1, useColor = true): string {
  const prefix = '#'.repeat(level);
  return colorText(`${prefix} ${text}`, 'bold', useColor);
}

/**
 * キーバリューペアをフォーマット
 */
export function formatKeyValue(
  key: string,
  value: string | number | boolean | null | undefined,
  useColor = true
): string {
  const formattedKey = colorText(`${key}:`, 'bold', useColor);
  const formattedValue =
    value === null || value === undefined ? colorText('(none)', 'dim', useColor) : String(value);
  return `${formattedKey} ${formattedValue}`;
}

/**
 * リストをフォーマット
 */
export function formatList(items: string[], ordered = false, useColor = true): string {
  return items
    .map((item, index) => {
      const bullet = ordered ? `${index + 1}.` : '•';
      return `  ${colorText(bullet, 'dim', useColor)} ${item}`;
    })
    .join('\n');
}

/**
 * セクションをフォーマット
 */
export function formatSection(
  title: string,
  content: string,
  options: { color?: boolean; spacing?: boolean } = {}
): string {
  const { color = true, spacing = true } = options;
  const lines = [formatHeading(title, 2, color), content];

  if (spacing) {
    lines.push(''); // 空行を追加
  }

  return lines.join('\n');
}

/**
 * コードブロックをフォーマット
 */
export function formatCodeBlock(code: string, language = '', _useColor = true): string {
  const backticks = '```';
  return `${backticks}${language}\n${code}\n${backticks}`;
}

/**
 * 進捗バーをフォーマット
 */
export function formatProgressBar(
  current: number,
  total: number,
  width = 20,
  useColor = true
): string {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;

  const bar =
    colorText('█'.repeat(filled), 'green', useColor) +
    colorText('░'.repeat(empty), 'gray', useColor);
  const percent = `${percentage.toFixed(0)}%`;

  return `[${bar}] ${percent} (${current}/${total})`;
}

/**
 * Markdown テーブルをフォーマット
 */
export function formatMarkdownTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return '';
  }

  // ヘッダー行
  const headerRow = `| ${headers.join(' | ')} |`;

  // セパレーター行
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;

  // データ行
  const dataRows = rows.map((row) => `| ${row.join(' | ')} |`);

  return [headerRow, separator, ...dataRows].join('\n');
}
