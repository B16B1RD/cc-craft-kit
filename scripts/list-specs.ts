#!/usr/bin/env node
/**
 * 仕様書一覧取得スクリプト
 */
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DatabaseSchema {
  specs: {
    id: string;
    name: string;
    description: string | null;
    phase: string;
    content: string | null;
    github_issue_number: number | null;
    created_at: string;
    updated_at: string;
  };
}

async function listSpecs() {
  const phase = process.argv[2]; // オプションのフェーズフィルター
  const limit = parseInt(process.argv[3] || '20', 10);

  const projectRoot = path.resolve(__dirname, '..');
  const dbPath = path.join(projectRoot, '.cc-craft-kit', 'cc-craft-kit.db');

  const db = new Database(dbPath);
  const kysely = new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: db }),
  });

  // 総数を取得
  const totalResult = await kysely
    .selectFrom('specs')
    .select(({ fn }) => [fn.count<number>('id').as('count')])
    .executeTakeFirst();
  const total = totalResult?.count || 0;

  // 仕様書を取得
  let query = kysely.selectFrom('specs').selectAll().orderBy('created_at', 'desc').limit(limit);

  if (phase) {
    query = query.where('phase', '=', phase);
  }

  const specs = await query.execute();

  console.log('\n## 仕様書一覧\n');

  if (specs.length === 0) {
    console.log('仕様書が見つかりませんでした。\n');
    await kysely.destroy();
    db.close();
    return;
  }

  // テーブルヘッダー
  console.log('| ID (省略形) | 名前 | フェーズ | 作成日時 | GitHub Issue |');
  console.log('|-------------|------|----------|----------|--------------|');

  // テーブルボディ
  for (const spec of specs) {
    const shortId = spec.id.substring(0, 8) + '...';
    const createdAt = new Date(spec.created_at).toLocaleDateString('ja-JP');
    const githubIssue = spec.github_issue_number ? `#${spec.github_issue_number}` : '-';

    console.log(`| ${shortId} | ${spec.name} | ${spec.phase} | ${createdAt} | ${githubIssue} |`);
  }

  console.log(`\n**総数:** ${total} 件`);
  console.log(`**表示:** ${specs.length} 件\n`);

  console.log('各仕様書の詳細を見るには以下のコマンドを実行してください:');
  console.log('  npx tsx scripts/get-spec.ts <id>\n');

  await kysely.destroy();
  db.close();
}

listSpecs().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
