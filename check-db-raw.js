#!/usr/bin/env node
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', '.cc-craft-kit', 'cc-craft-kit.db');
const db = new Database(dbPath, { readonly: true });

console.log('=== テーブル一覧 ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables);

console.log('\n=== specs テーブルのスキーマ ===');
const specsSchema = db.prepare("PRAGMA table_info(specs)").all();
console.log(specsSchema);

console.log('\n=== specs テーブルの全データ ===');
const specs = db.prepare("SELECT * FROM specs").all();
console.log(JSON.stringify(specs, null, 2));

console.log('\n=== specs テーブルの行数 ===');
const count = db.prepare("SELECT COUNT(*) as count FROM specs").get();
console.log(count);

db.close();
