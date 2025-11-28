# TDD 実践ガイドライン

このガイドラインは、cc-craft-kit プロジェクトで **テスト駆動開発（TDD）** を実践するための具体的な手順とベストプラクティスを提供します。

## 目次

1. [TDD とは](#tdd-とは)
2. [Red-Green-Refactor サイクル](#red-green-refactor-サイクル)
3. [Jest の使い方](#jest-の使い方)
4. [テストダブル（モック、スタブ、スパイ）](#テストダブルモックスタブスパイ)
5. [AAA パターン](#aaa-パターン)
6. [コミットメッセージ規約](#コミットメッセージ規約)
7. [実践例](#実践例)

---

## TDD とは

**テスト駆動開発（Test-Driven Development: TDD）** は、Kent Beck が提唱した開発手法です。以下の 3 つのステップを繰り返すことで、テストを先に書き、実装を後から行います。

### TDD の 3 原則

1. **Red（失敗するテストを書く）**: 実装前に、期待される動作を検証するテストを書く。このテストは最初、失敗する。
2. **Green（テストを通過する最小限のコードを書く）**: テストを通過させるための最小限の実装する。
3. **Refactor（コードを改善する）**: テストが通過した状態で、コードをリファクタリングして品質を向上させる。

### TDD のメリット

- **設計品質の向上**: テスタブルな設計を自然に導く
- **リファクタリングの安全性**: テストが品質を保証し、安心してコードを改善できる
- **ドキュメントとしてのテスト**: テストコードが仕様書として機能する
- **バグの早期発見**: 実装と同時にテストを書くため、バグを早期に発見できる

---

## Red-Green-Refactor サイクル

TDD の核心は **Red-Green-Refactor サイクル** です。このサイクルを繰り返すことで、高品質なコードを段階的に構築します。

### ステップ 1: Red（失敗するテストを書く）

実装前に、期待される動作を検証するテストを書きます。

```typescript
// tests/utils/calculator.test.ts
import { add } from '../../src/utils/calculator.js';

describe('add', () => {
  it('should return sum of two numbers', () => {
    // Arrange（準備）
    const a = 2;
    const b = 3;

    // Act（実行）
    const result = add(a, b);

    // Assert（検証）
    expect(result).toBe(5);
  });
});
```

**テスト実行（Red）**:

```bash
npm test

# ❌ FAIL: add is not defined
```

### ステップ 2: Green（テストを通過する最小限のコードを書く）

テストを通過させるための最小限の実装をします。

```typescript
// src/utils/calculator.ts
export function add(a: number, b: number): number {
  return a + b;
}
```

**テスト実行（Green）**:

```bash
npm test

# ✅ PASS: add should return sum of two numbers
```

### ステップ 3: Refactor（コードを改善する）

テストが通過した状態で、コードをリファクタリングします。

```typescript
// src/utils/calculator.ts
/**
 * 2 つの数値を加算します。
 * @param a - 第 1 オペランド
 * @param b - 第 2 オペランド
 * @returns 加算結果
 */
export function add(a: number, b: number): number {
  return a + b;
}
```

**テスト実行（Green を維持）**:

```bash
npm test

# ✅ PASS: add should return sum of two numbers
```

---

## Jest の使い方

cc-craft-kit では **Jest** をテストランナーとして使用します。

### 基本的な使い方

#### テストファイルの作成

テストファイルは `tests/` ディレクトリに、`src/` と同じディレクトリ構造で配置します。

```text
src/
  utils/
    calculator.ts         # 実装
tests/
  utils/
    calculator.test.ts    # テスト
```

#### テストの構造

```typescript
// Jest では describe, it, expect などはグローバルに利用可能

describe('テスト対象の関数名またはクラス名', () => {
  // テストの前処理
  beforeEach(() => {
    // 各テストの前に実行される
  });

  // テストの後処理
  afterEach(() => {
    // 各テストの後に実行される
  });

  describe('正常系', () => {
    it('should [期待される動作]', () => {
      // Arrange（準備）
      const input = 'valid input';

      // Act（実行）
      const result = functionName(input);

      // Assert（検証）
      expect(result).toBe('expected value');
    });
  });

  describe('異常系', () => {
    it('should throw error when [異常な条件]', () => {
      // Arrange
      const invalidInput = null;

      // Act & Assert
      expect(() => functionName(invalidInput)).toThrow('Error message');
    });
  });

  describe('エッジケース', () => {
    it('should handle [エッジケース] correctly', () => {
      // Arrange
      const edgeInput = '';

      // Act
      const result = functionName(edgeInput);

      // Assert
      expect(result).toBe('');
    });
  });
});
```

#### テストの実行

```bash
# すべてのテストを実行
npm test

# ウォッチモード（ファイル変更時に自動実行）
npm run test:watch

# カバレッジレポート生成
npm run test:coverage
```

#### アサーション API

```typescript
// 等価性チェック
expect(value).toBe(expected);                // 厳密等価（===）
expect(value).toEqual(expected);             // 深い等価性チェック

// 真偽値チェック
expect(value).toBeTruthy();                  // truthy な値
expect(value).toBeFalsy();                   // falsy な値
expect(value).toBeNull();                    // null
expect(value).toBeUndefined();               // undefined

// 数値チェック
expect(value).toBeGreaterThan(10);           // > 10
expect(value).toBeLessThan(10);              // < 10
expect(value).toBeCloseTo(0.3, 5);           // 浮動小数点の近似比較

// 文字列チェック
expect(value).toMatch(/pattern/);            // 正規表現マッチ
expect(value).toContain('substring');        // 部分文字列を含む

// 配列・オブジェクトチェック
expect(array).toContain(item);               // 配列に要素を含む
expect(object).toHaveProperty('key');        // プロパティを持つ

// 例外チェック
expect(() => fn()).toThrow();                // 例外をスロー
expect(() => fn()).toThrow('Error message'); // 特定のメッセージ
```

---

## テストダブル（モック、スタブ、スパイ）

外部依存を持つコードのテストには、**テストダブル** を使用します。

### モック（Mock）

関数呼び出しの検証に使用します。

```typescript
describe('Database integration', () => {
  it('should call database insert method', async () => {
    // Arrange: モックデータベースを作成
    const mockDb = {
      insertInto: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          execute: jest.fn().mockResolvedValue({ id: 1 }),
        }),
      }),
    };

    // Act: テスト対象の関数を実行
    await insertSpec(mockDb, { name: 'test' });

    // Assert: モック関数が正しく呼び出されたか検証
    expect(mockDb.insertInto).toHaveBeenCalledWith('specs');
    expect(mockDb.insertInto).toHaveBeenCalledTimes(1);
  });
});
```

### スタブ（Stub）

固定値を返すモックです。

```typescript
describe('API client', () => {
  it('should return user data', async () => {
    // Arrange: スタブを作成（固定値を返す）
    const fetchStub = jest.fn().mockResolvedValue({
      json: async () => ({ id: 1, name: 'John' }),
    });
    global.fetch = fetchStub;

    // Act
    const user = await fetchUser(1);

    // Assert
    expect(user).toEqual({ id: 1, name: 'John' });
  });
});
```

### スパイ（Spy）

元の実装を保持しつつ、呼び出しを監視します。

```typescript
import * as utils from '../../src/utils/logger.js';

describe('Logger spy', () => {
  it('should log message', () => {
    // Arrange: スパイを作成
    const logSpy = jest.spyOn(utils, 'log');

    // Act
    utils.log('Test message');

    // Assert: 呼び出しを検証
    expect(logSpy).toHaveBeenCalledWith('Test message');
    expect(logSpy).toHaveBeenCalledTimes(1);

    // Cleanup: スパイをリストア
    logSpy.mockRestore();
  });
});
```

### モックの使い分け

| テストダブル | 用途 | Jest の機能 |
|---|---|---|
| **モック（Mock）** | 関数呼び出しの検証 | `jest.fn()`, `jest.mock()` |
| **スタブ（Stub）** | 固定値を返す | `jest.fn().mockReturnValue()` |
| **スパイ（Spy）** | 元の実装を保持しつつ監視 | `jest.spyOn()` |

---

## AAA パターン

すべてのテストは **AAA パターン（Arrange-Act-Assert）** に従って記述します。

### Arrange（準備）

テストデータとモックを準備します。

```typescript
// Arrange
const input = 'test input';
const mockDb = jest.fn();
```

### Act（実行）

テスト対象の関数を実行します。

```typescript
// Act
const result = functionName(input);
```

### Assert（検証）

期待値と実際の結果を比較します。

```typescript
// Assert
expect(result).toBe('expected value');
```

### AAA パターンの完全な例

```typescript
describe('calculateTotal', () => {
  it('should return total price with tax', () => {
    // Arrange（準備）
    const price = 1000;
    const taxRate = 0.1;

    // Act（実行）
    const total = calculateTotal(price, taxRate);

    // Assert（検証）
    expect(total).toBe(1100);
  });
});
```

---

## コミットメッセージ規約

TDD 実践では、コミットメッセージに **Red-Green-Refactor のサイクル** を記録します。

### Red フェーズ

失敗するテストを追加したコミット。

```bash
test: add failing test for user authentication

- Add test case for valid user login
- Expect authentication to return user token
```

### Green フェーズ

テストを通過させる実装を追加したコミット。

```bash
feat: implement user authentication to pass test

- Add authentication logic
- Return user token on successful login
- All tests now pass
```

### Refactor フェーズ

コードをリファクタリングしたコミット。

```bash
refactor: simplify authentication logic

- Extract token generation to separate function
- Improve variable naming
- Remove duplicate code
- All tests still pass
```

### コミットメッセージの形式

```text
<type>: <subject>

<body>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Type**:

- `test`: テストコード追加・修正（Red フェーズ）
- `feat`: 新機能追加（Green フェーズ）
- `refactor`: リファクタリング（Refactor フェーズ）
- `fix`: バグ修正
- `docs`: ドキュメント変更

---

## 実践例

### 例 1: 文字列の反転関数の TDD

#### Red フェーズ: 失敗するテストを書く

```typescript
// tests/utils/string.test.ts
import { reverse } from '../../src/utils/string.js';

describe('reverse', () => {
  it('should reverse string', () => {
    // Arrange
    const input = 'hello';

    // Act
    const result = reverse(input);

    // Assert
    expect(result).toBe('olleh');
  });
});
```

**テスト実行**:

```bash
npm test
# ❌ FAIL: reverse is not defined
```

**コミット**:

```bash
git add tests/utils/string.test.ts
git commit -m "test: add failing test for string reverse"
```

#### Green フェーズ: テストを通過させる最小限の実装

```typescript
// src/utils/string.ts
export function reverse(str: string): string {
  return str.split('').reverse().join('');
}
```

**テスト実行**:

```bash
npm test
# ✅ PASS: reverse should reverse string
```

**コミット**:

```bash
git add src/utils/string.ts
git commit -m "feat: implement string reverse to pass test"
```

#### Refactor フェーズ: コードを改善

```typescript
// src/utils/string.ts
/**
 * 文字列を反転します。
 * @param str - 反転する文字列
 * @returns 反転された文字列
 * @example
 * reverse('hello') // => 'olleh'
 */
export function reverse(str: string): string {
  if (!str) return '';
  return str.split('').reverse().join('');
}
```

**テスト追加（エッジケース）**:

```typescript
// tests/utils/string.test.ts
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

**テスト実行**:

```bash
npm test
# ✅ PASS: all tests pass
```

**コミット**:

```bash
git add src/utils/string.ts tests/utils/string.test.ts
git commit -m "refactor: improve reverse function with edge cases"
```

---

### 例 2: データベース統合のテスト

#### Red フェーズ: 失敗するテストを書く

```typescript
// tests/database/spec-repository.test.ts
import { createSpec } from '../../src/database/spec-repository.js';

describe('createSpec', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      insertInto: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          execute: jest.fn().mockResolvedValue({ id: '123' }),
        }),
      }),
    };
  });

  it('should insert spec into database', async () => {
    // Arrange
    const spec = {
      name: 'Test Spec',
      description: 'Test Description',
      phase: 'requirements',
    };

    // Act
    const result = await createSpec(mockDb, spec);

    // Assert
    expect(mockDb.insertInto).toHaveBeenCalledWith('specs');
    expect(result.id).toBe('123');
  });
});
```

**テスト実行**:

```bash
npm test
# ❌ FAIL: createSpec is not defined
```

**コミット**:

```bash
git add tests/database/spec-repository.test.ts
git commit -m "test: add failing test for createSpec"
```

#### Green フェーズ: テストを通過させる実装

```typescript
// src/database/spec-repository.ts
export async function createSpec(db: any, spec: any) {
  const result = await db
    .insertInto('specs')
    .values(spec)
    .execute();
  return result;
}
```

**テスト実行**:

```bash
npm test
# ✅ PASS: createSpec should insert spec into database
```

**コミット**:

```bash
git add src/database/spec-repository.ts
git commit -m "feat: implement createSpec to pass test"
```

#### Refactor フェーズ: 型定義を追加

```typescript
// src/database/spec-repository.ts
import type { Kysely } from 'kysely';
import type { Database } from './schema.js';

export interface SpecInput {
  name: string;
  description: string;
  phase: 'requirements' | 'design' | 'tasks' | 'implementation' | 'completed';
}

export async function createSpec(
  db: Kysely<Database>,
  spec: SpecInput
): Promise<{ id: string }> {
  const result = await db
    .insertInto('specs')
    .values(spec)
    .execute();
  return result;
}
```

**テスト実行**:

```bash
npm test
# ✅ PASS: all tests pass
```

**コミット**:

```bash
git add src/database/spec-repository.ts
git commit -m "refactor: add type definitions to createSpec"
```

---

## まとめ

TDD は以下の 3 ステップを繰り返すシンプルな開発プロセスです。

1. **Red**: 失敗するテストを書く
2. **Green**: テストを通過する最小限のコードを書く
3. **Refactor**: コードを改善する

TDD を実践することで、テスタブルな設計、リファクタリングの安全性、ドキュメントとしてのテストを実現できます。

**重要なポイント**:

- テストを先に書く（実装前）
- 最小限の実装でテストを通過させる（YAGNI 原則）
- テストが Green の状態でリファクタリングする
- コミットメッセージに Red-Green-Refactor を記録する

このガイドラインに従って、cc-craft-kit プロジェクトで TDD を実践してください。
