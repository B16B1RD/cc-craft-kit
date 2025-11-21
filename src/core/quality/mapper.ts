/**
 * 品質要件とサブエージェント・スキルのマッピング
 *
 * @module core/quality/mapper
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import {
  validateQualityRequirementsConfig,
  type QualityRequirement,
  type QualityRequirementsConfig,
  type TriggerPhase,
} from './schema.js';

/**
 * 品質チェック不足検出結果
 */
export interface QualityGap {
  /**
   * 品質要件名
   */
  requirementName: string;

  /**
   * タイプ
   */
  type: 'subagent' | 'skill';

  /**
   * トリガーフェーズ
   */
  triggerPhase: TriggerPhase;

  /**
   * 説明
   */
  description: string;

  /**
   * テンプレート名
   */
  template: string;

  /**
   * 不足理由
   */
  reason: string;
}

/**
 * 品質要件マッパー
 */
export class QualityMapper {
  private cwd: string;

  constructor(cwd?: string) {
    this.cwd = cwd || process.cwd();
  }

  /**
   * 品質要件ファイルを読み込む
   */
  loadQualityRequirements(): QualityRequirementsConfig {
    const qualityRequirementsPath = join(this.cwd, '.cc-craft-kit', 'quality-requirements.yaml');

    if (!existsSync(qualityRequirementsPath)) {
      throw new Error('Quality requirements file not found. Run /cft:quality-init first.');
    }

    const content = readFileSync(qualityRequirementsPath, 'utf-8');
    const parsed = yaml.load(content);

    // バリデーション
    validateQualityRequirementsConfig(parsed);

    return parsed as QualityRequirementsConfig;
  }

  /**
   * 既存のサブエージェント名を取得
   */
  getExistingSubagents(): string[] {
    const agentsDir = join(this.cwd, '.claude', 'agents');

    if (!existsSync(agentsDir)) {
      return [];
    }

    return readdirSync(agentsDir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.replace('.md', ''));
  }

  /**
   * 既存のスキル名を取得
   */
  getExistingSkills(): string[] {
    const skillsDir = join(this.cwd, '.claude', 'skills');

    if (!existsSync(skillsDir)) {
      return [];
    }

    return readdirSync(skillsDir).filter((name) => {
      const skillFile = join(skillsDir, name, 'SKILL.md');
      return existsSync(skillFile);
    });
  }

  /**
   * 特定フェーズの品質要件を取得
   */
  getRequirementsForPhase(phase: TriggerPhase): QualityRequirement[] {
    const config = this.loadQualityRequirements();
    return config.quality_requirements.filter((req) => req.trigger_phase === phase);
  }

  /**
   * 品質チェック不足を検出
   */
  detectQualityGaps(phase: TriggerPhase): QualityGap[] {
    const requirements = this.getRequirementsForPhase(phase);
    const existingSubagents = this.getExistingSubagents();
    const existingSkills = this.getExistingSkills();

    const gaps: QualityGap[] = [];

    for (const req of requirements) {
      let exists = false;
      let reason = '';

      if (req.type === 'subagent') {
        // custom- プレフィックス付きの名前もチェック
        const customName = req.name.startsWith('custom-') ? req.name : `custom-${req.name}`;

        if (existingSubagents.includes(req.name) || existingSubagents.includes(customName)) {
          exists = true;
        } else {
          reason = `Subagent '${req.name}' or '${customName}' not found in .claude/agents/`;
        }
      } else {
        // skill
        const customName = req.name.startsWith('custom-') ? req.name : `custom-${req.name}`;

        if (existingSkills.includes(req.name) || existingSkills.includes(customName)) {
          exists = true;
        } else {
          reason = `Skill '${req.name}' or '${customName}' not found in .claude/skills/`;
        }
      }

      if (!exists) {
        gaps.push({
          requirementName: req.name,
          type: req.type,
          triggerPhase: req.trigger_phase,
          description: req.description,
          template: req.template,
          reason,
        });
      }
    }

    return gaps;
  }

  /**
   * すべてのフェーズの品質チェック不足を検出
   */
  detectAllQualityGaps(): Map<TriggerPhase, QualityGap[]> {
    const phases: TriggerPhase[] = [
      'requirements',
      'design',
      'tasks',
      'implementation',
      'testing',
      'completed',
    ];

    const result = new Map<TriggerPhase, QualityGap[]>();

    for (const phase of phases) {
      const gaps = this.detectQualityGaps(phase);
      if (gaps.length > 0) {
        result.set(phase, gaps);
      }
    }

    return result;
  }
}
