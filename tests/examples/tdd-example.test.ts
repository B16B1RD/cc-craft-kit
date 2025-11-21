/**
 * TDD 実践例: 文字列反転関数
 *
 * このテストは、TDD の Red-Green-Refactor サイクルを実践した例です。
 */

import { reverse } from '../../examples/tdd-example.js';

describe('reverse', () => {
  it('should reverse string', () => {
    // Arrange（準備）
    const input = 'hello';

    // Act（実行）
    const result = reverse(input);

    // Assert（検証）
    expect(result).toBe('olleh');
  });

  it('should handle empty string', () => {
    // Arrange
    const input = '';

    // Act
    const result = reverse(input);

    // Assert
    expect(result).toBe('');
  });

  it('should handle single character', () => {
    // Arrange
    const input = 'a';

    // Act
    const result = reverse(input);

    // Assert
    expect(result).toBe('a');
  });
});
