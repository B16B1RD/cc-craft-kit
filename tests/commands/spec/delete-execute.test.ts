/**
 * delete-execute.ts 単体テスト
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { randomUUID } from 'crypto';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { setupDatabaseLifecycle, DatabaseLifecycle } from '../../helpers/db-lifecycle.js';
import { executeDelete } from '../../../src/commands/spec/delete-execute.js';

// GitHub API モック
jest.mock('../../../src/integrations/github/client.js', () => ({
  GitHubClient: jest.fn().mockImplementation(() => ({
    rest: {
      issues: {
        update: jest.fn(),
      },
    },
  })),
}));

jest.mock('../../../src/integrations/github/issues.js', () => ({
  GitHubIssues: jest.fn().mockImplementation(() => ({
    close: jest.fn().mockResolvedValue({ number: 1, state: 'closed' }),
  })),
}));

// EventBus モック
jest.mock('../../../src/core/workflow/event-bus.js', () => ({
  getEventBusAsync: jest.fn().mockResolvedValue({
    emit: jest.fn().mockResolvedValue(undefined),
    createEvent: jest.fn().mockImplementation((type, entityId, data) => ({
      type,
      entityId,
      data,
    })),
  }),
}));

describe('executeDelete', () => {
  let lifecycle: DatabaseLifecycle;
  let specsDir: string;

  beforeEach(async () => {
    lifecycle = await setupDatabaseLifecycle();
    specsDir = join(process.cwd(), '.cc-craft-kit', 'specs');

    // specs ディレクトリが存在しない場合は作成
    if (!existsSync(specsDir)) {
      mkdirSync(specsDir, { recursive: true });
    }
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    await lifecycle.close();
  });

  describe('正常系', () => {
    test('DB レコード削除成功', async () => {
      const specId = randomUUID();

      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: '削除テスト',
          description: null,
          phase: 'requirements',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 仕様書ファイル作成
      const specPath = join(specsDir, `${specId}.md`);
      writeFileSync(specPath, '# テスト仕様書');

      const result = await executeDelete(specId, { closeGitHubIssue: false });

      expect(result.success).toBe(true);
      expect(result.deletedSpecId).toBe(specId);
      expect(result.deletedSpecName).toBe('削除テスト');
      expect(result.githubIssueStatus).toBe('skipped');

      // DB から削除されていることを確認
      const spec = await lifecycle.db
        .selectFrom('specs')
        .selectAll()
        .where('id', '=', specId)
        .executeTakeFirst();
      expect(spec).toBeUndefined();

      // ファイルが削除されていることを確認
      expect(existsSync(specPath)).toBe(false);
    });

    test('ファイル削除成功', async () => {
      const specId = randomUUID();

      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'ファイル削除テスト',
          description: null,
          phase: 'design',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 仕様書ファイル作成
      const specPath = join(specsDir, `${specId}.md`);
      writeFileSync(specPath, '# ファイル削除テスト');
      expect(existsSync(specPath)).toBe(true);

      const result = await executeDelete(specId, { closeGitHubIssue: false });

      expect(result.success).toBe(true);
      expect(existsSync(specPath)).toBe(false);
    });

    test('--close-github-issue=false でスキップ', async () => {
      const specId = randomUUID();

      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'GitHub スキップテスト',
          description: null,
          phase: 'implementation',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // GitHub sync レコード作成
      await lifecycle.db
        .insertInto('github_sync')
        .values({
          id: randomUUID(),
          entity_type: 'spec',
          entity_id: specId,
          github_id: '100',
          github_number: 100,
          github_node_id: null,
          issue_number: 50,
          issue_url: 'https://github.com/owner/repo/issues/50',
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // 仕様書ファイル作成
      const specPath = join(specsDir, `${specId}.md`);
      writeFileSync(specPath, '# GitHub スキップテスト');

      const result = await executeDelete(specId, { closeGitHubIssue: false });

      expect(result.success).toBe(true);
      expect(result.githubIssueStatus).toBe('skipped');
      expect(result.githubIssueNumber).toBe(50);
    });

    test('GitHub Issue 番号なしの場合はスキップ', async () => {
      const specId = randomUUID();

      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'GitHub Issue なしテスト',
          description: null,
          phase: 'implementation',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // 仕様書ファイル作成
      const specPath = join(specsDir, `${specId}.md`);
      writeFileSync(specPath, '# GitHub Issue なしテスト');

      const result = await executeDelete(specId, { closeGitHubIssue: true });

      expect(result.success).toBe(true);
      expect(result.githubIssueStatus).toBe('skipped');
      expect(result.githubIssueNumber).toBeNull();
    });
  });

  describe('異常系', () => {
    test('存在しない仕様書 ID でエラー', async () => {
      const result = await executeDelete('nonexistent-id');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
      expect(result.error).toContain('仕様書が見つかりません');
    });

    test('仕様書ファイルが存在しない場合も DB は削除される', async () => {
      const specId = randomUUID();

      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'ファイルなしテスト',
          description: null,
          phase: 'completed',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      // ファイルは作成しない
      const specPath = join(specsDir, `${specId}.md`);
      expect(existsSync(specPath)).toBe(false);

      const result = await executeDelete(specId, { closeGitHubIssue: false });

      expect(result.success).toBe(true);

      // DB から削除されていることを確認
      const spec = await lifecycle.db
        .selectFrom('specs')
        .selectAll()
        .where('id', '=', specId)
        .executeTakeFirst();
      expect(spec).toBeUndefined();
    });
  });

  describe('github_sync レコード削除', () => {
    test('github_sync レコードも削除される', async () => {
      const specId = randomUUID();
      const syncId = randomUUID();

      await lifecycle.db
        .insertInto('specs')
        .values({
          id: specId,
          name: 'Sync 削除テスト',
          description: null,
          phase: 'implementation',
          branch_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();

      await lifecycle.db
        .insertInto('github_sync')
        .values({
          id: syncId,
          entity_type: 'spec',
          entity_id: specId,
          github_id: '200',
          github_number: 200,
          github_node_id: null,
          issue_number: 75,
          issue_url: 'https://github.com/owner/repo/issues/75',
          last_synced_at: new Date().toISOString(),
          sync_status: 'success',
          error_message: null,
        })
        .execute();

      // 仕様書ファイル作成
      const specPath = join(specsDir, `${specId}.md`);
      writeFileSync(specPath, '# Sync 削除テスト');

      const result = await executeDelete(specId, { closeGitHubIssue: false });

      expect(result.success).toBe(true);

      // github_sync レコードも削除されていることを確認
      const sync = await lifecycle.db
        .selectFrom('github_sync')
        .selectAll()
        .where('id', '=', syncId)
        .executeTakeFirst();
      expect(sync).toBeUndefined();
    });
  });
});
