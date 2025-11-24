import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getGitHubConfig } from '../../../src/core/config/github-config.js';

describe('getGitHubConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 環境変数をクリーンな状態にリセット
    process.env = { ...originalEnv };
    delete process.env.GITHUB_OWNER;
    delete process.env.GITHUB_REPO;
    delete process.env.BASE_BRANCH;
    delete process.env.GITHUB_DEFAULT_BASE_BRANCH;
    delete process.env.PROTECTED_BRANCHES;
  });

  afterEach(() => {
    // テスト後に元の環境変数に戻す
    process.env = originalEnv;
  });

  describe('baseBranch', () => {
    it('BASE_BRANCH 環境変数を正しく読み込む', () => {
      process.env.BASE_BRANCH = 'main';
      const config = getGitHubConfig();
      expect(config.baseBranch).toBe('main');
    });

    it('BASE_BRANCH が未設定の場合、デフォルト値 develop を使用', () => {
      delete process.env.BASE_BRANCH;
      const config = getGitHubConfig();
      expect(config.baseBranch).toBe('develop');
    });

    it('BASE_BRANCH が空文字列の場合、デフォルト値 develop を使用', () => {
      process.env.BASE_BRANCH = '';
      const config = getGitHubConfig();
      expect(config.baseBranch).toBe('develop');
    });

    it('BASE_BRANCH に前後の空白がある場合、トリムされる', () => {
      process.env.BASE_BRANCH = '  main  ';
      const config = getGitHubConfig();
      expect(config.baseBranch).toBe('main');
    });

    it('BASE_BRANCH が空白文字のみの場合、デフォルト値 develop を使用', () => {
      process.env.BASE_BRANCH = '   ';
      const config = getGitHubConfig();
      expect(config.baseBranch).toBe('develop');
    });
  });

  describe('defaultBaseBranch', () => {
    it('GITHUB_DEFAULT_BASE_BRANCH 環境変数を正しく読み込む', () => {
      process.env.GITHUB_DEFAULT_BASE_BRANCH = 'main';
      const config = getGitHubConfig();
      expect(config.defaultBaseBranch).toBe('main');
    });

    it('GITHUB_DEFAULT_BASE_BRANCH が未設定の場合、デフォルト値 develop を使用', () => {
      delete process.env.GITHUB_DEFAULT_BASE_BRANCH;
      const config = getGitHubConfig();
      expect(config.defaultBaseBranch).toBe('develop');
    });

    it('GITHUB_DEFAULT_BASE_BRANCH が空文字列の場合、デフォルト値 develop を使用', () => {
      process.env.GITHUB_DEFAULT_BASE_BRANCH = '';
      const config = getGitHubConfig();
      expect(config.defaultBaseBranch).toBe('develop');
    });
  });

  describe('owner と repo', () => {
    it('GITHUB_OWNER 環境変数を正しく読み込む', () => {
      process.env.GITHUB_OWNER = 'test-owner';
      const config = getGitHubConfig();
      expect(config.owner).toBe('test-owner');
    });

    it('GITHUB_REPO 環境変数を正しく読み込む', () => {
      process.env.GITHUB_REPO = 'test-repo';
      const config = getGitHubConfig();
      expect(config.repo).toBe('test-repo');
    });

    it('GITHUB_OWNER が未設定の場合、null を返す', () => {
      delete process.env.GITHUB_OWNER;
      const config = getGitHubConfig();
      expect(config.owner).toBeNull();
    });

    it('GITHUB_REPO が未設定の場合、null を返す', () => {
      delete process.env.GITHUB_REPO;
      const config = getGitHubConfig();
      expect(config.repo).toBeNull();
    });
  });

  describe('protectedBranches', () => {
    it('PROTECTED_BRANCHES 環境変数を正しく読み込む', () => {
      process.env.PROTECTED_BRANCHES = 'main,develop,staging';
      const config = getGitHubConfig();
      expect(config.protectedBranches).toEqual(['main', 'develop', 'staging']);
    });

    it('PROTECTED_BRANCHES が未設定の場合、デフォルト値を使用', () => {
      delete process.env.PROTECTED_BRANCHES;
      const config = getGitHubConfig();
      expect(config.protectedBranches).toEqual(['main', 'develop']);
    });

    it('PROTECTED_BRANCHES に前後の空白がある場合、トリムされる', () => {
      process.env.PROTECTED_BRANCHES = ' main , develop , staging ';
      const config = getGitHubConfig();
      expect(config.protectedBranches).toEqual(['main', 'develop', 'staging']);
    });
  });

  describe('統合シナリオ', () => {
    it('すべての環境変数が設定されている場合、正しく読み込む', () => {
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.GITHUB_REPO = 'test-repo';
      process.env.BASE_BRANCH = 'main';
      process.env.GITHUB_DEFAULT_BASE_BRANCH = 'develop';
      process.env.PROTECTED_BRANCHES = 'main,develop';

      const config = getGitHubConfig();

      expect(config).toEqual({
        owner: 'test-owner',
        repo: 'test-repo',
        baseBranch: 'main',
        defaultBaseBranch: 'develop',
        protectedBranches: ['main', 'develop'],
      });
    });

    it('環境変数が未設定の場合、デフォルト値を使用', () => {
      const config = getGitHubConfig();

      expect(config).toEqual({
        owner: null,
        repo: null,
        baseBranch: 'develop',
        defaultBaseBranch: 'develop',
        protectedBranches: ['main', 'develop'],
      });
    });
  });
});
