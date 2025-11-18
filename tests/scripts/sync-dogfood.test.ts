import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import { syncSourceToTakumi, syncSlashCommands, syncAll } from '../../src/scripts/sync-dogfood.js';

describe('sync-dogfood', () => {
  let testDir: string;

  beforeEach(async () => {
    // 一時ディレクトリを作成
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'takumi-sync-test-'));
  });

  afterEach(async () => {
    // テスト後にクリーンアップ
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // エラーは無視
    }
  });

  describe('syncSourceToTakumi', () => {
    it('should copy modified files from src/ to .cc-craft-kit/', async () => {
      // src/ と .cc-craft-kit/ を作成
      const srcDir = path.join(testDir, 'src', 'core');
      const ccCraftKitDir = path.join(testDir, '.cc-craft-kit', 'core');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(ccCraftKitDir, { recursive: true });

      // 異なる内容のファイルを作成
      await fs.writeFile(path.join(srcDir, 'file.ts'), 'new content');
      await fs.writeFile(path.join(ccCraftKitDir, 'file.ts'), 'old content');

      // 同期実行
      const result = await syncSourceToTakumi({ baseDir: testDir, verbose: false });

      // 検証
      expect(result.success).toBe(true);
      expect(result.copiedFiles).toBe(1);
      expect(result.deletedFiles).toBe(0);
      expect(result.errors).toHaveLength(0);

      // ファイル内容が同期されたか確認
      const content = await fs.readFile(path.join(ccCraftKitDir, 'file.ts'), 'utf-8');
      expect(content).toBe('new content');
    });

    it('should copy missing files to .cc-craft-kit/', async () => {
      // src/ のみにファイルを作成
      const srcDir = path.join(testDir, 'src', 'core');
      await fs.mkdir(srcDir, { recursive: true });
      await fs.writeFile(path.join(srcDir, 'new-file.ts'), 'content');

      // .cc-craft-kit/ ディレクトリは存在しない状態

      // 同期実行
      const result = await syncSourceToTakumi({ baseDir: testDir, verbose: false });

      // 検証
      expect(result.success).toBe(true);
      expect(result.copiedFiles).toBe(1);

      // ファイルが作成されたか確認
      const takumiPath = path.join(testDir, '.cc-craft-kit', 'core', 'new-file.ts');
      const content = await fs.readFile(takumiPath, 'utf-8');
      expect(content).toBe('content');
    });

    it('should delete extra files from .cc-craft-kit/', async () => {
      // src/ は空、.cc-craft-kit/ にのみファイルが存在
      const srcDir = path.join(testDir, 'src', 'core');
      const ccCraftKitDir = path.join(testDir, '.cc-craft-kit', 'core');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(ccCraftKitDir, { recursive: true });
      await fs.writeFile(path.join(ccCraftKitDir, 'extra-file.ts'), 'old content');

      // 同期実行
      const result = await syncSourceToTakumi({ baseDir: testDir, verbose: false });

      // 検証
      expect(result.success).toBe(true);
      expect(result.deletedFiles).toBe(1);

      // ファイルが削除されたか確認
      const exists = await fs
        .access(path.join(ccCraftKitDir, 'extra-file.ts'))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('should do nothing when already in sync', async () => {
      // src/ と .cc-craft-kit/ に同じ内容のファイルを作成
      const srcDir = path.join(testDir, 'src', 'core');
      const ccCraftKitDir = path.join(testDir, '.cc-craft-kit', 'core');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(ccCraftKitDir, { recursive: true });

      await fs.writeFile(path.join(srcDir, 'file.ts'), 'same content');
      await fs.writeFile(path.join(ccCraftKitDir, 'file.ts'), 'same content');

      // 同期実行
      const result = await syncSourceToTakumi({ baseDir: testDir, verbose: false });

      // 検証
      expect(result.success).toBe(true);
      expect(result.copiedFiles).toBe(0);
      expect(result.deletedFiles).toBe(0);
    });

    it('should support dry-run mode', async () => {
      // src/ と .cc-craft-kit/ を作成
      const srcDir = path.join(testDir, 'src', 'core');
      const ccCraftKitDir = path.join(testDir, '.cc-craft-kit', 'core');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(ccCraftKitDir, { recursive: true });

      await fs.writeFile(path.join(srcDir, 'file.ts'), 'new content');
      await fs.writeFile(path.join(ccCraftKitDir, 'file.ts'), 'old content');

      // Dry-run モードで同期実行
      const result = await syncSourceToTakumi({ baseDir: testDir, dryRun: true, verbose: false });

      // 検証
      expect(result.success).toBe(true);
      expect(result.copiedFiles).toBe(1);

      // ファイルが実際には変更されていないか確認
      const content = await fs.readFile(path.join(ccCraftKitDir, 'file.ts'), 'utf-8');
      expect(content).toBe('old content');
    });
  });

  describe('syncSlashCommands', () => {
    it('should copy slash command files', async () => {
      // .claude/commands/takumi/ を作成
      const commandsDir = path.join(testDir, '.claude', 'commands', 'takumi');
      await fs.mkdir(commandsDir, { recursive: true });

      await fs.writeFile(path.join(commandsDir, 'test-command.md'), '# Test Command');

      // 同期実行
      const result = await syncSlashCommands({ baseDir: testDir, verbose: false });

      // 検証
      expect(result.success).toBe(true);
      expect(result.copiedFiles).toBe(1);

      // ファイルがコピーされたか確認
      const destPath = path.join(testDir, '.cc-craft-kit', 'slash-commands', 'test-command.md');
      const content = await fs.readFile(destPath, 'utf-8');
      expect(content).toBe('# Test Command');
    });

    it('should skip if source directory does not exist', async () => {
      // .claude/commands/takumi/ が存在しない状態で実行

      const result = await syncSlashCommands({ baseDir: testDir, verbose: false });

      // 検証
      expect(result.success).toBe(true);
      expect(result.copiedFiles).toBe(0);
    });

    it('should only copy .md files', async () => {
      // .claude/commands/takumi/ に複数のファイルを作成
      const commandsDir = path.join(testDir, '.claude', 'commands', 'takumi');
      await fs.mkdir(commandsDir, { recursive: true });

      await fs.writeFile(path.join(commandsDir, 'command1.md'), '# Command 1');
      await fs.writeFile(path.join(commandsDir, 'command2.md'), '# Command 2');
      await fs.writeFile(path.join(commandsDir, 'readme.txt'), 'Not a command');

      // 同期実行
      const result = await syncSlashCommands({ baseDir: testDir, verbose: false });

      // 検証
      expect(result.success).toBe(true);
      expect(result.copiedFiles).toBe(2);

      // .txt ファイルはコピーされていないか確認
      const txtExists = await fs
        .access(path.join(testDir, '.cc-craft-kit', 'slash-commands', 'readme.txt'))
        .then(() => true)
        .catch(() => false);
      expect(txtExists).toBe(false);
    });
  });

  describe('syncAll', () => {
    it('should sync both source and slash commands', async () => {
      // src/ を作成
      const srcDir = path.join(testDir, 'src', 'core');
      await fs.mkdir(srcDir, { recursive: true });
      await fs.writeFile(path.join(srcDir, 'file.ts'), 'content');

      // .claude/commands/takumi/ を作成
      const commandsDir = path.join(testDir, '.claude', 'commands', 'takumi');
      await fs.mkdir(commandsDir, { recursive: true });
      await fs.writeFile(path.join(commandsDir, 'command.md'), '# Command');

      // 完全同期実行
      const success = await syncAll({ baseDir: testDir, verbose: false });

      // 検証
      expect(success).toBe(true);

      // 両方のファイルが同期されたか確認
      const sourceExists = await fs
        .access(path.join(testDir, '.cc-craft-kit', 'core', 'file.ts'))
        .then(() => true)
        .catch(() => false);
      const commandExists = await fs
        .access(path.join(testDir, '.cc-craft-kit', 'slash-commands', 'command.md'))
        .then(() => true)
        .catch(() => false);

      expect(sourceExists).toBe(true);
      expect(commandExists).toBe(true);
    });
  });
});
