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

    it('should have "実行内容" section', () => {
      // Assert
      expect(content).toContain('## 実行内容');
    });

    it('should have "使用例" section with code block', () => {
      // Assert
      expect(content).toContain('## 使用例');
      expect(content).toMatch(/```bash\n\/cft:spec-create/);
    });

    it('should have "ブランチ名生成" section', () => {
      // Assert
      expect(content).toContain('## ブランチ名生成');
      expect(content).toContain('仕様書名と説明を分析');
      expect(content).toContain('英語ブランチ名の生成規則');
      expect(content).toContain('ブランチ名の例');
    });

    it('should have "自動ブランチ作成の動作" section', () => {
      // Assert
      expect(content).toContain('## 自動ブランチ作成の動作（v0.2.0 以降）');
      expect(content).toContain('保護ブランチ');
      expect(content).toContain('ブランチ命名規則');
    });

    it('should have "ブランチ作成後の動作" section', () => {
      // Assert
      expect(content).toContain('## ブランチ作成後の動作（v0.3.0 以降）');
      expect(content).toContain('元のブランチへ自動的に戻る');
    });
  });

  describe('Phase Definition Tests', () => {
    let content: string;

    beforeEach(() => {
      // Arrange
      content = readFileSync(commandFilePath, 'utf-8');
    });

    it('should have "仕様書自動完成フロー" section', () => {
      // Assert
      expect(content).toContain('## 仕様書の自動完成フロー (v0.4.0 以降)');
      expect(content).toContain('自動的に実行');
    });

    it('should have Phase 1: 事前情報収集', () => {
      // Assert
      expect(content).toContain('### フェーズ 1: 事前情報収集');
      expect(content).toContain('コードベース解析');
      expect(content).toContain('Explore サブエージェント');
      expect(content).toContain('情報の整理');
    });

    it('should have Phase 2: 不明情報の確認', () => {
      // Assert
      expect(content).toContain('### フェーズ 2: 不明情報の確認 (オプション)');
      expect(content).toContain('対話的な質問');
      expect(content).toContain('AskUserQuestion');
    });

    it('should have Phase 3: 仕様書の自動完成', () => {
      // Assert
      expect(content).toContain('### フェーズ 3: 仕様書の自動完成');
      expect(content).toContain('自動完成された内容の反映');
    });

    it('should have Phase 4: 品質レビュー', () => {
      // Assert
      expect(content).toContain('### フェーズ 4: 品質レビュー');
      expect(content).toContain('仕様書の品質レビュー');
      expect(content).toContain('code-reviewer サブエージェント');
      expect(content).toContain('次のアクションを案内');
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

      // 各コードブロックをチェック
      for (const block of bashBlocks!) {
        expect(block).not.toContain('undefined');
        expect(block).not.toContain('null');
      }
    });

    it('should have command execution example with npx tsx', () => {
      // Assert
      expect(content).toMatch(
        /npx tsx \.cc-craft-kit\/commands\/spec\/create\.ts/
      );
    });

    it('should have git checkout example in bash code block', () => {
      // Assert
      expect(content).toMatch(/```bash\n# 作成されたブランチに切り替え\ngit checkout/);
    });

    it('should have branch name option in command', () => {
      // Assert
      expect(content).toContain('--branch-name "<生成したブランチ名>"');
    });
  });

  describe('Flow Clarity Tests', () => {
    let content: string;

    beforeEach(() => {
      // Arrange
      content = readFileSync(commandFilePath, 'utf-8');
    });

    it('should have numbered steps in Phase 0', () => {
      // Assert
      expect(content).toMatch(/1\.\s+\*\*仕様書ファイルの作成\*\*/);
    });

    it('should have numbered steps in Phase 1', () => {
      // Assert
      expect(content).toMatch(/1\.\s+\*\*コードベース解析\*\*/);
      expect(content).toMatch(/2\.\s+\*\*情報の整理\*\*/);
    });

    it('should have numbered steps in Phase 2', () => {
      // Assert
      expect(content).toMatch(/1\.\s+\*\*対話的な質問\*\*/);
    });

    it('should have numbered steps in Phase 3', () => {
      // Assert
      expect(content).toMatch(/1\.\s+\*\*自動完成された内容の反映\*\*/);
    });

    it('should have numbered steps in Phase 4', () => {
      // Assert
      expect(content).toMatch(/1\.\s+\*\*仕様書の品質レビュー\*\*/);
      expect(content).toMatch(/2\.\s+\*\*次のアクションを案内\*\*/);
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
      expect(content).toContain('thoroughness level: "medium"');
      expect(content).toContain('想定コンテキスト消費: 約 20,000〜40,000 トークン');
    });

    it('should have file pattern specification for Explore', () => {
      // Assert
      expect(content).toContain('検索対象');
      expect(content).toContain('src/commands/**/*.ts');
      expect(content).toContain('src/core/**/*.ts');
      expect(content).toContain('CLAUDE.md');
      expect(content).toContain('.cc-craft-kit/specs/*.md');
    });

    it('should have AskUserQuestion example', () => {
      // Assert
      expect(content).toContain('question:');
      expect(content).toContain('options:');
      expect(content).toContain('label:');
      expect(content).toContain('description:');
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
      expect(content).toMatch(/\|\s*カスタムブランチ名\s*\|/);
      expect(content).toMatch(/\|\s*生成されるブランチ名\s*\|/);
      expect(content).toContain('feature/*');
      expect(content).toContain('develop');
      expect(content).toContain('main');
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

    it('should not have duplicate section headings', () => {
      // Act
      const headings = content.match(/^#{1,6}\s+.+$/gm);

      // Assert
      if (headings) {
        const headingTexts = headings.map((h) =>
          h.replace(/^#{1,6}\s+/, '').trim()
        );
        const uniqueHeadings = new Set(headingTexts);

        // 重複許可リスト（同じ見出しが複数回登場しても良い場合）
        const allowedDuplicates = new Set<string>([
          // 必要に応じて追加
        ]);

        for (const heading of headingTexts) {
          if (
            !allowedDuplicates.has(heading) &&
            headingTexts.filter((h) => h === heading).length > 1
          ) {
            // 重複見出しが見つかった場合は失敗
            expect(uniqueHeadings.size).toBe(headingTexts.length);
          }
        }
      }
    });
  });

  describe('Error Handling Tests', () => {
    it('should throw error for non-existent file', () => {
      // Arrange
      const nonExistentPath = '/non/existent/path.md';

      // Act & Assert
      expect(() => {
        readFileSync(nonExistentPath, 'utf-8');
      }).toThrow();
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
      expect(content).toContain('.cc-craft-kit/commands/spec/create.ts');
    });

    it('should reference correct slash command pattern', () => {
      // Assert
      expect(content).toMatch(/\/cft:spec-(get|phase)/);
    });

    it('should have version annotations', () => {
      // Assert
      expect(content).toContain('v0.2.0 以降');
      expect(content).toContain('v0.3.0 以降');
      expect(content).toContain('v0.4.0 以降');
    });
  });
});
