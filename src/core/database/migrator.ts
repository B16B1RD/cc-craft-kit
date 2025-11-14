import { Kysely, Migrator, FileMigrationProvider } from 'kysely';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * マイグレーションプロバイダー作成
 */
export function createMigrationProvider(): FileMigrationProvider {
  return new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(__dirname, 'migrations'),
  });
}

/**
 * マイグレーター作成
 */
export function createMigrator(db: Kysely<any>): Migrator {
  return new Migrator({
    db,
    provider: createMigrationProvider(),
  });
}

/**
 * マイグレーション実行
 */
export async function migrateToLatest(db: Kysely<any>): Promise<void> {
  const migrator = createMigrator(db);

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((result) => {
    if (result.status === 'Success') {
      console.log(`✓ Migration "${result.migrationName}" executed successfully`);
    } else if (result.status === 'Error') {
      console.error(`✗ Migration "${result.migrationName}" failed`);
    }
  });

  if (error) {
    console.error('Migration failed:', error);
    throw error;
  }

  console.log('All migrations executed successfully');
}

/**
 * マイグレーションロールバック
 */
export async function migrateDown(db: Kysely<any>): Promise<void> {
  const migrator = createMigrator(db);

  const { error, results } = await migrator.migrateDown();

  results?.forEach((result) => {
    if (result.status === 'Success') {
      console.log(`✓ Migration "${result.migrationName}" rolled back successfully`);
    } else if (result.status === 'Error') {
      console.error(`✗ Migration "${result.migrationName}" rollback failed`);
    }
  });

  if (error) {
    console.error('Rollback failed:', error);
    throw error;
  }

  console.log('Rollback completed successfully');
}
