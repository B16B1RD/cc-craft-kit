import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  mapPhaseToStatus,
  isProjectStatus,
  isExtendedProjectStatus,
  DynamicStatusMapper,
  type Phase,
} from '../../../src/integrations/github/phase-status-mapper.js';
import {
  DEFAULT_STATUS_CONFIG,
  type GitHubStatusConfig,
} from '../../../src/core/config/github-status-config.js';

describe('phase-status-mapper', () => {
  // ============================================================================
  // 後方互換テスト（既存の関数）
  // ============================================================================
  describe('mapPhaseToStatus (後方互換)', () => {
    it('requirements フェーズは Todo にマッピングされる', () => {
      expect(mapPhaseToStatus('requirements')).toBe('Todo');
    });

    it('design フェーズは In Progress にマッピングされる', () => {
      expect(mapPhaseToStatus('design')).toBe('In Progress');
    });

    it('tasks フェーズは In Progress にマッピングされる', () => {
      expect(mapPhaseToStatus('tasks')).toBe('In Progress');
    });

    it('implementation フェーズは In Progress にマッピングされる', () => {
      expect(mapPhaseToStatus('implementation')).toBe('In Progress');
    });

    it('completed フェーズは Done にマッピングされる', () => {
      expect(mapPhaseToStatus('completed')).toBe('Done');
    });

    it('すべてのフェーズがマッピングされている', () => {
      const phases: Phase[] = ['requirements', 'design', 'tasks', 'implementation', 'completed'];

      for (const phase of phases) {
        const status = mapPhaseToStatus(phase);
        expect(status).toBeDefined();
        expect(['Todo', 'In Progress', 'Done']).toContain(status);
      }
    });
  });

  describe('isProjectStatus', () => {
    it('有効な 3 段階ステータスを true で判定', () => {
      expect(isProjectStatus('Todo')).toBe(true);
      expect(isProjectStatus('In Progress')).toBe(true);
      expect(isProjectStatus('Done')).toBe(true);
    });

    it('In Review は 3 段階ステータスには含まれない', () => {
      expect(isProjectStatus('In Review')).toBe(false);
    });

    it('無効なステータスを false で判定', () => {
      expect(isProjectStatus('invalid')).toBe(false);
      expect(isProjectStatus('')).toBe(false);
    });
  });

  describe('isExtendedProjectStatus', () => {
    it('有効な 4 段階ステータスを true で判定', () => {
      expect(isExtendedProjectStatus('Todo')).toBe(true);
      expect(isExtendedProjectStatus('In Progress')).toBe(true);
      expect(isExtendedProjectStatus('In Review')).toBe(true);
      expect(isExtendedProjectStatus('Done')).toBe(true);
    });

    it('無効なステータスを false で判定', () => {
      expect(isExtendedProjectStatus('invalid')).toBe(false);
      expect(isExtendedProjectStatus('')).toBe(false);
    });
  });

  // ============================================================================
  // DynamicStatusMapper テスト
  // ============================================================================
  describe('DynamicStatusMapper', () => {
    describe('コンストラクタ', () => {
      it('設定なしでインスタンス化するとデフォルト設定を使用', () => {
        const mapper = new DynamicStatusMapper();
        expect(mapper.getConfig()).toEqual(DEFAULT_STATUS_CONFIG);
      });

      it('カスタム設定でインスタンス化できる', () => {
        const customConfig: GitHubStatusConfig = {
          ...DEFAULT_STATUS_CONFIG,
          statusFieldName: 'CustomStatus',
        };
        const mapper = new DynamicStatusMapper(customConfig);
        expect(mapper.getStatusFieldName()).toBe('CustomStatus');
      });
    });

    describe('create (静的メソッド)', () => {
      let testDir: string;

      beforeEach(() => {
        testDir = join(tmpdir(), `cc-craft-kit-test-${Date.now()}`);
        mkdirSync(join(testDir, '.cc-craft-kit'), { recursive: true });
      });

      afterEach(() => {
        if (existsSync(testDir)) {
          rmSync(testDir, { recursive: true, force: true });
        }
      });

      it('config.json がない場合、デフォルト設定でインスタンス化', () => {
        const emptyDir = join(tmpdir(), `empty-${Date.now()}`);
        mkdirSync(emptyDir, { recursive: true });

        try {
          const mapper = DynamicStatusMapper.create(emptyDir);
          expect(mapper.getConfig()).toEqual(DEFAULT_STATUS_CONFIG);
        } finally {
          rmSync(emptyDir, { recursive: true, force: true });
        }
      });

      it('config.json から設定を読み込んでインスタンス化', () => {
        const configPath = join(testDir, '.cc-craft-kit', 'config.json');
        writeFileSync(
          configPath,
          JSON.stringify({
            github: {
              statusConfig: {
                statusFieldName: 'MyStatus',
                availableStatuses: ['Open', 'Closed'],
              },
            },
          })
        );

        const mapper = DynamicStatusMapper.create(testDir);
        expect(mapper.getStatusFieldName()).toBe('MyStatus');
        expect(mapper.getAvailableStatuses()).toEqual(['Open', 'Closed']);
      });
    });

    describe('mapPhaseToStatus', () => {
      it('デフォルト設定で 4 段階マッピング', () => {
        const mapper = new DynamicStatusMapper();
        expect(mapper.mapPhaseToStatus('requirements')).toBe('Todo');
        expect(mapper.mapPhaseToStatus('design')).toBe('In Progress');
        expect(mapper.mapPhaseToStatus('implementation')).toBe('In Progress');
        expect(mapper.mapPhaseToStatus('completed')).toBe('In Review');
      });

      it('カスタムマッピングを使用', () => {
        const customConfig: GitHubStatusConfig = {
          ...DEFAULT_STATUS_CONFIG,
          statusMapping: {
            requirements: 'Open',
            design: 'In Progress',
            tasks: 'In Progress',
            implementation: 'In Progress',
            completed: 'Closed',
          },
        };
        const mapper = new DynamicStatusMapper(customConfig);
        expect(mapper.mapPhaseToStatus('requirements')).toBe('Open');
        expect(mapper.mapPhaseToStatus('completed')).toBe('Closed');
      });
    });

    describe('mapPhaseToStatusWithFallback', () => {
      it('ステータスが利用可能な場合はそのまま返す', () => {
        const mapper = new DynamicStatusMapper();
        expect(mapper.mapPhaseToStatusWithFallback('requirements')).toBe('Todo');
      });

      it('ステータスが利用不可能な場合はフォールバックを返す', () => {
        const customConfig: GitHubStatusConfig = {
          ...DEFAULT_STATUS_CONFIG,
          statusMapping: {
            ...DEFAULT_STATUS_CONFIG.statusMapping,
            implementation: 'Unknown Status',
          },
          fallbackStatus: 'In Progress',
        };
        const mapper = new DynamicStatusMapper(customConfig);
        expect(mapper.mapPhaseToStatusWithFallback('implementation')).toBe('In Progress');
      });
    });

    describe('isStatusAvailable', () => {
      it('利用可能なステータスを true で判定', () => {
        const mapper = new DynamicStatusMapper();
        expect(mapper.isStatusAvailable('Todo')).toBe(true);
        expect(mapper.isStatusAvailable('In Review')).toBe(true);
      });

      it('利用不可能なステータスを false で判定', () => {
        const mapper = new DynamicStatusMapper();
        expect(mapper.isStatusAvailable('Unknown')).toBe(false);
      });
    });

    describe('getStatusFieldName', () => {
      it('デフォルトは Status', () => {
        const mapper = new DynamicStatusMapper();
        expect(mapper.getStatusFieldName()).toBe('Status');
      });
    });

    describe('getAvailableStatuses', () => {
      it('デフォルトは 4 段階ステータス', () => {
        const mapper = new DynamicStatusMapper();
        expect(mapper.getAvailableStatuses()).toEqual([
          'Todo',
          'In Progress',
          'In Review',
          'Done',
        ]);
      });

      it('返された配列を変更しても元の設定に影響しない', () => {
        const mapper = new DynamicStatusMapper();
        const statuses = mapper.getAvailableStatuses();
        statuses.push('Modified');
        expect(mapper.getAvailableStatuses()).not.toContain('Modified');
      });
    });

    describe('getFallbackStatus', () => {
      it('デフォルトは In Progress', () => {
        const mapper = new DynamicStatusMapper();
        expect(mapper.getFallbackStatus()).toBe('In Progress');
      });
    });
  });
});
