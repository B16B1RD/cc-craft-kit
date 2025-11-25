/**
 * GitHub Issue 同期統合テスト
 *
 * 仕様書と GitHub Issue 間の双方向同期機能をテストする。
 * - 仕様書更新時の Issue 本文同期
 * - チェックボックス双方向同期
 * - 変更履歴コメント生成
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { randomUUID } from 'crypto';
import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../helpers/db-lifecycle.js';
import { createMockOctokit } from '../__mocks__/octokit.js';
import { mockIssueResponse } from '../__fixtures__/github-api-responses.js';
import { GitHubClient } from '../../src/integrations/github/client.js';
import { GitHubIssues } from '../../src/integrations/github/issues.js';
import { GitHubProjects } from '../../src/integrations/github/projects.js';
import { GitHubSyncService } from '../../src/integrations/github/sync.js';
import {
  parseCheckboxes,
  detectCheckboxChanges,
  applyCheckboxChanges,
  CheckboxSyncService,
} from '../../src/integrations/github/checkbox-sync.js';
import {
  detectChanges,
  buildChangelogComment,
  formatChangeSummary,
} from '../../src/integrations/github/changelog-writer.js';

describe('GitHub Issue Sync Integration', () => {
  let lifecycle: DatabaseLifecycle;
  let mockOctokit: ReturnType<typeof createMockOctokit>;
  let githubClient: GitHubClient;
  let githubIssues: GitHubIssues;
  let githubProjects: GitHubProjects;
  let syncService: GitHubSyncService;
  let testDir: string;

  beforeEach(async () => {
    // データベースライフサイクルセットアップ
    lifecycle = await setupDatabaseLifecycle();

    // Octokit モック作成
    mockOctokit = createMockOctokit();

    // GitHubClient 作成
    githubClient = new GitHubClient({ token: 'ghp_test_token' });

    // GitHubClient の rest ゲッターをモックの rest プロパティに向ける
    Object.defineProperty(githubClient, 'rest', {
      get: () => mockOctokit.rest,
      configurable: true,
    });

    Object.defineProperty(githubClient, 'graphqlClient', {
      get: () => mockOctokit.graphql,
      set: () => {},
      configurable: true,
    });

    // GitHub サービスインスタンス作成
    githubIssues = new GitHubIssues(githubClient);
    githubProjects = new GitHubProjects(githubClient);
    syncService = new GitHubSyncService(lifecycle.db, githubIssues, githubProjects);

    // テスト用ディレクトリを作成（.cc-craft-kit/specs 構造を再現）
    testDir = join(process.cwd(), '.cc-craft-kit-test-' + randomUUID().substring(0, 8));
    mkdirSync(join(testDir, '.cc-craft-kit', 'specs'), { recursive: true });
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();

    // テスト用ディレクトリを削除
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('仕様書 → Issue 同期（Source of Truth: 仕様書）', () => {
    it('仕様書の内容で Issue 本文を常に上書きする', async () => {
      const specId = randomUUID();
      const issueNumber = 123;

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'テスト仕様',
          description: 'GitHub同期テスト',
          phase: 'design',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: specId,
          github_id: String(issueNumber),
          github_number: issueNumber,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // 仕様書ファイルを作成（.cc-craft-kit/specs 内に配置）
      const specContent = `# テスト仕様

## 概要

これはテスト用の仕様書です。

## 受け入れ基準

- [ ] 機能 A の実装
- [x] 機能 B の実装
- [ ] 機能 C の実装
`;
      const specPath = join(testDir, '.cc-craft-kit', 'specs', `${specId}.md`);
      writeFileSync(specPath, specContent);

      // process.cwd() をモックして testDir を返すようにする
      const originalCwd = process.cwd;
      process.cwd = () => testDir;

      try {
        // 同期実行
        const resultIssueNumber = await syncService.syncSpecToIssue({
          specId,
          owner: 'test-user',
          repo: 'test-repo',
          createIfNotExists: false,
        });

        // Issue が更新されたことを確認
        expect(resultIssueNumber).toBe(issueNumber);
        expect(mockOctokit.rest.issues.update).toHaveBeenCalledTimes(1);

        // Issue 本文が仕様書の内容で更新されていることを確認
        const updateCall = mockOctokit.rest.issues.update.mock.calls[0][0];
        expect(updateCall.body).toContain('# テスト仕様');
        expect(updateCall.body).toContain('機能 A の実装');
        expect(updateCall.body).toContain('[x] 機能 B の実装');
      } finally {
        process.cwd = originalCwd;
      }
    });
  });

  describe('チェックボックス双方向同期', () => {
    it('Issue のチェックボックス変更を仕様書に反映する', () => {
      // 仕様書のチェックボックス
      const specContent = `# 受け入れ基準

- [ ] 機能 A の実装
- [ ] 機能 B の実装
- [ ] 機能 C の実装
`;

      // Issue のチェックボックス（機能 B が完了）
      const issueBody = `# 受け入れ基準

- [ ] 機能 A の実装
- [x] 機能 B の実装
- [ ] 機能 C の実装
`;

      // チェックボックス解析
      const specCheckboxes = parseCheckboxes(specContent);
      const issueCheckboxes = parseCheckboxes(issueBody);

      // 変更検出
      const changes = detectCheckboxChanges(issueCheckboxes, specCheckboxes);

      // 変更が検出されることを確認
      expect(changes).toHaveLength(1);
      expect(changes[0].text).toBe('機能 B の実装');
      expect(changes[0].oldValue).toBe(false);
      expect(changes[0].newValue).toBe(true);

      // 変更を適用
      const updatedSpec = applyCheckboxChanges(specContent, changes);

      // 仕様書が更新されていることを確認
      expect(updatedSpec).toContain('[x] 機能 B の実装');
      expect(updatedSpec).toContain('[ ] 機能 A の実装');
      expect(updatedSpec).toContain('[ ] 機能 C の実装');
    });

    it('複数のチェックボックス変更を一度に同期する', () => {
      const specContent = `# タスク

- [ ] タスク 1
- [ ] タスク 2
- [x] タスク 3
- [ ] タスク 4
`;

      const issueBody = `# タスク

- [x] タスク 1
- [x] タスク 2
- [ ] タスク 3
- [ ] タスク 4
`;

      const specCheckboxes = parseCheckboxes(specContent);
      const issueCheckboxes = parseCheckboxes(issueBody);
      const changes = detectCheckboxChanges(issueCheckboxes, specCheckboxes);

      // 3つの変更が検出されることを確認
      expect(changes).toHaveLength(3);

      const updatedSpec = applyCheckboxChanges(specContent, changes);

      expect(updatedSpec).toContain('[x] タスク 1');
      expect(updatedSpec).toContain('[x] タスク 2');
      expect(updatedSpec).toContain('[ ] タスク 3');
      expect(updatedSpec).toContain('[ ] タスク 4');
    });

    it('CheckboxSyncService で Issue → 仕様書の同期を実行する', async () => {
      const specId = randomUUID();
      const specPath = join(testDir, '.cc-craft-kit', 'specs', `${specId}.md`);

      // 仕様書ファイルを作成
      const specContent = `# 受け入れ基準

- [ ] 機能 A
- [ ] 機能 B
`;
      writeFileSync(specPath, specContent);

      // Issue 本文（機能 A が完了）
      const issueBody = `# 受け入れ基準

- [x] 機能 A
- [ ] 機能 B
`;

      // CheckboxSyncService で同期
      const checkboxSync = new CheckboxSyncService(lifecycle.db);
      const result = await checkboxSync.syncToSpec(specId, specPath, issueBody);

      // 結果を確認
      expect(result.success).toBe(true);
      expect(result.direction).toBe('to_spec');
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].text).toBe('機能 A');
      expect(result.changes[0].newValue).toBe(true);

      // ファイルが更新されていることを確認
      const updatedContent = readFileSync(specPath, 'utf-8');
      expect(updatedContent).toContain('[x] 機能 A');
      expect(updatedContent).toContain('[ ] 機能 B');
    });
  });

  describe('変更履歴コメント生成', () => {
    it('セクションの変更を検出してコメントを生成する', () => {
      const oldContent = `# 概要

これは古い概要です。

# 要件

- 要件 1
- 要件 2
`;

      const newContent = `# 概要

これは新しい概要です。

# 要件

- 要件 1
- 要件 2
- 要件 3

# 設計

新しいセクション
`;

      // 変更検出
      const changes = detectChanges(oldContent, newContent);

      // 変更が検出されることを確認
      expect(changes.length).toBeGreaterThan(0);

      // 追加されたセクション
      const addedSections = changes.filter((c) => c.type === 'added');
      expect(addedSections.some((c) => c.section === '設計')).toBe(true);

      // 変更されたセクション
      const modifiedSections = changes.filter((c) => c.type === 'modified');
      expect(modifiedSections.length).toBeGreaterThan(0);

      // コメント生成
      const comment = buildChangelogComment(changes, 'test-spec-id', 'abc1234567890');

      // コメント内容を確認
      expect(comment).toContain('📝 仕様書更新');
      expect(comment).toContain('設計');
      expect(comment).toContain('abc1234');
      expect(comment).toContain('test-spec-id.md');
    });

    it('変更がない場合は空文字を返す', () => {
      const content = `# 概要

同じ内容
`;

      const changes = detectChanges(content, content);
      expect(changes).toHaveLength(0);

      const comment = buildChangelogComment(changes, 'test-spec-id');
      expect(comment).toBe('');
    });

    it('フォーマットされた変更サマリーを生成する', () => {
      const changes = [
        { type: 'added' as const, section: '設計', summary: '新規追加' },
        { type: 'modified' as const, section: '要件', summary: '2 件の項目を追加' },
        { type: 'removed' as const, section: '古いセクション', summary: '削除' },
      ];

      const summary = formatChangeSummary(changes);
      expect(summary).toBe('1 件追加、1 件削除、1 件変更');
    });
  });

  describe('同期ワークフロー統合', () => {
    it('仕様書更新 → Issue 同期 → コメント追加の一連のフローが動作する', async () => {
      const specId = randomUUID();
      const issueNumber = 456;

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '統合テスト仕様',
          description: '完全なワークフローテスト',
          phase: 'implementation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: specId,
          github_id: String(issueNumber),
          github_number: issueNumber,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // 仕様書ファイルを作成
      const specContent = `# 統合テスト仕様

## 概要

これは統合テストです。

## タスク

- [x] タスク 1 完了
- [ ] タスク 2 進行中
`;
      const specPath = join(testDir, '.cc-craft-kit', 'specs', `${specId}.md`);
      writeFileSync(specPath, specContent);

      // process.cwd() をモック
      const originalCwd = process.cwd;
      process.cwd = () => testDir;

      try {
        // 同期実行
        const resultIssueNumber = await syncService.syncSpecToIssue({
          specId,
          owner: 'test-user',
          repo: 'test-repo',
          createIfNotExists: false,
        });

        // 結果確認
        expect(resultIssueNumber).toBe(issueNumber);

        // Issue 更新が呼ばれたことを確認
        expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith(
          expect.objectContaining({
            owner: 'test-user',
            repo: 'test-repo',
            issue_number: issueNumber,
            title: '[implementation] 統合テスト仕様',
            labels: ['phase:implementation'],
          })
        );

        // コメント追加が呼ばれたことを確認
        expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
          expect.objectContaining({
            owner: 'test-user',
            repo: 'test-repo',
            issue_number: issueNumber,
            body: expect.stringContaining('🔄 仕様書から同期'),
          })
        );
      } finally {
        process.cwd = originalCwd;
      }
    });

    it('Issue クローズ時に仕様書のフェーズを completed に更新する', async () => {
      const specId = randomUUID();
      const issueNumber = 789;

      // 仕様書作成
      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'クローズテスト',
          description: null,
          phase: 'implementation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // github_sync レコード作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          entity_type: 'spec',
          entity_id: specId,
          github_id: String(issueNumber),
          github_number: issueNumber,
          github_node_id: null,
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // Issue 取得モック（closed 状態）
      mockOctokit.rest.issues.get = jest.fn().mockResolvedValue({
        data: {
          ...mockIssueResponse.data,
          number: issueNumber,
          title: '[completed] クローズテスト',
          state: 'closed',
          body: '# クローズテスト\n\n完了しました。',
        },
      });

      // Issue → 仕様書同期
      await syncService.syncIssueToSpec({
        owner: 'test-user',
        repo: 'test-repo',
        issueNumber,
      });

      // 仕様書のフェーズが completed になったことを確認
      const updatedSpec = await lifecycle.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      expect(updatedSpec?.phase).toBe('completed');
    });
  });
});
