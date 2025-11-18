import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import {
  preflightCheck,
  migrate,
  type MigrationConfig,
} from '../../src/scripts/migrate-structure.js';

describe('migrate-structure', () => {
  let testDir: string;

  beforeEach(async () => {
    // 一時ディレクトリを作成
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'takumi-migrate-test-'));
  });

  afterEach(async () => {
    // テスト後にクリーンアップ
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // エラーは無視
    }
  });

  describe('preflightCheck', () => {
    it('should pass when destination directories do not exist', async () => {
      const config: MigrationConfig = {
        dryRun: false,
        verbose: false,
        skipImportFix: false,
        baseDir: testDir,
      };

      const result = await preflightCheck(config);

      expect(result.canProceed).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should fail when src/commands/ already exists', async () => {
      // src/commands/ を作成
      const srcCommands = path.join(testDir, 'src', 'commands');
      await fs.mkdir(srcCommands, { recursive: true });

      const config: MigrationConfig = {
        dryRun: false,
        verbose: false,
        skipImportFix: false,
        baseDir: testDir,
      };

      const result = await preflightCheck(config);

      expect(result.canProceed).toBe(false);
      expect(result.conflicts).toContain('src/commands/');
    });

    it('should fail when src/slash-commands/ already exists', async () => {
      // src/slash-commands/ を作成
      const srcSlashCommands = path.join(testDir, 'src', 'slash-commands');
      await fs.mkdir(srcSlashCommands, { recursive: true });

      const config: MigrationConfig = {
        dryRun: false,
        verbose: false,
        skipImportFix: false,
        baseDir: testDir,
      };

      const result = await preflightCheck(config);

      expect(result.canProceed).toBe(false);
      expect(result.conflicts).toContain('src/slash-commands/');
    });
  });

  describe('migrate', () => {
    it('should migrate .cc-craft-kit/commands/ to src/commands/', async () => {
      // .cc-craft-kit/commands/ を作成
      const takumiCommands = path.join(testDir, '.cc-craft-kit', 'commands');
      await fs.mkdir(takumiCommands, { recursive: true });
      await fs.writeFile(path.join(takumiCommands, 'test.ts'), 'export {}');

      const config: MigrationConfig = {
        dryRun: false,
        verbose: false,
        skipImportFix: false,
        baseDir: testDir,
      };

      const result = await migrate(config);

      expect(result.success).toBe(true);
      expect(result.movedFiles).toContain('test.ts');

      // ファイルが移動されたか確認
      const destPath = path.join(testDir, 'src', 'commands', 'test.ts');
      const exists = await fs
        .access(destPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should migrate .claude/commands/takumi/ to src/slash-commands/', async () => {
      // .claude/commands/takumi/ を作成
      const claudeCommands = path.join(testDir, '.claude', 'commands', 'takumi');
      await fs.mkdir(claudeCommands, { recursive: true });
      await fs.writeFile(path.join(claudeCommands, 'test-command.md'), '# Test');

      const config: MigrationConfig = {
        dryRun: false,
        verbose: false,
        skipImportFix: false,
        baseDir: testDir,
      };

      const result = await migrate(config);

      expect(result.success).toBe(true);
      expect(result.movedFiles).toContain('test-command.md');

      // ファイルが移動されたか確認
      const destPath = path.join(testDir, 'src', 'slash-commands', 'test-command.md');
      const exists = await fs
        .access(destPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should create symlink from .claude/commands/takumi/ to src/slash-commands/', async () => {
      // .claude/commands/takumi/ を作成（移動元）
      const claudeCommands = path.join(testDir, '.claude', 'commands', 'takumi');
      await fs.mkdir(claudeCommands, { recursive: true });
      await fs.writeFile(path.join(claudeCommands, 'test.md'), '# Test');

      const config: MigrationConfig = {
        dryRun: false,
        verbose: false,
        skipImportFix: false,
        baseDir: testDir,
      };

      const result = await migrate(config);

      expect(result.success).toBe(true);
      expect(result.createdSymlinks).toContain('.claude/commands/takumi → src/slash-commands');

      // シンボリックリンクが作成されたか確認
      const linkPath = path.join(testDir, '.claude', 'commands', 'takumi');
      const stats = await fs.lstat(linkPath);
      expect(stats.isSymbolicLink()).toBe(true);
    });

    it('should handle nested directories', async () => {
      // .cc-craft-kit/commands/spec/ にファイルを作成
      const specDir = path.join(testDir, '.cc-craft-kit', 'commands', 'spec');
      await fs.mkdir(specDir, { recursive: true });
      await fs.writeFile(path.join(specDir, 'create.ts'), 'export {}');
      await fs.writeFile(path.join(specDir, 'update.ts'), 'export {}');

      const config: MigrationConfig = {
        dryRun: false,
        verbose: false,
        skipImportFix: false,
        baseDir: testDir,
      };

      const result = await migrate(config);

      expect(result.success).toBe(true);
      expect(result.movedFiles).toContain('spec/create.ts');
      expect(result.movedFiles).toContain('spec/update.ts');

      // ファイルが正しい場所に移動されたか確認
      const createPath = path.join(testDir, 'src', 'commands', 'spec', 'create.ts');
      const updatePath = path.join(testDir, 'src', 'commands', 'spec', 'update.ts');

      const createExists = await fs
        .access(createPath)
        .then(() => true)
        .catch(() => false);
      const updateExists = await fs
        .access(updatePath)
        .then(() => true)
        .catch(() => false);

      expect(createExists).toBe(true);
      expect(updateExists).toBe(true);
    });

    it('should support dry-run mode', async () => {
      // .cc-craft-kit/commands/ を作成
      const takumiCommands = path.join(testDir, '.cc-craft-kit', 'commands');
      await fs.mkdir(takumiCommands, { recursive: true });
      await fs.writeFile(path.join(takumiCommands, 'test.ts'), 'export {}');

      const config: MigrationConfig = {
        dryRun: true,
        verbose: false,
        skipImportFix: false,
        baseDir: testDir,
      };

      const result = await migrate(config);

      expect(result.success).toBe(true);
      expect(result.movedFiles).toContain('test.ts');

      // ファイルが実際には移動されていないか確認
      const sourcePath = path.join(takumiCommands, 'test.ts');
      const destPath = path.join(testDir, 'src', 'commands', 'test.ts');

      const sourceExists = await fs
        .access(sourcePath)
        .then(() => true)
        .catch(() => false);
      const destExists = await fs
        .access(destPath)
        .then(() => true)
        .catch(() => false);

      expect(sourceExists).toBe(true); // 元ファイルはそのまま
      expect(destExists).toBe(false); // 移動先には存在しない
    });

    it('should skip migration if source directories do not exist', async () => {
      // ソースディレクトリを作成しない

      const config: MigrationConfig = {
        dryRun: false,
        verbose: false,
        skipImportFix: false,
        baseDir: testDir,
      };

      const result = await migrate(config);

      expect(result.success).toBe(true);
      expect(result.movedFiles).toHaveLength(0);
    });

    it('should fail if destination directories already exist', async () => {
      // src/commands/ を事前に作成（競合）
      const srcCommands = path.join(testDir, 'src', 'commands');
      await fs.mkdir(srcCommands, { recursive: true });

      // .cc-craft-kit/commands/ も作成
      const takumiCommands = path.join(testDir, '.cc-craft-kit', 'commands');
      await fs.mkdir(takumiCommands, { recursive: true });
      await fs.writeFile(path.join(takumiCommands, 'test.ts'), 'export {}');

      const config: MigrationConfig = {
        dryRun: false,
        verbose: false,
        skipImportFix: false,
        baseDir: testDir,
      };

      const result = await migrate(config);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].file).toBe('preflight');
    });
  });
});
