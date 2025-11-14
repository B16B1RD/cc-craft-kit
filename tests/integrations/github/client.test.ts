/**
 * GitHub クライアントテスト
 */
import { GitHubClient, initGitHubClient } from '../../../src/integrations/github/client.js';

describe('GitHubClient', () => {
  // テスト用のダミートークン
  const mockToken = 'ghp_test_token_1234567890';

  describe('初期化', () => {
    test('正常に初期化できる', () => {
      const client = new GitHubClient({ token: mockToken });
      expect(client).toBeDefined();
      expect(client.rest).toBeDefined();
    });

    test('グローバルクライアントを初期化できる', () => {
      const client = initGitHubClient({ token: mockToken });
      expect(client).toBeDefined();
    });
  });

  describe('認証', () => {
    test('認証確認メソッドが定義されている', () => {
      const client = new GitHubClient({ token: mockToken });
      expect(client.verifyAuth).toBeDefined();
      expect(typeof client.verifyAuth).toBe('function');
    });
  });

  describe('GraphQL', () => {
    test('GraphQLクエリメソッドが定義されている', () => {
      const client = new GitHubClient({ token: mockToken });
      expect(client.query).toBeDefined();
      expect(typeof client.query).toBe('function');
    });
  });
});
