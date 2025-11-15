#!/usr/bin/env node
/**
 * マイグレーション履歴修正スクリプト
 *
 * 既存のテーブルに対してマイグレーション履歴を手動で記録する
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.join(projectRoot, '.takumi', 'takumi.db');

const db = new Database(dbPath);

console.log('🔧 マイグレーション履歴を修正しています...\n');

// 現在の履歴を確認
console.log('📜 修正前のマイグレーション履歴:');
const beforeMigrations = db.prepare("SELECT * FROM kysely_migration").all();
if (beforeMigrations.length === 0) {
  console.log('  → レコードなし\n');
} else {
  console.table(beforeMigrations);
}

// マイグレーション履歴を手動で記録
const now = new Date().toISOString();

try {
  const stmt = db.prepare(`
    INSERT INTO kysely_migration (name, timestamp)
    VALUES (?, ?)
  `);

  stmt.run('001_initial_schema', now);

  console.log('✅ マイグレーション履歴を追加しました\n');

  // 修正後の履歴を確認
  console.log('📜 修正後のマイグレーション履歴:');
  const afterMigrations = db.prepare("SELECT * FROM kysely_migration").all();
  console.table(afterMigrations);

  console.log('\n🎉 修正完了！\n');
  console.log('📌 次のステップ:');
  console.log('  1. MCPサーバーを起動: npm run mcp:dev');
  console.log('  2. エラーが発生しないことを確認');
  console.log('  3. MCPツールが動作することを確認\n');
} catch (error: any) {
  if (error.message.includes('UNIQUE constraint failed')) {
    console.log('⚠️  マイグレーション履歴は既に存在します');
    console.log('   → 修正不要です\n');
  } else {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
} finally {
  db.close();
}
