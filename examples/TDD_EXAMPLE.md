# TDD 実践例: 文字列の反転関数

この例は、**テスト駆動開発（TDD）** の **Red-Green-Refactor サイクル** を実践した具体例です。

## ファイル構成

- `examples/tdd-example.ts` - 実装コード
- `tests/examples/tdd-example.test.ts` - テストコード
- `examples/TDD_EXAMPLE.md` - この説明文書

---

## Red-Green-Refactor サイクルの実践

### Red フェーズ: 失敗するテストを書く

まず、実装前にテストを書きます。このテストは最初、失敗します。

**テストコード (`tests/examples/tdd-example.test.ts`)**:

```typescript
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
});
```

**テスト実行結果（Red）**:

```bash
npm test tests/examples/tdd-example.test.ts

# ❌ FAIL: Cannot find module '../../examples/tdd-example.js'
```

**Git コミット (Red フェーズ)**:

```bash
git add tests/examples/tdd-example.test.ts
git commit -m "test: add failing test for string reverse"
```

---

### Green フェーズ: テストを通過する最小限のコードを書く

次に、テストを通過させるための最小限の実装をします。

**実装コード (`examples/tdd-example.ts`)**:

```typescript
export function reverse(str: string): string {
  return str.split('').reverse().join('');
}
```

**テスト実行結果（Green）**:

```bash
npm test tests/examples/tdd-example.test.ts

# ✅ PASS: reverse should reverse string
```

**Git コミット (Green フェーズ)**:

```bash
git add examples/tdd-example.ts
git commit -m "feat: implement string reverse to pass test"
```

---

### Refactor フェーズ: コードを改善する

テストが通過した状態で、コードをリファクタリングします。

#### ステップ 1: ドキュメンテーションを追加

```typescript
/**
 * 文字列を反転します。
 * @param str - 反転する文字列
 * @returns 反転された文字列
 */
export function reverse(str: string): string {
  return str.split('').reverse().join('');
}
```

#### ステップ 2: エッジケースのテストを追加

```typescript
describe('reverse', () => {
  it('should reverse string', () => {
    expect(reverse('hello')).toBe('olleh');
  });

  it('should handle empty string', () => {
    expect(reverse('')).toBe('');
  });

  it('should handle single character', () => {
    expect(reverse('a')).toBe('a');
  });
});
```

**テスト実行結果（Green を維持）**:

```bash
npm test tests/examples/tdd-example.test.ts

# ✅ PASS: reverse should reverse string
# ✅ PASS: reverse should handle empty string
# ✅ PASS: reverse should handle single character
```

**Git コミット (Refactor フェーズ)**:

```bash
git add examples/tdd-example.ts tests/examples/tdd-example.test.ts
git commit -m "refactor: add documentation and edge case tests for reverse"
```

---

## Git コミット履歴

TDD の実践では、コミット履歴から **Red-Green-Refactor サイクル** を確認できることが重要です。

```bash
git log --oneline

# 3e4f5a6 refactor: add documentation and edge case tests for reverse
# 2d3c4b5 feat: implement string reverse to pass test
# 1a2b3c4 test: add failing test for string reverse
```

各コミットは以下の役割を持っています。

| コミット | フェーズ | 内容 |
|---|---|---|
| `test: add failing test for string reverse` | **Red** | 失敗するテストを追加 |
| `feat: implement string reverse to pass test` | **Green** | テストを通過する最小限の実装 |
| `refactor: add documentation and edge case tests for reverse` | **Refactor** | ドキュメント追加とエッジケーステスト |

---

## TDD の利点

この例から、TDD の以下の利点が確認できます。

### 1. テストファースト原則

実装前にテストを書くことで、**仕様を明確化** できます。

- テスト: `reverse('hello')` → `'olleh'`
- これにより、関数の期待される動作が明確になる

### 2. 最小限の実装（YAGNI 原則）

テストを通過させるための最小限の実装のみを行います。

```typescript
// ✅ 最小限の実装
export function reverse(str: string): string {
  return str.split('').reverse().join('');
}

// ❌ 過剰な実装（YAGNI 違反）
export function reverse(str: string, options?: { caseSensitive?: boolean }): string {
  // まだ必要ない機能まで実装している
}
```

### 3. リファクタリングの安全性

テストが Green の状態でリファクタリングするため、**デグレードを防止** できます。

- エッジケースのテストを追加
- ドキュメントを追加
- テストが通過し続けることを確認

### 4. ドキュメントとしてのテスト

テストコードが **仕様書として機能** します。

```typescript
it('should reverse string', () => {
  expect(reverse('hello')).toBe('olleh');
});
// → "reverse 関数は文字列を反転する"という仕様が明確
```

---

## まとめ

TDD の Red-Green-Refactor サイクルは、以下の 3 ステップを繰り返すシンプルなプロセスです。

1. **Red**: 失敗するテストを書く
2. **Green**: テストを通過する最小限のコードを書く
3. **Refactor**: コードを改善する

このサイクルを実践することで、テスタブルな設計、リファクタリングの安全性、ドキュメントとしてのテストを実現できます。

**重要なポイント**:

- テストを先に書く（実装前）
- 最小限の実装でテストを通過させる（YAGNI 原則）
- テストが Green の状態でリファクタリングする
- コミットメッセージに Red-Green-Refactor を記録する

このガイドラインに従って、cc-craft-kit プロジェクトで TDD を実践してください。
