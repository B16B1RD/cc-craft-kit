import { Kysely, Migrator, FileMigrationProvider } from 'kysely';
import { promises as fs } from 'fs';
import path from 'path';

// __dirname の取得（テスト環境との互換性を考慮）
function getDirname(): string {
  // テスト環境では process.cwd() ベースの絶対パスを使用
  // Jest は NODE_ENV を 'test' に設定する
  if (process.env.NODE_ENV === 'test') {
    return path.join(process.cwd(), 'src', 'core', 'database');
  }

  // CommonJS 環境では __dirname を使用
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }

  // ESM 環境では process.cwd() ベースのパスを使用
  // import.meta.url は Jest でサポートされていないため使用しない
  return path.join(process.cwd(), '.cc-craft-kit', 'core', 'database');
}

/**
 * マイグレーションプロバイダー作成
 */
export function createMigrationProvider(): FileMigrationProvider {
  // マイグレーションフォルダのパスを現在のファイルからの相対パスで取得
  // dist/core/database/migrator.js の場合 → dist/core/database/migrations
  // src/core/database/migrator.ts の場合 → src/core/database/migrations
  const migrationsPath = path.join(getDirname(), 'migrations');

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
