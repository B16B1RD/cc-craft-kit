import { Kysely, Migrator, FileMigrationProvider } from 'kysely';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * マイグレーションプロバイダー作成
 */
export function createMigrationProvider(): FileMigrationProvider {
  // マイグレーションフォルダのパスを現在のファイルからの相対パスで取得
  // dist/core/database/migrator.js の場合 → dist/core/database/migrations
  // src/core/database/migrator.ts の場合 → src/core/database/migrations
  const migrationsPath = path.join(__dirname, 'migrations');

  return new FileMigrationProvider({
    fs,
    path,
    migrationFolder: migrationsPath,
  });
}

/**
 * マイグレーター作成
 */
export function createMigrator<T>(db: Kysely<T>): Migrator {
  return new Migrator({
    db,
    provider: createMigrationProvider(),
  });
}

/**
 * マイグレーション実行
 */
export async function migrateToLatest<T>(db: Kysely<T>): Promise<void> {
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
export async function migrateDown<T>(db: Kysely<T>): Promise<void> {
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
