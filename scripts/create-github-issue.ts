#!/usr/bin/env node
/**
 * GitHub Issue作成スクリプト（WebUIダッシュボードSpec用）
 */
import 'dotenv/config';
import { Octokit } from '@octokit/rest';
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

async function createGitHubIssue() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = 'cc-craft-kit';

  if (!token || !owner) {
    console.error('❌ GITHUB_TOKEN または GITHUB_OWNER が設定されていません');
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, '..');
  const dbPath = path.join(projectRoot, '.cc-craft-kit', 'cc-craft-kit.db');

  const db = new Database(dbPath);
  const kysely = new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: db }),
  });

  // Specを取得
  const spec = await kysely
    .selectFrom('specs')
    .selectAll()
    .where('name', '=', 'WebUIダッシュボード')
    .executeTakeFirst();

  if (!spec) {
    console.error('❌ WebUIダッシュボードのSpecが見つかりません');
    process.exit(1);
  }

  console.log('📋 Spec情報:');
  console.log(`  名前: ${spec.name}`);
  console.log(`  フェーズ: ${spec.phase}\n`);

  const octokit = new Octokit({ auth: token });

  console.log('🚀 GitHub Issueを作成中...\n');

  try {
    const { data: issue } = await octokit.issues.create({
      owner,
      repo,
      title: `[Spec] ${spec.name}`,
      body: `${spec.content}

---

**cc-craft-kit Spec ID**: \`${spec.id}\`
**フェーズ**: \`${spec.phase}\`
**作成日**: ${new Date(spec.created_at).toLocaleString()}

---

このIssueはcc-craft-kitで管理されているSpecと同期されています。

### 📝 進捗記録
<!-- cc-craft-kitから自動記録 -->

### 🐛 エラー解決策
<!-- cc-craft-kitから自動記録 -->

### 💡 Tips
<!-- cc-craft-kitから自動記録 -->
`,
      labels: ['spec', `phase:${spec.phase}`],
    });

    console.log('✅ GitHub Issue作成成功');
    console.log(`  Issue番号: #${issue.number}`);
    console.log(`  URL: ${issue.html_url}\n`);

    // SpecにIssue番号を記録
    await kysely
      .updateTable('specs')
      .set({
        github_issue_number: issue.number,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', spec.id)
      .execute();

    // 同期履歴を記録
    await kysely
      .insertInto('github_sync')
      .values({
        entity_type: 'spec',
        entity_id: spec.id,
        github_id: String(issue.number),
        sync_direction: 'cc_craft_kit_to_github',
        synced_at: new Date().toISOString(),
        metadata: JSON.stringify({
          issue_url: issue.html_url,
          action: 'created',
        }),
      })
      .execute();

    console.log('✅ 同期履歴を記録しました\n');

    console.log('🎉 ドッグフーディング開始！');
    console.log('\n📌 次のステップ:');
    console.log('  1. Issue にコメントして進捗記録のテスト');
    console.log('  2. Requirementsフェーズを承認してDesignフェーズへ移行');
    console.log('  3. cc-craft-kitを使って実際にWebUIダッシュボードを開発');

    await kysely.destroy();
    db.close();
  } catch (error: any) {
    console.error('❌ Issue作成エラー:', error.message);
    await kysely.destroy();
    db.close();
    process.exit(1);
  }
}

createGitHubIssue();
