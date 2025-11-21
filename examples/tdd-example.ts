/**
 * TDD 実践例: 文字列反転関数
 *
 * この関数は、TDD の Red-Green-Refactor サイクルを実践した例です。
 */

/**
 * 文字列を反転します。
 * @param str - 反転する文字列
 * @returns 反転された文字列
 */
export function reverse(str: string): string {
  return str.split('').reverse().join('');
}
