/**
 * phase-transition-validator.ts のテスト
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validatePhaseTransition } from '../../../src/core/workflow/phase-transition-validator.js';

describe('phase-transition-validator', () => {
  const testDir = join(process.cwd(), '.cc-craft-kit/specs');
  const testSpecId = '12345678-1234-4abc-8def-123456789012';
  const testFilePath = join(testDir, `${testSpecId}.md`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testFilePath)) {
      rmSync(testFilePath, { force: true });
    }
  });

  describe('validatePhaseTransition', () => {
    test('force フラグが指定されている場合、バリデーションをスキップ', async () => {
      // 仕様書ファイルを作成（不完全な内容）
      const content = `# テスト仕様書

**仕様書 ID:** ${testSpecId}
**フェーズ:** requirements

## 1. 背景と目的

(背景を記述してください)
`;
      writeFileSync(testFilePath, content, 'utf-8');

      const result = await validatePhaseTransition(
        testSpecId,
        'requirements',
        'design',
        { force: true }
      );

      expect(result.isValid).toBe(true);
      expect(result.needsCompletion).toBe(false);
      expect(result.message).toContain('--force');
    });

    test('テスト環境ではバリデーションをスキップ', async () => {
      // 環境変数を設定
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      try {
        const result = await validatePhaseTransition(
          testSpecId,
          'requirements',
          'design'
        );

        expect(result.isValid).toBe(true);
        expect(result.needsCompletion).toBe(false);
        expect(result.message).toContain('テスト環境');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('仕様書ファイルが存在しない場合、エラーを返す', async () => {
      // force フラグなしで実行するため、環境変数を一時的に変更
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      try {
        const result = await validatePhaseTransition(
          'nonexistent-spec-id',
          'requirements',
          'design'
        );

        expect(result.isValid).toBe(false);
        expect(result.needsCompletion).toBe(false);
        expect(result.message).toContain('読み込みに失敗');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('バリデーションルールが定義されていない遷移は許可', async () => {
      // 仕様書ファイルを作成
      const content = `# テスト仕様書

**仕様書 ID:** ${testSpecId}
**フェーズ:** tasks
`;
      writeFileSync(testFilePath, content, 'utf-8');

      // force フラグなしで実行するため、環境変数を一時的に変更
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      try {
        // tasks → implementation の遷移（ルール未定義）
        const result = await validatePhaseTransition(
          testSpecId,
          'tasks',
          'implementation'
        );

        expect(result.isValid).toBe(true);
        expect(result.needsCompletion).toBe(false);
        expect(result.message).toContain('バリデーションルールは定義されていません');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('requirements → design の遷移で必須セクションが不足している場合、補完が必要', async () => {
      // 不完全な仕様書ファイルを作成
      const content = `# テスト仕様書

**仕様書 ID:** ${testSpecId}
**フェーズ:** requirements

## 1. 背景と目的

(背景を記述してください)

## 2. 対象ユーザー

(対象ユーザーを記述してください)
`;
      writeFileSync(testFilePath, content, 'utf-8');

      // force フラグなしで実行するため、環境変数を一時的に変更
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      try {
        const result = await validatePhaseTransition(
          testSpecId,
          'requirements',
          'design'
        );

        expect(result.isValid).toBe(false);
        expect(result.needsCompletion).toBe(true);
        expect(result.missingSections).toBeDefined();
        expect(result.missingSections!.length).toBeGreaterThan(0);
        expect(result.placeholders).toBeDefined();
        expect(result.placeholders!.hasPlaceholders).toBe(true);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('requirements → design の遷移ですべての必須セクションが記述されている場合、成功', async () => {
      // 完全な仕様書ファイルを作成
      const content = `# テスト仕様書

**仕様書 ID:** ${testSpecId}
**フェーズ:** requirements

## 1. 背景と目的

### 背景

この機能は既存のシステムを改善するために必要です。

### 目的

ユーザーの利便性を向上させることを目的とします。

## 2. 対象ユーザー

開発者向けのツールです。

## 3. 受け入れ基準

- [ ] 機能Aが正しく動作する
- [ ] 機能Bが正しく動作する

## 4. 制約条件

特になし

## 5. 依存関係

特になし
`;
      writeFileSync(testFilePath, content, 'utf-8');

      // force フラグなしで実行するため、環境変数を一時的に変更
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      try {
        const result = await validatePhaseTransition(
          testSpecId,
          'requirements',
          'design'
        );

        expect(result.isValid).toBe(true);
        expect(result.needsCompletion).toBe(false);
        expect(result.message).toContain('成功');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('design → tasks の遷移で設計詳細セクションが不足している場合、補完が必要', async () => {
      // 設計詳細セクションが不足している仕様書ファイルを作成
      const content = `# テスト仕様書

**仕様書 ID:** ${testSpecId}
**フェーズ:** design

## 1. 背景と目的

完全な背景と目的が記述されています。
`;
      writeFileSync(testFilePath, content, 'utf-8');

      // force フラグなしで実行するため、環境変数を一時的に変更
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      try {
        const result = await validatePhaseTransition(
          testSpecId,
          'design',
          'tasks'
        );

        expect(result.isValid).toBe(false);
        expect(result.needsCompletion).toBe(true);
        expect(result.missingSections).toBeDefined();
        expect(result.missingSections).toContain('## 7. 設計詳細');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('design → tasks の遷移で設計詳細セクションが記述されている場合、成功', async () => {
      // 完全な設計詳細セクションを含む仕様書ファイルを作成
      const content = `# テスト仕様書

**仕様書 ID:** ${testSpecId}
**フェーズ:** design

## 7. 設計詳細

### 7.1. アーキテクチャ設計

イベント駆動アーキテクチャを採用します。

### 7.5. テスト戦略

単体テストとE2Eテストを実施します。
`;
      writeFileSync(testFilePath, content, 'utf-8');

      // force フラグなしで実行するため、環境変数を一時的に変更
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      try {
        const result = await validatePhaseTransition(
          testSpecId,
          'design',
          'tasks'
        );

        expect(result.isValid).toBe(true);
        expect(result.needsCompletion).toBe(false);
        expect(result.message).toContain('成功');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
