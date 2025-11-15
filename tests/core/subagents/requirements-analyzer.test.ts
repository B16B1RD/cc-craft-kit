/**
 * RequirementsAnalyzer Subagent テスト
 */
import { RequirementsAnalyzer } from '../../../src/core/subagents/impl/requirements-analyzer.js';

describe('RequirementsAnalyzer', () => {
  let analyzer: RequirementsAnalyzer;

  beforeAll(() => {
    analyzer = new RequirementsAnalyzer();
  });

  test('基本的なユーザーストーリー分析', async () => {
    const input = {
      userStory: `
ユーザー認証機能の実装
- ユーザーはメールアドレスとパスワードでログインできる必要があります
- パスワードは安全に暗号化して保存する必要があります
- ログイン失敗時は適切なエラーメッセージを表示する必要があります
      `,
    };

    const context = {
      specId: 'test-spec-1',
      phase: 'requirements',
    };

    const result = await analyzer.execute(input, context);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.functionalRequirements.length).toBeGreaterThan(0);
    expect(result.data!.acceptanceCriteria.length).toBeGreaterThan(0);
  });

  test('入力バリデーション', async () => {
    const validInput = { userStory: 'テスト' };
    const invalidInput = { userStory: '' };

    expect(await analyzer.validate(validInput)).toBe(true);
    expect(await analyzer.validate(invalidInput)).toBe(false);
  });

  test('セキュリティリスク検出', async () => {
    const input = {
      userStory: 'ユーザー認証とauthorizationの実装が必要です',
    };

    const context = {
      specId: 'test-spec-2',
      phase: 'requirements',
    };

    const result = await analyzer.execute(input, context);

    expect(result.success).toBe(true);
    expect(result.data!.risks.length).toBeGreaterThan(0);
    expect(result.data!.risks.some((r) => r.impact === 'high')).toBe(true);
  });
});
