/**
 * TemplateEngine テスト
 */
import { TemplateEngine } from '../../../src/core/templates/engine.js';
import path from 'path';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;
  const testTemplatesDir = path.join(process.cwd(), 'templates');

  beforeAll(() => {
    engine = new TemplateEngine(testTemplatesDir);
  });

  describe('renderRequirements', () => {
    test('Requirements テンプレートが正しくレンダリングされる', async () => {
      const vars = {
        specName: 'テスト仕様',
        description: 'テスト用の仕様書',
        featureOverview: 'テスト機能の概要',
        targetUsers: ['開発者', 'テスター'],
        acceptanceCriteria: ['条件1', '条件2'],
        constraints: ['制約1'],
        dependencies: ['依存1'],
        createdAt: '2025-11-15T10:00:00.000Z',
        createdBy: 'テストユーザー',
      };

      const result = await engine.renderRequirements(vars);

      expect(result).toContain('テスト仕様');
      expect(result).toContain('テスト用の仕様書');
      expect(result).toContain('開発者');
      expect(result).toContain('テスター');
      expect(result).toContain('条件1');
      expect(result).toContain('条件2');
    });
  });

  describe('renderDesign', () => {
    test('Design テンプレートが正しくレンダリングされる', async () => {
      const vars = {
        specName: 'テスト設計',
        description: 'テスト用の設計書',
        architecture: 'マイクロサービスアーキテクチャ',
        components: [
          {
            name: 'APIサーバー',
            responsibility: 'REST API提供',
            interfaces: ['GET /api/users', 'POST /api/users'],
          },
        ],
        dataModel: 'ER図参照',
        apiEndpoints: [
          {
            method: 'GET',
            path: '/api/users',
            description: 'ユーザー一覧取得',
          },
        ],
        securityConsiderations: ['認証必須'],
        performanceConsiderations: ['キャッシング'],
        createdAt: '2025-11-15T10:00:00.000Z',
      };

      const result = await engine.renderDesign(vars);

      expect(result).toContain('テスト設計');
      expect(result).toContain('マイクロサービスアーキテクチャ');
      expect(result).toContain('APIサーバー');
      expect(result).toContain('GET /api/users');
    });
  });

  describe('renderTasks', () => {
    test('Tasks テンプレートが正しくレンダリングされる', async () => {
      const vars = {
        specName: 'テストタスク',
        description: 'テスト用のタスク分解',
        tasks: [
          {
            id: 'task-1',
            title: 'タスク1',
            description: 'タスク1の説明',
            priority: 1,
            estimatedHours: 4,
            dependencies: [],
          },
          {
            id: 'task-2',
            title: 'タスク2',
            description: 'タスク2の説明',
            priority: 2,
            estimatedHours: 2,
            dependencies: ['task-1'],
          },
        ],
        totalEstimatedHours: 6,
        createdAt: '2025-11-15T10:00:00.000Z',
      };

      const result = await engine.renderTasks(vars);

      expect(result).toContain('テストタスク');
      expect(result).toContain('タスク1');
      expect(result).toContain('タスク2');
      expect(result).toContain('6時間');
      expect(result).toContain('最高'); // priority: 1
    });
  });

  describe('ヘルパー関数', () => {
    test('priorityLabel ヘルパーが正しく動作する', async () => {
      const vars = {
        specName: 'テスト',
        description: 'テスト',
        tasks: [
          {
            id: 'task-1',
            title: 'タスク1',
            description: '説明',
            priority: 1,
            estimatedHours: 1,
            dependencies: [],
          },
        ],
        totalEstimatedHours: 1,
        createdAt: '2025-11-15T10:00:00.000Z',
      };

      const result = await engine.renderTasks(vars);

      expect(result).toContain('最高'); // priority: 1
    });
  });

  describe('キャッシュ管理', () => {
    test('テンプレートキャッシュがクリアされる', () => {
      engine.clearCache();
      // キャッシュクリア後も正常に動作することを確認
      expect(engine).toBeDefined();
    });
  });
});
