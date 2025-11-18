#!/usr/bin/env node

/**
 * migrate-takumi-to-cc-craft-kit.ts
 *
 * Migrates existing .takumi/ data to .cc-craft-kit/ directory.
 * Includes backup, rollback, and idempotency features.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-takumi-to-cc-craft-kit.ts [--dry-run] [--force]
 */

import { promises as fs } from 'fs';
import path from 'path';

interface MigrationOptions {
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
}

interface MigrationResult {
  success: boolean;
  filescopied: number;
  backupPath?: string;
  errors: string[];
}

const TAKUMI_DIR = '.takumi';
const CC_CRAFT_KIT_DIR = '.cc-craft-kit';
const BACKUP_SUFFIX = '.backup';
const MIGRATION_FLAG_FILE = '.migrated';

/**
 * Check if migration has already been completed
 */
async function isMigrationCompleted(): Promise<boolean> {
  try {
    const flagPath = path.join(CC_CRAFT_KIT_DIR, MIGRATION_FLAG_FILE);
    await fs.access(flagPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if source directory exists
 */
async function checkSourceExists(): Promise<boolean> {
  try {
    await fs.access(TAKUMI_DIR);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if destination directory exists
 */
async function checkDestinationExists(): Promise<boolean> {
  try {
    await fs.access(CC_CRAFT_KIT_DIR);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create backup of source directory
 */
async function createBackup(options: MigrationOptions): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const backupPath = `${TAKUMI_DIR}${BACKUP_SUFFIX}-${timestamp}`;

  console.log(`Creating backup: ${backupPath}`);

  if (!options.dryRun) {
    await copyDirectory(TAKUMI_DIR, backupPath);
  }

  return backupPath;
}

/**
 * Recursively copy directory
 */
async function copyDirectory(src: string, dest: string): Promise<number> {
  let filesCopied = 0;

  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      filesCopied += await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
      filesCopied++;
    }
  }

  return filesCopied;
}

/**
 * Validate migration integrity
 */
async function validateMigration(): Promise<boolean> {
  try {
    // Check if critical files exist
    const criticalPaths = [
      path.join(CC_CRAFT_KIT_DIR, 'cc-craft-kit.db'),
      path.join(CC_CRAFT_KIT_DIR, 'specs'),
    ];

    for (const criticalPath of criticalPaths) {
      try {
        await fs.access(criticalPath);
      } catch {
        console.error(`❌ Critical path missing: ${criticalPath}`);
        return false;
      }
    }

    // Check if database file exists and is not empty
    const dbPath = path.join(CC_CRAFT_KIT_DIR, 'cc-craft-kit.db');
    const stats = await fs.stat(dbPath);
    if (stats.size === 0) {
      console.error('❌ Database file is empty');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Validation failed:', (error as Error).message);
    return false;
  }
}

/**
 * Create migration flag file
 */
async function createMigrationFlag(options: MigrationOptions): Promise<void> {
  const flagPath = path.join(CC_CRAFT_KIT_DIR, MIGRATION_FLAG_FILE);
  const content = JSON.stringify(
    {
      migrated_at: new Date().toISOString(),
      source: TAKUMI_DIR,
      destination: CC_CRAFT_KIT_DIR,
      version: '1.0.0',
    },
    null,
    2
  );

  if (!options.dryRun) {
    await fs.writeFile(flagPath, content, 'utf-8');
  }

  console.log(`✓ Migration flag created: ${flagPath}`);
}

/**
 * Perform the migration
 */
async function migrate(options: MigrationOptions): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    filescopied: 0,
    errors: [],
  };

  try {
    console.log('\n# Migrate .takumi to .cc-craft-kit\n');

    if (options.dryRun) {
      console.log('🔍 Running in DRY-RUN mode (no changes will be made)\n');
    }

    // 1. Check if already migrated
    if ((await isMigrationCompleted()) && !options.force) {
      console.log('✓ Migration already completed. Use --force to re-run.\n');
      result.success = true;
      return result;
    }

    // 2. Check if source exists
    if (!(await checkSourceExists())) {
      console.log(`ℹ️  No ${TAKUMI_DIR} directory found. Nothing to migrate.\n`);
      result.success = true;
      return result;
    }

    // 3. Check if destination already exists (without force)
    if ((await checkDestinationExists()) && !options.force) {
      result.errors.push(`${CC_CRAFT_KIT_DIR} already exists. Use --force to overwrite.`);
      console.error(`❌ ${result.errors[0]}\n`);
      return result;
    }

    // 4. Create backup
    console.log('Step 1: Creating backup...');
    result.backupPath = await createBackup(options);
    console.log(`✓ Backup created: ${result.backupPath}\n`);

    // 5. Copy files to new directory
    console.log('Step 2: Copying files to new directory...');
    if (!options.dryRun) {
      result.filescopied = await copyDirectory(TAKUMI_DIR, CC_CRAFT_KIT_DIR);
    } else {
      // Count files in dry-run mode
      result.filescopied = await countFiles(TAKUMI_DIR);
    }
    console.log(`✓ Copied ${result.filescopied} files\n`);

    // 6. Rename database file
    console.log('Step 3: Renaming database file...');
    const oldDbPath = path.join(CC_CRAFT_KIT_DIR, 'takumi.db');
    const newDbPath = path.join(CC_CRAFT_KIT_DIR, 'cc-craft-kit.db');

    if (!options.dryRun) {
      try {
        await fs.access(oldDbPath);
        await fs.rename(oldDbPath, newDbPath);
        console.log(`✓ Renamed: takumi.db → cc-craft-kit.db\n`);
      } catch {
        console.log('ℹ️  No database file to rename\n');
      }
    } else {
      console.log('✓ [DRY-RUN] Would rename: takumi.db → cc-craft-kit.db\n');
    }

    // 7. Validate migration
    console.log('Step 4: Validating migration...');
    if (!options.dryRun) {
      const isValid = await validateMigration();
      if (!isValid) {
        result.errors.push('Migration validation failed');
        console.error('❌ Validation failed. Rolling back...\n');
        await rollback(result.backupPath!, options);
        return result;
      }
    }
    console.log('✓ Migration validated successfully\n');

    // 8. Create migration flag
    console.log('Step 5: Creating migration flag...');
    await createMigrationFlag(options);
    console.log();

    result.success = true;
    return result;
  } catch (error) {
    result.errors.push((error as Error).message);
    console.error('❌ Migration failed:', (error as Error).message);

    if (result.backupPath) {
      console.error('\nAttempting rollback...');
      await rollback(result.backupPath, options);
    }

    return result;
  }
}

/**
 * Count files in directory recursively
 */
async function countFiles(dir: string): Promise<number> {
  let count = 0;

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      count += await countFiles(fullPath);
    } else {
      count++;
    }
  }

  return count;
}

/**
 * Rollback migration by restoring from backup
 */
async function rollback(backupPath: string, options: MigrationOptions): Promise<void> {
  try {
    console.log(`Rolling back from: ${backupPath}`);

    if (!options.dryRun) {
      // Remove destination directory
      try {
        await fs.rm(CC_CRAFT_KIT_DIR, { recursive: true, force: true });
      } catch {
        // Ignore if destination doesn't exist
      }

      // Restore from backup
      await copyDirectory(backupPath, TAKUMI_DIR);
    }

    console.log('✓ Rollback completed successfully\n');
  } catch (error) {
    console.error('❌ Rollback failed:', (error as Error).message);
    console.error(`Manual intervention required. Backup is at: ${backupPath}\n`);
  }
}

/**
 * Clean up old directory (optional)
 */
async function promptCleanup(options: MigrationOptions): Promise<void> {
  if (options.dryRun) {
    console.log('Cleanup options:');
    console.log(`  • Remove old directory: rm -rf ${TAKUMI_DIR} (after confirming migration)`);
    return;
  }

  console.log('\nMigration completed successfully!');
  console.log('\nNext steps:');
  console.log('  1. Verify the migration: ls -la .cc-craft-kit/');
  console.log('  2. Test the application');
  console.log(`  3. Remove old directory: rm -rf ${TAKUMI_DIR}`);
  console.log(`  4. Remove backup: rm -rf ${TAKUMI_DIR}${BACKUP_SUFFIX}-*`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    verbose: args.includes('--verbose'),
  };

  const result = await migrate(options);

  if (result.success) {
    console.log('✓ Migration completed successfully!\n');
    console.log('Summary:');
    console.log(`  Files copied: ${result.filescopied}`);
    if (result.backupPath) {
      console.log(`  Backup location: ${result.backupPath}`);
    }
    console.log();

    await promptCleanup(options);
    process.exit(0);
  } else {
    console.error('\n❌ Migration failed!\n');
    console.error('Errors:');
    result.errors.forEach((error) => {
      console.error(`  • ${error}`);
    });
    console.error();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
