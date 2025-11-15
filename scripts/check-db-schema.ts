#!/usr/bin/env node
/**
 * データベーススキーマ確認スクリプト
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.join(projectRoot, '.takumi', 'takumi.db');

const db = new Database(dbPath);

console.log('📋 現在のデータベーススキーマ:\n');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

for (const table of tables as { name: string }[]) {
  console.log(`\n### ${table.name} テーブル`);
  const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table.name);
  console.log((schema as { sql: string }).sql);
}

// マイグレーション履歴確認
console.log('\n\n📜 マイグレーション履歴:');
try {
  const migrations = db.prepare("SELECT * FROM kysely_migration").all();
  if (migrations.length === 0) {
    console.log('  → マイグレーション履歴テーブルは存在するが、レコードなし');
  } else {
    console.table(migrations);
  }
} catch (error) {
  console.log('  → kysely_migration テーブルが存在しません');
}

db.close();
