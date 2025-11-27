import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Slash Command: /cft:spec-create', () => {
  const commandFilePath = resolve(
    __dirname,
    '../../src/slash-commands/spec-create.md'
  );

  describe('File Existence Tests', () => {
    it('should exist at the correct path', () => {
      // Arrange & Act & Assert
      expect(existsSync(commandFilePath)).toBe(true);
    });
  });

  describe('Markdown Structure Tests', () => {
    let content: string;

    beforeEach(() => {
      // Arrange
      content = readFileSync(commandFilePath, 'utf-8');
    });

    it('should have valid YAML frontmatter', () => {
      // Act
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      // Assert
      expect(frontmatterMatch).not.toBeNull();
      expect(frontmatterMatch![1]).toContain('description:');
      expect(frontmatterMatch![1]).toContain('argument-hint:');
    });

    it('should have description field in frontmatter', () => {
      // Act
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      const descriptionMatch = frontmatterMatch![1].match(
        /description:\s*"(.+)"/
      );

      // Assert
      expect(descriptionMatch).not.toBeNull();
      expect(descriptionMatch![1]).toBeTruthy();
    });

    it('should have argument-hint field in frontmatter', () => {
      // Act
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      const argumentHintMatch = frontmatterMatch![1].match(
        /argument-hint:\s*"(.+)"/
      );

      // Assert
      expect(argumentHintMatch).not.toBeNull();
      expect(argumentHintMatch![1]).toContain('<spec-name>');
    });
  });

  describe('Section Structure Tests', () => {
    let content: string;

    beforeEach(() => {
      // Arrange
      content = readFileSync(commandFilePath, 'utf-8');
    });

    it('should have "引数" section', () => {
      // Assert
      expect(content).toContain('## 引数');
      expect(content).toMatch(/- `\$1`.*必須/);
      expect(content).toMatch(/- `\$2`.*オプション/);
    });

    it('should have "使用例" section with code block', () => {
      // Assert
      expect(content).toContain('## 使用例');
      expect(content).toMatch(/```bash\n\/cft:spec-create/);
    });

    it('should have "自動実行フロー" section', () => {
      // Assert
      expect(content).toContain('## 自動実行フロー');
      expect(content).toContain('自動的に実行');
    });
  });

  describe('Step Definition Tests', () => {
    let content: string;

    beforeEach(() => {
      // Arrange
      content = readFileSync(commandFilePath, 'utf-8');
    });

    it('should have Step 1: UUID 生成', () => {
      // Assert
      expect(content).toContain('### Step 1: UUID 生成');
      expect(content).toContain('uuidgen');
    });

    it('should have Step 2: ブランチ名生成', () => {
      // Assert
      expect(content).toContain('### Step 2: ブランチ名生成');
      expect(content).toContain('kebab-case');
    });

    it('should have Step 3: 現在ブランチ確認', () => {
      // Assert
      expect(content).toContain('### Step 3: 現在ブランチ確認');
      expect(content).toContain('git branch --show-current');
    });

    it('should have Step 4: 保護ブランチ判定', () => {
      // Assert
      expect(content).toContain('### Step 4: 保護ブランチ判定');
      expect(content).toContain('main');
      expect(content).toContain('develop');
    });

    it('should have Step 5: ブランチ作成・切り替え', () => {
      // Assert
      expect(content).toContain('### Step 5: ブランチ作成・切り替え');
      expect(content).toContain('git branch');
      expect(content).toContain('git checkout');
    });

    it('should have Step 6: 仕様書ファイル作成', () => {
      // Assert
      expect(content).toContain('### Step 6: 仕様書ファイル作成');
      expect(content).toContain('Write ツール');
    });

    it('should have Step 7: DB 登録 + イベント発火', () => {
      // Assert
      expect(content).toContain('### Step 7: DB 登録 + イベント発火');
      expect(content).toContain('register.ts');
    });

    it('should have Step 8: コードベース解析', () => {
      // Assert
      expect(content).toContain('### Step 8: コードベース解析');
      expect(content).toContain('Explore サブエージェント');
    });

    it('should have Step 9: 仕様書の自動完成', () => {
      // Assert
      expect(content).toContain('### Step 9: 仕様書の自動完成');
      expect(content).toContain('Edit ツール');
    });

    it('should have Step 10: 元ブランチに復帰', () => {
      // Assert
      expect(content).toContain('### Step 10: 元ブランチに復帰');
      expect(content).toContain('git checkout');
    });
  });

  describe('Code Block Validation Tests', () => {
    let content: string;

    beforeEach(() => {
      // Arrange
      content = readFileSync(commandFilePath, 'utf-8');
    });

    it('should have valid bash code blocks', () => {
      // Act
      const bashBlocks = content.match(/```bash\n([\s\S]*?)\n```/g);

      // Assert
      expect(bashBlocks).not.toBeNull();
      expect(bashBlocks!.length).toBeGreaterThan(0);

      // 各コードブロックをチェック（JavaScript の undefined/null リテラル、/dev/null は許可）
      for (const block of bashBlocks!) {
        expect(block).not.toMatch(/\bundefined\b/);
        // /dev/null は許可、単独の null リテラルのみ禁止
        const blockWithoutDevNull = block.replace(/\/dev\/null/g, '');
        expect(blockWithoutDevNull).not.toMatch(/\bnull\b/);
      }
    });

    it('should have command execution example with npx tsx register.ts', () => {
      // Assert
      expect(content).toMatch(
        /npx tsx \.cc-craft-kit\/commands\/spec\/register\.ts/
      );
    });
  });

  describe('Content Quality Tests', () => {
    let content: string;

    beforeEach(() => {
      // Arrange
      content = readFileSync(commandFilePath, 'utf-8');
    });

    it('should specify thoroughness level for Explore subagent', () => {
      // Assert
      expect(content).toContain('thoroughness: "medium"');
    });

    it('should have file pattern specification for Explore', () => {
      // Assert
      expect(content).toContain('検索対象');
      expect(content).toContain('src/commands/**/*.ts');
      expect(content).toContain('src/core/**/*.ts');
      expect(content).toContain('CLAUDE.md');
      expect(content).toContain('.cc-craft-kit/specs/*.md');
    });

    it('should specify automatic execution without user confirmation', () => {
      // Assert
      expect(content).toContain('自動的に実行');
    });

    it('should have next action guidance', () => {
      // Assert
      expect(content).toContain('/cft:spec-get');
      expect(content).toContain('/cft:spec-phase');
    });
  });

  describe('Branch Naming Tests', () => {
    let content: string;

    beforeEach(() => {
      // Arrange
      content = readFileSync(commandFilePath, 'utf-8');
    });

    it('should have branch naming rules', () => {
      // Assert
      expect(content).toContain('3〜5 単語程度');
      expect(content).toContain('小文字のみ使用');
      expect(content).toContain('ハイフン');
      expect(content).toContain('最大 40 文字程度');
    });

    it('should have branch naming examples', () => {
      // Assert
      expect(content).toContain('improve-branch-naming');
      expect(content).toContain('fix-database-connection');
      expect(content).toContain('add-user-authentication');
    });

    it('should have branch naming table', () => {
      // Assert
      expect(content).toMatch(/\|\s*実行元ブランチ\s*\|/);
      expect(content).toMatch(/\|\s*生成されるブランチ名\s*\|/);
      expect(content).toContain('develop');
      expect(content).toContain('main');
    });
  });

  describe('Error Handling Tests', () => {
    let content: string;

    beforeEach(() => {
      // Arrange
      content = readFileSync(commandFilePath, 'utf-8');
    });

    it('should have error handling summary', () => {
      // Assert
      expect(content).toContain('## エラーハンドリングまとめ');
    });

    it('should specify rollback processing', () => {
      // Assert
      expect(content).toContain('ロールバック');
    });
  });

  describe('Edge Case Tests', () => {
    let content: string;

    beforeEach(() => {
      // Arrange
      content = readFileSync(commandFilePath, 'utf-8');
    });

    it('should handle missing frontmatter gracefully', () => {
      // Arrange
      const invalidContent = '# 仕様書作成\n\n内容';

      // Act
      const frontmatterMatch = invalidContent.match(/^---\n([\s\S]*?)\n---/);

      // Assert
      expect(frontmatterMatch).toBeNull();
    });

    it('should not contain empty code blocks', () => {
      // Act
      const emptyBlocks = content.match(/```\w+\n\n```/g);

      // Assert
      expect(emptyBlocks).toBeNull();
    });

    it('should not have broken links', () => {
      // Act
      const linkMatches = content.match(/\[.*?\]\((.*?)\)/g);

      // Assert
      if (linkMatches) {
        for (const link of linkMatches) {
          expect(link).not.toContain('](undefined)');
          expect(link).not.toContain('](null)');
          expect(link).not.toContain(']()');
        }
      }
    });
  });

  describe('Integration Tests', () => {
    let content: string;

    beforeEach(() => {
      // Arrange
      content = readFileSync(commandFilePath, 'utf-8');
    });

    it('should have correct file extension in command', () => {
      // Assert
      expect(content).toContain('.cc-craft-kit/commands/spec/register.ts');
    });

    it('should reference correct slash command pattern', () => {
      // Assert
      expect(content).toMatch(/\/cft:spec-(get|phase)/);
    });
  });

  describe('BASE_BRANCH Feature Tests', () => {
    let content: string;

    beforeEach(() => {
      // Arrange
      content = readFileSync(commandFilePath, 'utf-8');
    });

    it('should have Step 4.5 for base branch determination', () => {
      // Assert
      expect(content).toContain('### Step 4.5: ベースブランチの決定');
      expect(content).toContain('BASE_BRANCH');
    });

    it('should read BASE_BRANCH from .env file', () => {
      // Assert
      expect(content).toContain("grep '^BASE_BRANCH=' .env");
    });

    it('should have default value for BASE_BRANCH', () => {
      // Assert
      expect(content).toContain('BASE_BRANCH=${BASE_BRANCH:-develop}');
    });

    it('should verify BASE_BRANCH existence before branch creation', () => {
      // Assert
      expect(content).toContain('git rev-parse --verify "$BASE_BRANCH"');
    });

    it('should create branch from BASE_BRANCH instead of current branch', () => {
      // Assert
      expect(content).toContain('git branch "$BRANCH_NAME" "$BASE_BRANCH"');
    });

    it('should have error handling for missing BASE_BRANCH', () => {
      // Assert
      expect(content).toContain('ベースブランチ');
      expect(content).toContain('が見つかりません');
      expect(content).toContain('.env の BASE_BRANCH 設定を確認');
    });

    it('should include BASE_BRANCH in error handling summary', () => {
      // Act
      const errorHandlingSection = content.match(
        /## エラーハンドリングまとめ[\s\S]*?(?=##|$)/
      );

      // Assert
      expect(errorHandlingSection).not.toBeNull();
      expect(errorHandlingSection![0]).toContain('Step 4.5');
      expect(errorHandlingSection![0]).toContain('BASE_BRANCH');
    });
  });
});
