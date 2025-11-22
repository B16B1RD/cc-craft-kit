/**
 * 仕様書ファイル更新モジュールのテスト
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { addTaskListSection, updateTaskListSection } from '../../../src/core/spec/updater.js';
import * as parser from '../../../src/core/spec/parser.js';
import * as fsyncUtil from '../../../src/core/utils/fsync.js';

// ファイルシステムとfsyncをモック化
jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('../../../src/core/utils/fsync.js', () => ({
  fsyncFileAndDirectory: jest.fn(),
}));

// parserモジュールの一部をモック化
jest.mock('../../../src/core/spec/parser.js', () => {
  const actual = jest.requireActual<typeof parser>('../../../src/core/spec/parser.js');
  return {
    ...actual,
    hasTaskListSection: jest.fn(),
  };
});

describe('spec/updater', () => {
  const mockReadFileSync = jest.mocked(readFileSync);
  const mockWriteFileSync = jest.mocked(writeFileSync);
  const mockFsyncFileAndDirectory = jest.mocked(fsyncUtil.fsyncFileAndDirectory);
  const mockHasTaskListSection = jest.mocked(parser.hasTaskListSection);

  beforeEach(() => {
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
    mockFsyncFileAndDirectory.mockReset();
    mockHasTaskListSection.mockReset();
  });

  describe('addTaskListSection', () => {
    describe('正常系', () => {
      it('should add task list section to the end of spec file', () => {
        const specContent = `# 仕様書タイトル

## 1. 概要

## 2. 目的

## 3. 受け入れ基準

### 必須要件

- [ ] タスク1
`;

        const taskListMarkdown = `### 必須要件

- [ ] タスク1
`;

        mockHasTaskListSection.mockReturnValue(false);
        mockReadFileSync.mockReturnValue(specContent);

        addTaskListSection('/path/to/spec.md', taskListMarkdown);

        expect(mockWriteFileSync).toHaveBeenCalledWith(
          '/path/to/spec.md',
          expect.stringContaining('---'),
          'utf-8'
        );
        expect(mockWriteFileSync).toHaveBeenCalledWith(
          '/path/to/spec.md',
          expect.stringContaining('## 8. 実装タスクリスト'),
          'utf-8'
        );
        expect(mockWriteFileSync).toHaveBeenCalledWith(
          '/path/to/spec.md',
          expect.stringContaining(taskListMarkdown.trimEnd()),
          'utf-8'
        );
        expect(mockFsyncFileAndDirectory).toHaveBeenCalledWith('/path/to/spec.md');
      });

      it('should add section separator before task list', () => {
        const specContent = '# 仕様書';
        const taskListMarkdown = '- [ ] タスク1';

        mockHasTaskListSection.mockReturnValue(false);
        mockReadFileSync.mockReturnValue(specContent);

        addTaskListSection('/path/to/spec.md', taskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('\n---\n');
      });

      it('should trim trailing whitespace from existing content', () => {
        const specContent = '# 仕様書\n\n\n  \n';
        const taskListMarkdown = '- [ ] タスク1';

        mockHasTaskListSection.mockReturnValue(false);
        mockReadFileSync.mockReturnValue(specContent);

        addTaskListSection('/path/to/spec.md', taskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toMatch(/^# 仕様書\n\n---/);
      });

      it('should trim trailing whitespace from task list markdown', () => {
        const specContent = '# 仕様書';
        const taskListMarkdown = '- [ ] タスク1\n\n\n  ';

        mockHasTaskListSection.mockReturnValue(false);
        mockReadFileSync.mockReturnValue(specContent);

        addTaskListSection('/path/to/spec.md', taskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toMatch(/- \[ \] タスク1\n$/);
      });

      it('should add newline at the end of file', () => {
        const specContent = '# 仕様書';
        const taskListMarkdown = '- [ ] タスク1';

        mockHasTaskListSection.mockReturnValue(false);
        mockReadFileSync.mockReturnValue(specContent);

        addTaskListSection('/path/to/spec.md', taskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toMatch(/\n$/);
      });

      it('should handle multi-line task list markdown', () => {
        const specContent = '# 仕様書';
        const taskListMarkdown = `### 必須要件

- [ ] タスク1
- [ ] タスク2

### 機能要件

- [ ] タスク3
`;

        mockHasTaskListSection.mockReturnValue(false);
        mockReadFileSync.mockReturnValue(specContent);

        addTaskListSection('/path/to/spec.md', taskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('### 必須要件');
        expect(writtenContent).toContain('- [ ] タスク1');
        expect(writtenContent).toContain('- [ ] タスク2');
        expect(writtenContent).toContain('### 機能要件');
        expect(writtenContent).toContain('- [ ] タスク3');
      });
    });

    describe('エッジケース', () => {
      it('should handle empty task list markdown', () => {
        const specContent = '# 仕様書';
        const taskListMarkdown = '';

        mockHasTaskListSection.mockReturnValue(false);
        mockReadFileSync.mockReturnValue(specContent);

        addTaskListSection('/path/to/spec.md', taskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('## 8. 実装タスクリスト');
        expect(mockFsyncFileAndDirectory).toHaveBeenCalled();
      });

      it('should handle empty spec file', () => {
        const specContent = '';
        const taskListMarkdown = '- [ ] タスク1';

        mockHasTaskListSection.mockReturnValue(false);
        mockReadFileSync.mockReturnValue(specContent);

        addTaskListSection('/path/to/spec.md', taskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('## 8. 実装タスクリスト');
        expect(writtenContent).toContain('- [ ] タスク1');
      });

      it('should handle spec file with only whitespace', () => {
        const specContent = '   \n\n  \n';
        const taskListMarkdown = '- [ ] タスク1';

        mockHasTaskListSection.mockReturnValue(false);
        mockReadFileSync.mockReturnValue(specContent);

        addTaskListSection('/path/to/spec.md', taskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toMatch(/^\n\n---/);
      });
    });

    describe('エラーケース', () => {
      it('should throw error when task list section already exists', () => {
        mockHasTaskListSection.mockReturnValue(true);

        expect(() => addTaskListSection('/path/to/spec.md', '- [ ] タスク1')).toThrow(
          'Task list section already exists in the spec file'
        );

        expect(mockWriteFileSync).not.toHaveBeenCalled();
        expect(mockFsyncFileAndDirectory).not.toHaveBeenCalled();
      });

      it('should throw error when file cannot be read', () => {
        mockHasTaskListSection.mockReturnValue(false);
        mockReadFileSync.mockImplementation(() => {
          throw new Error('ENOENT: no such file or directory');
        });

        expect(() => addTaskListSection('/invalid/path.md', '- [ ] タスク1')).toThrow(
          'ENOENT: no such file or directory'
        );

        expect(mockWriteFileSync).not.toHaveBeenCalled();
        expect(mockFsyncFileAndDirectory).not.toHaveBeenCalled();
      });

      it('should throw error when file cannot be written', () => {
        mockHasTaskListSection.mockReturnValue(false);
        mockReadFileSync.mockReturnValue('# 仕様書');
        mockWriteFileSync.mockImplementation(() => {
          throw new Error('EACCES: permission denied');
        });

        expect(() => addTaskListSection('/path/to/spec.md', '- [ ] タスク1')).toThrow(
          'EACCES: permission denied'
        );

        expect(mockFsyncFileAndDirectory).not.toHaveBeenCalled();
      });
    });
  });

  describe('updateTaskListSection', () => {
    describe('正常系', () => {
      it('should update existing task list section', () => {
        const specContent = `# 仕様書

## 8. 実装タスクリスト

### 必須要件

- [ ] 古いタスク1
- [ ] 古いタスク2

## 9. その他のセクション
`;

        const newTaskListMarkdown = `### 必須要件

- [ ] 新しいタスク1
- [ ] 新しいタスク2
- [ ] 新しいタスク3
`;

        mockHasTaskListSection.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(specContent);

        updateTaskListSection('/path/to/spec.md', newTaskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('## 8. 実装タスクリスト');
        expect(writtenContent).toContain('- [ ] 新しいタスク1');
        expect(writtenContent).toContain('- [ ] 新しいタスク2');
        expect(writtenContent).toContain('- [ ] 新しいタスク3');
        expect(writtenContent).not.toContain('古いタスク1');
        expect(writtenContent).not.toContain('古いタスク2');
        expect(writtenContent).toContain('## 9. その他のセクション');
        expect(mockFsyncFileAndDirectory).toHaveBeenCalledWith('/path/to/spec.md');
      });

      it('should preserve sections before and after task list', () => {
        const specContent = `# 仕様書

## 7. 前のセクション

## 8. 実装タスクリスト

- [ ] 古いタスク

## 9. 後のセクション
`;

        const newTaskListMarkdown = '- [ ] 新しいタスク';

        mockHasTaskListSection.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(specContent);

        updateTaskListSection('/path/to/spec.md', newTaskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('## 7. 前のセクション');
        expect(writtenContent).toContain('## 8. 実装タスクリスト');
        expect(writtenContent).toContain('- [ ] 新しいタスク');
        expect(writtenContent).toContain('## 9. 後のセクション');
        expect(writtenContent).not.toContain('古いタスク');
      });

      it('should handle task list as last section', () => {
        const specContent = `# 仕様書

## 8. 実装タスクリスト

- [ ] 古いタスク
`;

        const newTaskListMarkdown = '- [ ] 新しいタスク';

        mockHasTaskListSection.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(specContent);

        updateTaskListSection('/path/to/spec.md', newTaskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('## 8. 実装タスクリスト');
        expect(writtenContent).toContain('- [ ] 新しいタスク');
        expect(writtenContent).not.toContain('古いタスク');
      });

      it('should trim trailing whitespace from new markdown', () => {
        const specContent = `# 仕様書

## 8. 実装タスクリスト

- [ ] 古いタスク

## 9. その他
`;

        const newTaskListMarkdown = '- [ ] 新しいタスク\n\n\n  ';

        mockHasTaskListSection.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(specContent);

        updateTaskListSection('/path/to/spec.md', newTaskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        const lines = writtenContent.split('\n');
        const taskListIndex = lines.indexOf('## 8. 実装タスクリスト');
        const nextSectionIndex = lines.indexOf('## 9. その他');

        expect(lines[taskListIndex + 1]).toBe('');
        expect(lines[taskListIndex + 2]).toBe('- [ ] 新しいタスク');
        expect(lines[taskListIndex + 3]).toBe('');
        expect(lines[taskListIndex + 4]).toBe('## 9. その他');
      });

      it('should add blank lines around new content', () => {
        const specContent = `# 仕様書

## 8. 実装タスクリスト

- [ ] 古いタスク

## 9. その他
`;

        const newTaskListMarkdown = '- [ ] 新しいタスク';

        mockHasTaskListSection.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(specContent);

        updateTaskListSection('/path/to/spec.md', newTaskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        const lines = writtenContent.split('\n');
        const taskListIndex = lines.indexOf('## 8. 実装タスクリスト');

        expect(lines[taskListIndex + 1]).toBe('');
        expect(lines[taskListIndex + 2]).toBe('- [ ] 新しいタスク');
        expect(lines[taskListIndex + 3]).toBe('');
      });
    });

    describe('エッジケース', () => {
      it('should handle empty new task list markdown', () => {
        const specContent = `# 仕様書

## 8. 実装タスクリスト

- [ ] 古いタスク

## 9. その他
`;

        const newTaskListMarkdown = '';

        mockHasTaskListSection.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(specContent);

        updateTaskListSection('/path/to/spec.md', newTaskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('## 8. 実装タスクリスト');
        expect(writtenContent).not.toContain('古いタスク');
        expect(writtenContent).toContain('## 9. その他');
      });

      it('should handle task list section with no content', () => {
        const specContent = `# 仕様書

## 8. 実装タスクリスト

## 9. その他
`;

        const newTaskListMarkdown = '- [ ] 新しいタスク';

        mockHasTaskListSection.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(specContent);

        updateTaskListSection('/path/to/spec.md', newTaskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('## 8. 実装タスクリスト');
        expect(writtenContent).toContain('- [ ] 新しいタスク');
      });

      it('should handle multiple sections after task list', () => {
        const specContent = `# 仕様書

## 8. 実装タスクリスト

- [ ] 古いタスク

## 9. セクション9

## 10. セクション10

## 11. セクション11
`;

        const newTaskListMarkdown = '- [ ] 新しいタスク';

        mockHasTaskListSection.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(specContent);

        updateTaskListSection('/path/to/spec.md', newTaskListMarkdown);

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('## 8. 実装タスクリスト');
        expect(writtenContent).toContain('- [ ] 新しいタスク');
        expect(writtenContent).toContain('## 9. セクション9');
        expect(writtenContent).toContain('## 10. セクション10');
        expect(writtenContent).toContain('## 11. セクション11');
        expect(writtenContent).not.toContain('古いタスク');
      });
    });

    describe('エラーケース', () => {
      it('should throw error when task list section does not exist', () => {
        mockHasTaskListSection.mockReturnValue(false);

        expect(() => updateTaskListSection('/path/to/spec.md', '- [ ] タスク1')).toThrow(
          'Task list section does not exist in the spec file'
        );

        expect(mockReadFileSync).not.toHaveBeenCalled();
        expect(mockWriteFileSync).not.toHaveBeenCalled();
        expect(mockFsyncFileAndDirectory).not.toHaveBeenCalled();
      });

      it('should throw error when file cannot be read', () => {
        mockHasTaskListSection.mockReturnValue(true);
        mockReadFileSync.mockImplementation(() => {
          throw new Error('ENOENT: no such file or directory');
        });

        expect(() => updateTaskListSection('/invalid/path.md', '- [ ] タスク1')).toThrow(
          'ENOENT: no such file or directory'
        );

        expect(mockWriteFileSync).not.toHaveBeenCalled();
        expect(mockFsyncFileAndDirectory).not.toHaveBeenCalled();
      });

      it('should throw error when file cannot be written', () => {
        const specContent = `## 8. 実装タスクリスト

- [ ] タスク1
`;

        mockHasTaskListSection.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(specContent);
        mockWriteFileSync.mockImplementation(() => {
          throw new Error('EACCES: permission denied');
        });

        expect(() => updateTaskListSection('/path/to/spec.md', '- [ ] 新タスク')).toThrow(
          'EACCES: permission denied'
        );

        expect(mockFsyncFileAndDirectory).not.toHaveBeenCalled();
      });

      it('should throw error when section is not found during update', () => {
        const specContent = `# 仕様書

## 7. その他のセクション
`;

        mockHasTaskListSection.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(specContent);

        expect(() => updateTaskListSection('/path/to/spec.md', '- [ ] タスク1')).toThrow(
          'Task list section not found'
        );
      });
    });
  });
});
