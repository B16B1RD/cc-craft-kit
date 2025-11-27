#!/usr/bin/env node
/**
 * Takumiドッグフーディング用の初期化スクリプト
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Config {
  name: string;
  description: string;
  githubRepo: string | null;
  createdAt: string;
  version: string;
}

async function initProject() {
  const projectName = 'cc-craft-kit';
  const description = 'cc-craft-kitプロジェクト自体の開発管理（ドッグフーディング）';
  const githubRepo = 'B16B1RD/cc-craft-kit';

  const projectRoot = path.resolve(__dirname, '..');
  const ccCraftKitDir = path.join(projectRoot, '.cc-craft-kit');
  const specsDir = path.join(ccCraftKitDir, 'specs');
  const configFile = path.join(ccCraftKitDir, 'config.json');
  const dbPath = path.join(ccCraftKitDir, 'cc-craft-kit.db');

  console.log('🚀 cc-craft-kitプロジェクトを初期化しています...');

  // .cc-craft-kitディレクトリ作成
  await fs.mkdir(ccCraftKitDir, { recursive: true });
  await fs.mkdir(specsDir, { recursive: true });
  console.log(`✅ ディレクトリ作成: ${ccCraftKitDir}`);

  // config.json作成
  const config: Config = {
    name: projectName,
    description,
    githubRepo,
    createdAt: new Date().toISOString(),
    version: '0.1.0',
  };

  await fs.writeFile(configFile, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`✅ 設定ファイル作成: ${configFile}`);

  // データベース初期化
  const db = new Database(dbPath);
  const kysely = new Kysely({
    dialect: new SqliteDialect({ database: db }),
  });

  // マイグレーション実行
  console.log('📦 データベースマイグレーション実行中...');

  // specs テーブル
  await kysely.schema
    .createTable('specs')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('phase', 'text', (col) => col.notNull().defaultTo('requirements'))
    .addColumn('content', 'text')
    .addColumn('github_issue_number', 'integer')
    .addColumn('created_at', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'text', (col) => col.notNull())
    .execute();

  // tasks テーブル
  await kysely.schema
    .createTable('tasks')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('spec_id', 'text', (col) => col.notNull().references('specs.id').onDelete('cascade'))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('todo'))
    .addColumn('priority', 'integer', (col) => col.defaultTo(0))
    .addColumn('assigned_to', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'text', (col) => col.notNull())
    .execute();

  // logs テーブル
  await kysely.schema
    .createTable('logs')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('timestamp', 'text', (col) => col.notNull())
    .addColumn('level', 'text', (col) => col.notNull())
    .addColumn('message', 'text', (col) => col.notNull())
    .addColumn('metadata', 'text')
    .execute();

  // github_sync テーブル
  await kysely.schema
    .createTable('github_sync')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('entity_type', 'text', (col) => col.notNull())
    .addColumn('entity_id', 'text', (col) => col.notNull())
    .addColumn('github_id', 'text', (col) => col.notNull())
    .addColumn('sync_direction', 'text', (col) => col.notNull())
    .addColumn('synced_at', 'text', (col) => col.notNull())
    .addColumn('metadata', 'text')
    .execute();

  await kysely.destroy();
  db.close();

  console.log('✅ データベース初期化完了');

  console.log('\n🎉 Takumiプロジェクトの初期化が完了しました！\n');
  console.log('📁 作成されたファイル:');
  console.log(`  - ${configFile}`);
  console.log(`  - ${dbPath}`);
  console.log(`  - ${specsDir}/\n`);

  console.log('📋 設定内容:');
  console.log(JSON.stringify(config, null, 2));

  console.log('\n📝 次のステップ:');
  console.log('  1. 仕様書を作成: /cft:spec-create "機能名"');
  console.log('  2. 仕様書一覧: /cft:spec-list');
  console.log('  3. プロジェクト状況: /cft:status');
}

initProject().catch((error) => {
  console.error('❌ 初期化エラー:', error);
  process.exit(1);
});
