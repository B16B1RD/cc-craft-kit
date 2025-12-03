import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  DEFAULT_STATUS_CONFIG,
  DEFAULT_STATUS_MAPPING,
  LEGACY_3_STAGE_STATUS_CONFIG,
  LEGACY_3_STAGE_STATUS_MAPPING,
  loadStatusConfig,
  mergeStatusConfig,
  validateStatusConfig,
  loadAndValidateStatusConfig,
  isValidPhase,
  getStatusForPhase,
  isStatusAvailable,
  getStatusWithFallback,
  type GitHubStatusConfig,
} from '../../../src/core/config/github-status-config.js';

describe('github-status-config', () => {
  describe('DEFAULT_STATUS_CONFIG', () => {
    it('4 段階ステータスモデルのデフォルト設定を持つ', () => {
      expect(DEFAULT_STATUS_CONFIG.availableStatuses).toEqual([
        'Todo',
        'In Progress',
        'In Review',
        'Done',
      ]);
    });

    it('デフォルトのマッピングが正しく設定されている', () => {
      expect(DEFAULT_STATUS_MAPPING).toEqual({
        requirements: 'Todo',
        design: 'In Progress',
        tasks: 'In Progress',
        implementation: 'In Progress',
        completed: 'In Review',
      });
    });

    it('デフォルトのフォールバックが In Progress', () => {
      expect(DEFAULT_STATUS_CONFIG.fallbackStatus).toBe('In Progress');
    });
  });

  describe('LEGACY_3_STAGE_STATUS_CONFIG', () => {
    it('3 段階ステータスモデルの設定を持つ', () => {
      expect(LEGACY_3_STAGE_STATUS_CONFIG.availableStatuses).toEqual([
        'Todo',
        'In Progress',
        'Done',
      ]);
    });

    it('implementation フェーズが In Progress にマッピングされる', () => {
      expect(LEGACY_3_STAGE_STATUS_MAPPING.implementation).toBe('In Progress');
    });
  });

  describe('loadStatusConfig', () => {
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

    it('config.json が存在しない場合、デフォルト設定を返す', () => {
      const emptyDir = join(tmpdir(), `empty-${Date.now()}`);
      mkdirSync(emptyDir, { recursive: true });

      try {
        const config = loadStatusConfig(emptyDir);
        expect(config).toEqual(DEFAULT_STATUS_CONFIG);
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it('config.json に statusConfig がない場合、デフォルト設定を返す', () => {
      const configPath = join(testDir, '.cc-craft-kit', 'config.json');
      writeFileSync(
        configPath,
        JSON.stringify({
          project: { name: 'test' },
          github: { owner: 'test', repo: 'test' },
        })
      );

      const config = loadStatusConfig(testDir);
      expect(config).toEqual(DEFAULT_STATUS_CONFIG);
    });

    it('statusConfig が存在する場合、マージして返す', () => {
      const configPath = join(testDir, '.cc-craft-kit', 'config.json');
      writeFileSync(
        configPath,
        JSON.stringify({
          github: {
            statusConfig: {
              statusFieldName: 'CustomStatus',
              availableStatuses: ['Open', 'Closed'],
            },
          },
        })
      );

      const config = loadStatusConfig(testDir);
      expect(config.statusFieldName).toBe('CustomStatus');
      expect(config.availableStatuses).toEqual(['Open', 'Closed']);
      // マージされたデフォルト値
      expect(config.statusMapping).toEqual(DEFAULT_STATUS_MAPPING);
    });

    it('不正な JSON の場合、デフォルト設定を返す', () => {
      const configPath = join(testDir, '.cc-craft-kit', 'config.json');
      writeFileSync(configPath, 'invalid json');

      const config = loadStatusConfig(testDir);
      expect(config).toEqual(DEFAULT_STATUS_CONFIG);
    });
  });

  describe('mergeStatusConfig', () => {
    it('空の部分設定の場合、デフォルト設定を返す', () => {
      const config = mergeStatusConfig({});
      expect(config).toEqual(DEFAULT_STATUS_CONFIG);
    });

    it('statusMapping を部分的にオーバーライドできる', () => {
      const config = mergeStatusConfig({
        statusMapping: {
          requirements: 'Open',
          design: 'In Progress',
          tasks: 'In Progress',
          implementation: 'In Progress',
          completed: 'Closed',
        },
      });
      expect(config.statusMapping.requirements).toBe('Open');
      expect(config.statusMapping.completed).toBe('Closed');
    });

    it('availableStatuses をオーバーライドできる', () => {
      const config = mergeStatusConfig({
        availableStatuses: ['Open', 'In Progress', 'Closed'],
      });
      expect(config.availableStatuses).toEqual(['Open', 'In Progress', 'Closed']);
    });
  });

  describe('validateStatusConfig', () => {
    it('デフォルト設定は valid', () => {
      const result = validateStatusConfig(DEFAULT_STATUS_CONFIG);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('3 段階設定は valid', () => {
      const result = validateStatusConfig(LEGACY_3_STAGE_STATUS_CONFIG);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('空の statusFieldName はエラー', () => {
      const config: GitHubStatusConfig = {
        ...DEFAULT_STATUS_CONFIG,
        statusFieldName: '',
      };
      const result = validateStatusConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('statusFieldName は空にできません');
    });

    it('空の availableStatuses はエラー', () => {
      const config: GitHubStatusConfig = {
        ...DEFAULT_STATUS_CONFIG,
        availableStatuses: [],
      };
      const result = validateStatusConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('availableStatuses は少なくとも 1 つのステータスが必要です');
    });

    it('fallbackStatus が availableStatuses に含まれていない場合はエラー', () => {
      const config: GitHubStatusConfig = {
        ...DEFAULT_STATUS_CONFIG,
        fallbackStatus: 'Unknown',
      };
      const result = validateStatusConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'fallbackStatus "Unknown" は availableStatuses に含まれていません'
      );
    });

    it('statusMapping のステータスが availableStatuses に含まれていない場合は警告', () => {
      const config: GitHubStatusConfig = {
        ...DEFAULT_STATUS_CONFIG,
        statusMapping: {
          ...DEFAULT_STATUS_MAPPING,
          implementation: 'Custom Review',
        },
      };
      const result = validateStatusConfig(config);
      expect(result.valid).toBe(true); // 警告のみなので valid
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('implementation');
    });
  });

  describe('loadAndValidateStatusConfig', () => {
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

    it('設定を読み込んでバリデーションを実行', () => {
      const configPath = join(testDir, '.cc-craft-kit', 'config.json');
      writeFileSync(
        configPath,
        JSON.stringify({
          github: {
            statusConfig: {
              statusFieldName: 'Status',
            },
          },
        })
      );

      const { config, validation } = loadAndValidateStatusConfig(testDir);
      expect(config.statusFieldName).toBe('Status');
      expect(validation.valid).toBe(true);
    });
  });

  describe('isValidPhase', () => {
    it('有効なフェーズを true で判定', () => {
      expect(isValidPhase('requirements')).toBe(true);
      expect(isValidPhase('design')).toBe(true);
      expect(isValidPhase('tasks')).toBe(true);
      expect(isValidPhase('implementation')).toBe(true);
      expect(isValidPhase('completed')).toBe(true);
    });

    it('無効なフェーズを false で判定', () => {
      expect(isValidPhase('invalid')).toBe(false);
      expect(isValidPhase('')).toBe(false);
      expect(isValidPhase('REQUIREMENTS')).toBe(false);
    });
  });

  describe('getStatusForPhase', () => {
    it('デフォルト設定でフェーズからステータスを取得', () => {
      expect(getStatusForPhase('requirements')).toBe('Todo');
      expect(getStatusForPhase('design')).toBe('In Progress');
      expect(getStatusForPhase('implementation')).toBe('In Progress');
      expect(getStatusForPhase('completed')).toBe('In Review');
    });

    it('カスタム設定でフェーズからステータスを取得', () => {
      const customConfig: GitHubStatusConfig = {
        ...DEFAULT_STATUS_CONFIG,
        statusMapping: {
          ...DEFAULT_STATUS_MAPPING,
          requirements: 'Open',
          completed: 'Closed',
        },
      };
      expect(getStatusForPhase('requirements', customConfig)).toBe('Open');
      expect(getStatusForPhase('completed', customConfig)).toBe('Closed');
    });
  });

  describe('isStatusAvailable', () => {
    it('利用可能なステータスを true で判定', () => {
      expect(isStatusAvailable('Todo', DEFAULT_STATUS_CONFIG)).toBe(true);
      expect(isStatusAvailable('In Progress', DEFAULT_STATUS_CONFIG)).toBe(true);
      expect(isStatusAvailable('In Review', DEFAULT_STATUS_CONFIG)).toBe(true);
      expect(isStatusAvailable('Done', DEFAULT_STATUS_CONFIG)).toBe(true);
    });

    it('利用不可能なステータスを false で判定', () => {
      expect(isStatusAvailable('Unknown', DEFAULT_STATUS_CONFIG)).toBe(false);
      expect(isStatusAvailable('', DEFAULT_STATUS_CONFIG)).toBe(false);
    });
  });

  describe('getStatusWithFallback', () => {
    it('ステータスが利用可能な場合はそのまま返す', () => {
      expect(getStatusWithFallback('requirements', DEFAULT_STATUS_CONFIG)).toBe('Todo');
      expect(getStatusWithFallback('implementation', DEFAULT_STATUS_CONFIG)).toBe('In Progress');
    });

    it('ステータスが利用不可能な場合はフォールバックを返す', () => {
      const config: GitHubStatusConfig = {
        ...DEFAULT_STATUS_CONFIG,
        statusMapping: {
          ...DEFAULT_STATUS_MAPPING,
          implementation: 'Custom Review', // 存在しないステータス
        },
        fallbackStatus: 'In Progress',
      };
      expect(getStatusWithFallback('implementation', config)).toBe('In Progress');
    });
  });
});
