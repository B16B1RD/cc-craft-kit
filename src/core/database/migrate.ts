#!/usr/bin/env node
import 'reflect-metadata';
import { createDatabase } from './connection.js';
import { migrateToLatest, migrateDown } from './migrator.js';

/**
 * マイグレーションCLI
 */
async function main() {
  const command = process.argv[2];

  const db = createDatabase({ verbose: true });

  try {
    switch (command) {
      case 'up':
      case undefined:
        console.log('Running migrations...');
        await migrateToLatest(db);
        break;

      case 'down':
        console.log('Rolling back last migration...');
        await migrateDown(db);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Usage: tsx migrate.ts [up|down]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
