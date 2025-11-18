#!/usr/bin/env node

/**
 * replace-takumi-references.ts
 *
 * Replaces all references from "takumi" to "cc-craft-kit" across the codebase.
 *
 * Usage:
 *   npx tsx src/scripts/replace-takumi-references.ts [--dry-run]
 */

import { promises as fs } from 'fs';
import path from 'path';

interface Replacement {
  from: RegExp;
  to: string;
  description: string;
}

const replacements: Replacement[] = [
  {
    from: /\.cc-craft-kit/g,
    to: '.cc-craft-kit',
    description: 'Directory path: .cc-craft-kit → .cc-craft-kit',
  },
  {
    from: /takumi\.db/g,
    to: 'cc-craft-kit.db',
    description: 'Database file: cc-craft-kit.db → cc-craft-kit.db',
  },
  {
    from: /\/cft:/g,
    to: '/cft:',
    description: 'Slash commands: /cft: → /cft:',
  },
  {
    from: /ccCraftKitDir/g,
    to: 'ccCraftKitDir',
    description: 'Variable name: ccCraftKitDir → ccCraftKitDir',
  },
];

const filePatterns = [
  'src/**/*.ts',
  'tests/**/*.ts',
  '.claude/commands/**/*.md',
  'package.json',
  'README.md',
  'CLAUDE.md',
  'docs/**/*.md',
];

interface ReplacementResult {
  file: string;
  replacements: number;
  changes: Array<{ line: number; old: string; new: string }>;
}

/**
 * Recursively find all files matching the given patterns
 */
async function findFiles(patterns: string[]): Promise<string[]> {
  const allFiles: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules and .git
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        // Check if file matches any pattern
        for (const pattern of patterns) {
          const ext = pattern.split('*').pop() || '';
          if (fullPath.endsWith(ext) || fullPath.includes(pattern.replace('**/', ''))) {
            allFiles.push(fullPath);
            break;
          }
        }
      }
    }
  }

  await walk(process.cwd());
  return allFiles;
}

async function replaceInFile(
  filePath: string,
  dryRun: boolean
): Promise<ReplacementResult | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    let newContent = content;
    let totalReplacements = 0;
    const changes: Array<{ line: number; old: string; new: string }> = [];

    for (const { from, to } of replacements) {
      const matches = content.match(from);
      if (matches) {
        totalReplacements += matches.length;
        newContent = newContent.replace(from, to);

        // Record line-level changes for reporting
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (from.test(line)) {
            changes.push({
              line: index + 1,
              old: line.trim(),
              new: line.replace(from, to).trim(),
            });
          }
        });
      }
    }

    if (totalReplacements > 0) {
      if (!dryRun) {
        await fs.writeFile(filePath, newContent, 'utf-8');
      }
      return {
        file: filePath,
        replacements: totalReplacements,
        changes,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, (error as Error).message);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('\n# Replace Takumi References\n');

  if (dryRun) {
    console.log('🔍 Running in DRY-RUN mode (no files will be modified)\n');
  }

  console.log('Replacement patterns:');
  replacements.forEach((replacement) => {
    console.log(`  • ${replacement.description}`);
  });
  console.log();

  console.log('Scanning files...');
  const allFiles = await findFiles(filePatterns);

  console.log(`  Found ${allFiles.length} files\n`);

  const results: ReplacementResult[] = [];
  for (const file of allFiles) {
    const result = await replaceInFile(file, dryRun);
    if (result) {
      results.push(result);
    }
  }

  console.log('Results:\n');

  if (results.length === 0) {
    console.log('✓ No replacements needed. All references are already up-to-date.\n');
    process.exit(0);
  }

  let totalReplacements = 0;
  results.forEach((result) => {
    totalReplacements += result.replacements;
    console.log(`${result.file}:`);
    console.log(`  ${result.replacements} replacement(s)`);

    if (result.changes.length <= 5) {
      result.changes.forEach((change) => {
        console.log(`    Line ${change.line}:`);
        console.log(`      - ${change.old}`);
        console.log(`      + ${change.new}`);
      });
    } else {
      console.log(`    (${result.changes.length} changes - too many to display)`);
    }
    console.log();
  });

  console.log('Summary:');
  console.log(`  Files modified: ${results.length}`);
  console.log(`  Total replacements: ${totalReplacements}`);
  console.log();

  if (dryRun) {
    console.log('⚠️  This was a dry run. Run without --dry-run to apply changes.\n');
    process.exit(0);
  }

  console.log('✓ All replacements completed successfully!\n');

  console.log('Next steps:');
  console.log('  1. Review changes: git diff');
  console.log('  2. Run tests: npm test');
  console.log('  3. Build project: npm run build');
  console.log('  4. Sync dogfood: npm run sync:dogfood');
  console.log();

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
