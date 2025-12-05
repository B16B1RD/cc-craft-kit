/**
 * Zod スキーマのテスト
 */

import {
  SpecPhaseSchema,
  TaskStatusSchema,
  GitHubEntityTypeSchema,
  WorkflowNextActionSchema,
  SyncStatusSchema,
  LogLevelSchema,
  SpecDataSchema,
  GitHubSyncDataSchema,
  WorkflowStateDataSchema,
  TaskDataSchema,
  LogDataSchema,
  validateData,
  safeValidateData,
} from '../../../src/core/storage/schemas.js';

describe('Zod Schemas', () => {
  describe('Enum Schemas', () => {
    it('SpecPhaseSchema は有効なフェーズを受け入れる', () => {
      expect(() => SpecPhaseSchema.parse('requirements')).not.toThrow();
      expect(() => SpecPhaseSchema.parse('design')).not.toThrow();
      expect(() => SpecPhaseSchema.parse('tasks')).not.toThrow();
      expect(() => SpecPhaseSchema.parse('implementation')).not.toThrow();
      expect(() => SpecPhaseSchema.parse('review')).not.toThrow();
      expect(() => SpecPhaseSchema.parse('completed')).not.toThrow();
    });

    it('SpecPhaseSchema は無効なフェーズを拒否する', () => {
      expect(() => SpecPhaseSchema.parse('invalid')).toThrow();
    });

    it('TaskStatusSchema は有効なステータスを受け入れる', () => {
      expect(() => TaskStatusSchema.parse('todo')).not.toThrow();
      expect(() => TaskStatusSchema.parse('in_progress')).not.toThrow();
      expect(() => TaskStatusSchema.parse('blocked')).not.toThrow();
      expect(() => TaskStatusSchema.parse('review')).not.toThrow();
      expect(() => TaskStatusSchema.parse('done')).not.toThrow();
    });

    it('GitHubEntityTypeSchema は有効なエンティティタイプを受け入れる', () => {
      expect(() => GitHubEntityTypeSchema.parse('spec')).not.toThrow();
      expect(() => GitHubEntityTypeSchema.parse('task')).not.toThrow();
      expect(() => GitHubEntityTypeSchema.parse('issue')).not.toThrow();
      expect(() => GitHubEntityTypeSchema.parse('project')).not.toThrow();
      expect(() => GitHubEntityTypeSchema.parse('sub_issue')).not.toThrow();
    });

    it('WorkflowNextActionSchema は有効なアクションを受け入れる', () => {
      expect(() => WorkflowNextActionSchema.parse('task_start')).not.toThrow();
      expect(() => WorkflowNextActionSchema.parse('task_done')).not.toThrow();
      expect(() => WorkflowNextActionSchema.parse('none')).not.toThrow();
    });

    it('SyncStatusSchema は有効なステータスを受け入れる', () => {
      expect(() => SyncStatusSchema.parse('success')).not.toThrow();
      expect(() => SyncStatusSchema.parse('failed')).not.toThrow();
      expect(() => SyncStatusSchema.parse('pending')).not.toThrow();
      expect(() => SyncStatusSchema.parse('synced')).not.toThrow();
    });

    it('LogLevelSchema は有効なログレベルを受け入れる', () => {
      expect(() => LogLevelSchema.parse('debug')).not.toThrow();
      expect(() => LogLevelSchema.parse('info')).not.toThrow();
      expect(() => LogLevelSchema.parse('warn')).not.toThrow();
      expect(() => LogLevelSchema.parse('error')).not.toThrow();
    });
  });

  describe('SpecDataSchema', () => {
    const validSpec = {
      id: '12345678-1234-1234-1234-123456789012',
      name: 'テスト仕様書',
      description: '説明',
      phase: 'requirements',
      branch_name: 'feature/test',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    };

    it('有効なデータを受け入れる', () => {
      expect(() => SpecDataSchema.parse(validSpec)).not.toThrow();
    });

    it('description が null でも有効', () => {
      expect(() => SpecDataSchema.parse({ ...validSpec, description: null })).not.toThrow();
    });

    it('branch_name が null でも有効', () => {
      expect(() => SpecDataSchema.parse({ ...validSpec, branch_name: null })).not.toThrow();
    });

    it('必須フィールドが欠けていると拒否', () => {
      const { name: _name, ...withoutName } = validSpec;
      expect(() => SpecDataSchema.parse(withoutName)).toThrow();
    });

    it('無効な UUID は拒否', () => {
      expect(() => SpecDataSchema.parse({ ...validSpec, id: 'invalid-uuid' })).toThrow();
    });

    it('空の name は拒否', () => {
      expect(() => SpecDataSchema.parse({ ...validSpec, name: '' })).toThrow();
    });
  });

  describe('TaskDataSchema', () => {
    const validTask = {
      id: '12345678-1234-1234-1234-123456789012',
      spec_id: '87654321-4321-4321-4321-210987654321',
      title: 'タスクタイトル',
      description: '説明',
      status: 'todo',
      priority: 3,
      github_issue_id: null,
      github_issue_number: null,
      assignee: null,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    };

    it('有効なデータを受け入れる', () => {
      expect(() => TaskDataSchema.parse(validTask)).not.toThrow();
    });

    it('priority は 1-5 の範囲', () => {
      expect(() => TaskDataSchema.parse({ ...validTask, priority: 1 })).not.toThrow();
      expect(() => TaskDataSchema.parse({ ...validTask, priority: 5 })).not.toThrow();
      expect(() => TaskDataSchema.parse({ ...validTask, priority: 0 })).toThrow();
      expect(() => TaskDataSchema.parse({ ...validTask, priority: 6 })).toThrow();
    });
  });

  describe('LogDataSchema', () => {
    const validLog = {
      id: '12345678-1234-1234-1234-123456789012',
      task_id: null,
      spec_id: null,
      action: 'spec.created',
      level: 'info',
      message: 'ログメッセージ',
      metadata: { key: 'value' },
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    it('有効なデータを受け入れる', () => {
      expect(() => LogDataSchema.parse(validLog)).not.toThrow();
    });

    it('metadata が null でも有効', () => {
      expect(() => LogDataSchema.parse({ ...validLog, metadata: null })).not.toThrow();
    });
  });

  describe('validateData / safeValidateData', () => {
    it('validateData は有効なデータを返す', () => {
      const data = { id: '12345678-1234-1234-1234-123456789012' };
      const schema = SpecDataSchema.pick({ id: true });

      expect(validateData(schema, data)).toEqual(data);
    });

    it('validateData は無効なデータでスロー', () => {
      const schema = SpecDataSchema.pick({ id: true });
      expect(() => validateData(schema, { id: 'invalid' })).toThrow();
    });

    it('safeValidateData は成功時に success: true を返す', () => {
      const data = { id: '12345678-1234-1234-1234-123456789012' };
      const schema = SpecDataSchema.pick({ id: true });

      const result = safeValidateData(schema, data);
      expect(result.success).toBe(true);
    });

    it('safeValidateData は失敗時に success: false を返す', () => {
      const schema = SpecDataSchema.pick({ id: true });

      const result = safeValidateData(schema, { id: 'invalid' });
      expect(result.success).toBe(false);
    });
  });
});
