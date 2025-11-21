/**
 * 品質要件スキーマのテスト
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateQualityRequirementsConfig,
  DEFAULT_QUALITY_REQUIREMENTS_TEMPLATE,
  type QualityRequirement,
  type QualityRequirementsConfig,
} from '../../../src/core/quality/schema.js';

describe('品質要件スキーマ', () => {
  describe('validateQualityRequirementsConfig', () => {
    it('正常な設定を検証できる', () => {
      const config: QualityRequirementsConfig = {
        version: '1.0',
        quality_requirements: [
          {
            name: 'test-requirement',
            type: 'subagent',
            trigger_phase: 'implementation',
            description: 'テスト要件',
            template: 'security-auditor',
            tools: ['Read', 'Grep', 'Bash'],
          },
        ],
      };

      expect(() => validateQualityRequirementsConfig(config)).not.toThrow();
    });

    it('version が欠けている場合エラーをスローする', () => {
      const config = {
        quality_requirements: [],
      };

      expect(() => validateQualityRequirementsConfig(config)).toThrow(
        'Quality requirements config must have a version field'
      );
    });

    it('quality_requirements が配列でない場合エラーをスローする', () => {
      const config = {
        version: '1.0',
        quality_requirements: 'invalid',
      };

      expect(() => validateQualityRequirementsConfig(config)).toThrow(
        'Quality requirements config must have a quality_requirements array'
      );
    });

    it('品質要件の name が欠けている場合エラーをスローする', () => {
      const config = {
        version: '1.0',
        quality_requirements: [
          {
            type: 'subagent',
            trigger_phase: 'implementation',
            description: 'テスト要件',
            template: 'security-auditor',
            tools: ['Read'],
          },
        ],
      };

      expect(() => validateQualityRequirementsConfig(config)).toThrow(
        'Quality requirement at index 0 is missing required field: name'
      );
    });

    it('品質要件の type が不正な場合エラーをスローする', () => {
      const config = {
        version: '1.0',
        quality_requirements: [
          {
            name: 'test-requirement',
            type: 'invalid',
            trigger_phase: 'implementation',
            description: 'テスト要件',
            template: 'security-auditor',
            tools: ['Read'],
          },
        ],
      };

      expect(() => validateQualityRequirementsConfig(config)).toThrow(
        "Quality requirement at index 0: type must be 'subagent' or 'skill'"
      );
    });

    it('品質要件の trigger_phase が不正な場合エラーをスローする', () => {
      const config = {
        version: '1.0',
        quality_requirements: [
          {
            name: 'test-requirement',
            type: 'subagent',
            trigger_phase: 'invalid',
            description: 'テスト要件',
            template: 'security-auditor',
            tools: ['Read'],
          },
        ],
      };

      expect(() => validateQualityRequirementsConfig(config)).toThrow(
        'Quality requirement at index 0: trigger_phase must be one of requirements, design, tasks, implementation, testing, completed'
      );
    });

    it('品質要件の tools が配列でない場合エラーをスローする', () => {
      const config = {
        version: '1.0',
        quality_requirements: [
          {
            name: 'test-requirement',
            type: 'subagent',
            trigger_phase: 'implementation',
            description: 'テスト要件',
            template: 'security-auditor',
            tools: 'invalid',
          },
        ],
      };

      expect(() => validateQualityRequirementsConfig(config)).toThrow(
        'Quality requirement at index 0: tools must be a non-empty array'
      );
    });

    it('複数の品質要件を検証できる', () => {
      const config: QualityRequirementsConfig = {
        version: '1.0',
        quality_requirements: [
          {
            name: 'security-audit',
            type: 'subagent',
            trigger_phase: 'implementation',
            description: 'セキュリティ監査',
            template: 'security-auditor',
            tools: ['Read', 'Grep'],
          },
          {
            name: 'api-doc-gen',
            type: 'skill',
            trigger_phase: 'completed',
            description: 'API ドキュメント生成',
            template: 'api-doc-generator',
            tools: ['Read'],
          },
        ],
      };

      expect(() => validateQualityRequirementsConfig(config)).not.toThrow();
    });
  });

  describe('DEFAULT_QUALITY_REQUIREMENTS_TEMPLATE', () => {
    it('デフォルトテンプレートは有効な設定である', () => {
      expect(() =>
        validateQualityRequirementsConfig(DEFAULT_QUALITY_REQUIREMENTS_TEMPLATE)
      ).not.toThrow();
    });

    it('デフォルトテンプレートには security-audit 要件が含まれる', () => {
      const securityAudit = DEFAULT_QUALITY_REQUIREMENTS_TEMPLATE.quality_requirements.find(
        (req: QualityRequirement) => req.name === 'security-audit'
      );

      expect(securityAudit).toBeDefined();
      expect(securityAudit?.type).toBe('subagent');
      expect(securityAudit?.trigger_phase).toBe('implementation');
    });
  });
});
