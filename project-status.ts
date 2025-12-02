#!/usr/bin/env node
/**
 * プロジェクト状況表示スクリプト
 */
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

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
  tasks: {
    id: string;
    spec_id: string;
    title: string;
    description: string | null;
    status: string;
    priority: number | null;
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
  };
  github_sync: {
    id: number;
    entity_type: string;
    entity_id: string;
    github_id: string;
    sync_direction: string;
    synced_at: string;
    metadata: string | null;
  };
}

async function showProjectStatus() {
  const projectRoot = path.resolve(__dirname, '..');
  const configPath = path.join(projectRoot, '.cc-craft-kit', 'config.json');
  const dbPath = path.join(projectRoot, '.cc-craft-kit', 'cc-craft-kit.db');

  // 設定ファイル読み込み
  const configData = await fs.readFile(configPath, 'utf-8');
  const config = JSON.parse(configData);

  const db = new Database(dbPath);
  const kysely = new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: db }),
  });

  // 仕様書統計
  const allSpecs = await kysely.selectFrom('specs').selectAll().execute();

  const specsByPhase = {
    requirements: allSpecs.filter((s) => s.phase === 'requirements').length,
    design: allSpecs.filter((s) => s.phase === 'design').length,
    tasks: allSpecs.filter((s) => s.phase === 'tasks').length,
    implementation: allSpecs.filter((s) => s.phase === 'implementation').length,
    completed: allSpecs.filter((s) => s.phase === 'completed').length,
  };

  // タスク統計
  const allTasks = await kysely.selectFrom('tasks').selectAll().execute();

  const tasksByStatus = {
    todo: allTasks.filter((t) => t.status === 'todo').length,
    in_progress: allTasks.filter((t) => t.status === 'in_progress').length,
    blocked: allTasks.filter((t) => t.status === 'blocked').length,
    review: allTasks.filter((t) => t.status === 'review').length,
    done: allTasks.filter((t) => t.status === 'done').length,
  };

  // GitHub同期統計
  const syncRecords = await kysely.selectFrom('github_sync').selectAll().execute();

  const syncStats = {
    total: syncRecords.length,
    ccCraftKitToGithub: syncRecords.filter((s) => s.sync_direction === 'cc-craft-kit_to_github').length,
    githubToCcCraftKit: syncRecords.filter((s) => s.sync_direction === 'github_to_cc-craft-kit').length,
  };

  // 最近の活動（最新5件の仕様書）
  const recentSpecs = await kysely
    .selectFrom('specs')
    .selectAll()
    .orderBy('updated_at', 'desc')
    .limit(5)
    .execute();

  // 出力
  console.log('\n## 📊 cc-craft-kitプロジェクト状況\n');

  console.log('### プロジェクト情報\n');
  console.log(`- **プロジェクト名:** ${config.name}`);
  console.log(`- **説明:** ${config.description}`);
  console.log(`- **GitHubリポジトリ:** ${config.githubRepo}`);
  console.log(`- **作成日:** ${new Date(config.createdAt).toLocaleString('ja-JP')}`);
  console.log(`- **バージョン:** ${config.version}\n`);

  console.log('### 仕様書統計\n');
  console.log(`- **総数:** ${allSpecs.length} 件`);
  console.log(`- **Requirements:** ${specsByPhase.requirements} 件`);
  console.log(`- **Design:** ${specsByPhase.design} 件`);
  console.log(`- **Tasks:** ${specsByPhase.tasks} 件`);
  console.log(`- **Implementation:** ${specsByPhase.implementation} 件`);
  console.log(`- **Completed:** ${specsByPhase.completed} 件\n`);

  console.log('### タスク統計\n');
  console.log(`- **総数:** ${allTasks.length} 件`);
  console.log(`- **Todo:** ${tasksByStatus.todo} 件`);
  console.log(`- **In Progress:** ${tasksByStatus.in_progress} 件`);
  console.log(`- **Blocked:** ${tasksByStatus.blocked} 件`);
  console.log(`- **Review:** ${tasksByStatus.review} 件`);
  console.log(`- **Done:** ${tasksByStatus.done} 件\n`);

  console.log('### GitHub連携統計\n');
  console.log(`- **同期総数:** ${syncStats.total} 件`);
  console.log(`- **cc-craft-kit → GitHub:** ${syncStats.ccCraftKitToGithub} 件`);
  console.log(`- **GitHub → cc-craft-kit:** ${syncStats.githubToCcCraftKit} 件\n`);

  if (recentSpecs.length > 0) {
    console.log('### 最近の活動\n');
    for (const spec of recentSpecs) {
      const updatedAt = new Date(spec.updated_at).toLocaleString('ja-JP');
      const githubIssue = spec.github_issue_number ? `[#${spec.github_issue_number}]` : '';
      console.log(`- **${spec.name}** ${githubIssue} - ${spec.phase} (更新: ${updatedAt})`);
    }
    console.log();
  }

  console.log('### 次のアクション\n');
  console.log('- 新しい仕様書を作成: `/cft:spec-create <name>`');
  console.log('- 仕様書一覧を見る: `/cft:spec-list`');
  console.log('- 仕様書詳細を見る: `npx tsx scripts/get-spec.ts <id>`\n');

  await kysely.destroy();
  db.close();
}

showProjectStatus().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
