#!/usr/bin/env node
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', '.takumi', 'takumi.db');
const db = new Database(dbPath);

const specId = process.argv[2];
const issueNumber = process.argv[3] || '1';

if (!specId) {
  console.error('エラー: Spec IDを指定してください');
  process.exit(1);
}

console.log(`GitHub Issue #${issueNumber} から Spec ID: ${specId} に同期中...`);

// GitHub CLIでIssue取得
const issueJson = execSync(
  `gh issue view ${issueNumber} --repo B16B1RD/takumi --json number,title,body,state,labels,createdAt,updatedAt`,
  { encoding: 'utf-8' }
);

const issue = JSON.parse(issueJson);

// Issueボディから情報を抽出
const body = issue.body;

// フェーズをラベルから抽出
const phaseLabel = issue.labels.find(l => l.name.startsWith('phase:'));
const phase = phaseLabel ? phaseLabel.name.replace('phase:', '') : 'requirements';

// タイトルから仕様書名を抽出（[Spec] プレフィックスを除去）
const specName = issue.title.replace(/^\[Spec\]\s*/, '');

// ボディから説明を抽出（最初の ## 概要セクション）
const descMatch = body.match(/## 概要\n([\s\S]*?)(?=\n##|$)/);
const description = descMatch ? descMatch[1].trim() : '';

console.log('\n取得した情報:');
console.log('- 名前:', specName);
console.log('- フェーズ:', phase);
console.log('- 説明:', description.substring(0, 100) + '...');

// データベースに挿入または更新
const existingSpec = db.prepare('SELECT id FROM specs WHERE id = ?').get(specId);

if (existingSpec) {
  console.log('\n既存のSpecを更新します...');
  db.prepare(`
    UPDATE specs
    SET name = ?, description = ?, phase = ?, github_issue_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(specName, description, phase, issue.number, specId);
} else {
  console.log('\n新しいSpecを作成します...');
  db.prepare(`
    INSERT INTO specs (id, name, description, phase, github_issue_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(specId, specName, description, phase, issue.number, issue.createdAt);
}

// GitHub同期テーブルに記録
const syncRecord = db.prepare('SELECT id FROM github_sync WHERE entity_id = ? AND entity_type = ?').get(specId, 'spec');

if (syncRecord) {
  db.prepare(`
    UPDATE github_sync
    SET github_id = ?, github_number = ?, last_synced_at = CURRENT_TIMESTAMP, sync_status = 'success'
    WHERE entity_id = ? AND entity_type = ?
  `).run(issue.number.toString(), issue.number, specId, 'spec');
} else {
  db.prepare(`
    INSERT INTO github_sync (id, entity_type, entity_id, github_id, github_number, last_synced_at, sync_status)
    VALUES (?, 'spec', ?, ?, ?, CURRENT_TIMESTAMP, 'success')
  `).run(crypto.randomUUID(), specId, issue.number.toString(), issue.number);
}

// 仕様書ファイルを保存
const fs = await import('fs/promises');
const specsDir = join(__dirname, '..', '.takumi', 'specs');
const specFilePath = join(specsDir, `${specId}.md`);
await fs.writeFile(specFilePath, body, 'utf-8');

console.log('\n✅ 同期完了');
console.log(`- Spec ID: ${specId}`);
console.log(`- GitHub Issue: #${issue.number}`);
console.log(`- フェーズ: ${phase}`);
console.log(`- ファイル: ${specFilePath}`);

db.close();
