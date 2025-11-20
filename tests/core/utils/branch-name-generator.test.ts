/**
 * ブランチ名生成ユーティリティのテスト
 */

import {
  inferBranchPrefix,
  slugify,
  generateBranchName,
  isHotfixBranch,
  isHotfixSpec,
} from '../../../src/core/utils/branch-name-generator.js';

describe('branch-name-generator', () => {
  describe('inferBranchPrefix', () => {
    it('「修正」を含む仕様書名から fix プレフィックスを推論できる', () => {
      expect(inferBranchPrefix('データベース接続バグを修正')).toBe('fix');
      expect(inferBranchPrefix('エラーハンドリングの修正')).toBe('fix');
    });

    it('「Bug」「bug」を含む仕様書名から fix プレフィックスを推論できる', () => {
      expect(inferBranchPrefix('Fix bug in authentication')).toBe('fix');
      expect(inferBranchPrefix('Database connection bug')).toBe('fix');
    });

    it('「リファクタリング」を含む仕様書名から refactor プレフィックスを推論できる', () => {
      expect(inferBranchPrefix('コードのリファクタリング')).toBe('refactor');
      expect(inferBranchPrefix('パフォーマンスの改善')).toBe('refactor');
    });

    it('「Refactor」を含む仕様書名から refactor プレフィックスを推論できる', () => {
      expect(inferBranchPrefix('Refactor database layer')).toBe('refactor');
    });

    it('「ドキュメント」を含む仕様書名から docs プレフィックスを推論できる', () => {
      expect(inferBranchPrefix('ドキュメントの更新')).toBe('docs');
      expect(inferBranchPrefix('README ファイルの追加')).toBe('docs');
    });

    it('「Docs」「docs」を含む仕様書名から docs プレフィックスを推論できる', () => {
      expect(inferBranchPrefix('Update Docs')).toBe('docs');
      expect(inferBranchPrefix('Add API docs')).toBe('docs');
    });

    it('「依存関係」「更新」を含む仕様書名から chore プレフィックスを推論できる', () => {
      expect(inferBranchPrefix('依存関係の更新')).toBe('chore');
      expect(inferBranchPrefix('パッケージの更新')).toBe('chore');
    });

    it('「Chore」を含む仕様書名から chore プレフィックスを推論できる', () => {
      expect(inferBranchPrefix('Chore: update dependencies')).toBe('chore');
    });

    it('「緊急」「hotfix」を含む仕様書名から hotfix プレフィックスを推論できる', () => {
      expect(inferBranchPrefix('緊急対応が必要')).toBe('hotfix');
      expect(inferBranchPrefix('hotfix: critical security issue')).toBe('hotfix');
      expect(inferBranchPrefix('Critical bug in production')).toBe('hotfix');
    });

    it('キーワードマッチングに失敗した場合、feature プレフィックスを返す', () => {
      expect(inferBranchPrefix('ユーザー認証機能を追加')).toBe('feature');
      expect(inferBranchPrefix('新しい API エンドポイント')).toBe('feature');
      expect(inferBranchPrefix('Add user authentication')).toBe('feature');
    });
  });

  describe('slugify', () => {
    it('日本語から英語への簡易変換ができる', () => {
      expect(slugify('ユーザー認証機能を追加')).toContain('user');
      expect(slugify('ユーザー認証機能を追加')).toContain('auth');
      expect(slugify('データベース接続バグを修正')).toContain('database');
      expect(slugify('データベース接続バグを修正')).toContain('connection');
    });

    it('小文字に変換される', () => {
      expect(slugify('Add User Authentication')).toBe('add-user-authentication');
      expect(slugify('FIX DATABASE BUG')).toBe('fix-database-bug');
    });

    it('スペース、アンダースコア、スラッシュがハイフンに変換される', () => {
      expect(slugify('add user auth')).toBe('add-user-auth');
      expect(slugify('add_user_auth')).toBe('add-user-auth');
      expect(slugify('add/user/auth')).toBe('add-user-auth');
    });

    it('連続するハイフンが1つにまとめられる', () => {
      expect(slugify('add  user   auth')).toBe('add-user-auth');
      expect(slugify('add--user--auth')).toBe('add-user-auth');
    });

    it('英数字とハイフン以外が除去される', () => {
      expect(slugify('add user auth!!!')).toBe('add-user-auth');
      expect(slugify('add (user) auth')).toBe('add-user-auth');
      expect(slugify('add@user#auth')).toBe('adduserauth');
    });

    it('最大50文字に切り詰められる', () => {
      const longName =
        'これは非常に長い仕様書名で、50文字を超える可能性があります。この部分は切り詰められるはずです。';
      const result = slugify(longName);
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('先頭・末尾のハイフンが除去される', () => {
      expect(slugify('-add-user-auth-')).toBe('add-user-auth');
      expect(slugify('  add user auth  ')).toBe('add-user-auth');
    });

    it('空文字列の場合、空文字列を返す', () => {
      expect(slugify('')).toBe('');
      expect(slugify('   ')).toBe('');
      expect(slugify('!!!')).toBe('');
    });
  });

  describe('generateBranchName', () => {
    it('仕様書名から適切なブランチ名を生成できる', () => {
      const result1 = generateBranchName('ユーザー認証機能を追加');
      expect(result1).toMatch(/^feature\//);
      expect(result1).toContain('user');
      expect(result1).toContain('auth');

      const result2 = generateBranchName('データベース接続バグを修正');
      expect(result2).toMatch(/^fix\//);
      expect(result2).toContain('database');

      const result3 = generateBranchName('緊急対応が必要');
      expect(result3).toMatch(/^hotfix\//);
    });

    it('強制的にプレフィックスを指定できる', () => {
      const result1 = generateBranchName('新機能の追加', 'feature');
      expect(result1).toMatch(/^feature\//);
      const result2 = generateBranchName('バグ修正', 'fix');
      expect(result2).toMatch(/^fix\//);
    });

    it('スラッグが空の場合、タイムスタンプを使用する', () => {
      const result = generateBranchName('!!!');
      expect(result).toMatch(/^feature\/unnamed-[a-z0-9]+$/);
    });

    it('複雑な仕様書名も正しく処理できる', () => {
      const result1 = generateBranchName('API エンドポイント /users を追加 (v2)');
      expect(result1).toMatch(/^feature\//);
      expect(result1).toContain('api');
      expect(result1).toContain('users');

      const result2 = generateBranchName('セキュリティ脆弱性の緊急対応 (#123)');
      expect(result2).toMatch(/^hotfix\//);
    });
  });

  describe('isHotfixBranch', () => {
    it('hotfix/ で始まるブランチ名の場合、true を返す', () => {
      expect(isHotfixBranch('hotfix/critical-fix')).toBe(true);
      expect(isHotfixBranch('hotfix/production-issue')).toBe(true);
    });

    it('hotfix/ で始まらないブランチ名の場合、false を返す', () => {
      expect(isHotfixBranch('feature/add-feature')).toBe(false);
      expect(isHotfixBranch('fix/bug-fix')).toBe(false);
      expect(isHotfixBranch('main')).toBe(false);
      expect(isHotfixBranch('develop')).toBe(false);
    });
  });

  describe('isHotfixSpec', () => {
    it('緊急修正を示す仕様書名の場合、true を返す', () => {
      expect(isHotfixSpec('緊急対応が必要')).toBe(true);
      expect(isHotfixSpec('hotfix: critical security issue')).toBe(true);
      expect(isHotfixSpec('Critical bug in production')).toBe(true);
    });

    it('緊急修正を示さない仕様書名の場合、false を返す', () => {
      expect(isHotfixSpec('新機能の追加')).toBe(false);
      expect(isHotfixSpec('バグ修正')).toBe(false);
      expect(isHotfixSpec('リファクタリング')).toBe(false);
    });
  });
});
