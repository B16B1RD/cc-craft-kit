#!/usr/bin/env node
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', '.takumi', 'takumi.db');
const db = new Database(dbPath, { readonly: true });

console.log('# Takumi プロジェクト状況\n');

// プロジェクト情報
const config = JSON.parse(
  await import('fs').then(fs =>
    fs.promises.readFile(join(__dirname, '..', '.takumi', 'config.json'), 'utf-8')
  )
);
console.log(`プロジェクト名: ${config.project.name}`);
console.log(`初期化日時: ${new Date(config.project.initialized_at).toLocaleString('ja-JP')}\n`);

// フェーズ別仕様書数
console.log('## フェーズ別仕様書');
const phaseStats = db.prepare(`
  SELECT phase, COUNT(*) as count
  FROM specs
  GROUP BY phase
  ORDER BY
    CASE phase
      WHEN 'requirements' THEN 1
      WHEN 'design' THEN 2
      WHEN 'tasks' THEN 3
      WHEN 'implementation' THEN 4
      WHEN 'completed' THEN 5
      ELSE 6
    END
`).all();

phaseStats.forEach(stat => {
  const phaseNames = {
    'requirements': '要件定義',
    'design': '設計',
    'tasks': 'タスク化',
    'implementation': '実装',
    'completed': '完了'
  };
  console.log(`- ${phaseNames[stat.phase] || stat.phase}: ${stat.count}件`);
});

console.log('\n## 最近の仕様書');
const recentSpecs = db.prepare(`
  SELECT id, name, phase, created_at
  FROM specs
  ORDER BY created_at DESC
  LIMIT 10
`).all();

recentSpecs.forEach(spec => {
  const date = new Date(spec.created_at).toLocaleDateString('ja-JP');
  const phaseNames = {
    'requirements': '要件定義',
    'design': '設計',
    'tasks': 'タスク化',
    'implementation': '実装',
    'testing': 'テスト',
    'completed': '完了'
  };
  console.log(`- [${spec.id.substring(0, 8)}...] ${spec.name} (${phaseNames[spec.phase] || spec.phase}) - ${date}`);
});

// GitHub統合状況
const githubSyncs = db.prepare(`
  SELECT COUNT(*) as count
  FROM github_sync
  WHERE entity_type = 'spec'
`).get();

console.log(`\n## GitHub統合`);
console.log(`同期済み仕様書: ${githubSyncs.count}件`);

db.close();
