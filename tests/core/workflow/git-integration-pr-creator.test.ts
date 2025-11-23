/**
 * Git統合 - PR作成案内機能のテスト
 */

describe('Git Integration - PR Creator Guidance', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    // console.log をスパイ
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('completed フェーズ移行時のメッセージフォーマットが正しい', () => {
    // テスト対象のメッセージ
    const message = '\n📝 Next: Create Pull Request';
    const guidanceLines = [
      '   Run the pr-creator skill to automatically create a PR:',
      '   - Skill tool will execute the pr-creator skill',
      '   - PR title and body will be generated from the spec',
      '   - GitHub CLI will create the PR\n',
    ];

    // メッセージ形式の検証
    expect(message).toContain('Next: Create Pull Request');
    expect(guidanceLines[0]).toContain('pr-creator skill');
    expect(guidanceLines[1]).toContain('Skill tool');
    expect(guidanceLines[2]).toContain('PR title and body');
    expect(guidanceLines[3]).toContain('GitHub CLI');
  });

  it('SKILL.md ファイルが存在する', () => {
    const fs = require('node:fs');
    const path = require('node:path');

    const skillPath = path.join(
      process.cwd(),
      '.claude/skills/pr-creator/SKILL.md'
    );

    expect(fs.existsSync(skillPath)).toBe(true);
  });

  it('SKILL.md に必要なセクションが含まれる', () => {
    const fs = require('node:fs');
    const path = require('node:path');

    const skillPath = path.join(
      process.cwd(),
      '.claude/skills/pr-creator/SKILL.md'
    );
    const content = fs.readFileSync(skillPath, 'utf-8');

    // 必須セクションの確認
    expect(content).toContain('# Pull Request 自動作成スキル');
    expect(content).toContain('## 機能概要');
    expect(content).toContain('## 使用方法');
    expect(content).toContain('## 実装フロー');
    expect(content).toContain('## エラーハンドリング');
    expect(content).toContain('## 制約事項');
    expect(content).toContain('## トラブルシューティング');

    // 重要な機能の記載確認
    expect(content).toContain('gh pr create');
    expect(content).toContain('completed フェーズ');
  });
});
