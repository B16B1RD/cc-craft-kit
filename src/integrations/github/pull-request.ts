/**
 * GitHub プルリクエスト自動作成機能
 */

import { Kysely } from 'kysely';
import { Database } from '../../core/database/schema.js';
import { getGitHubClient } from './client.js';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getErrorHandler } from '../../core/errors/error-handler.js';
import { getGitHubConfig } from '../../core/config/github-config.js';

/**
 * PR作成オプション
 */
export interface CreatePullRequestOptions {
  /** 仕様書ID */
  specId: string;
  /** ブランチ名 */
  branchName: string;
  /** ベースブランチ（デフォルト: develop） */
  baseBranch?: string;
  /** オーナー名（デフォルト: 環境変数） */
  owner?: string;
  /** リポジトリ名（デフォルト: 現在のリポジトリ） */
  repo?: string;
}

/**
 * PR作成結果
 */
export interface CreatePullRequestResult {
  success: boolean;
  pullRequestUrl?: string;
  pullRequestNumber?: number;
  error?: string;
}

/**
 * 現在のリポジトリ名を取得
 */
function getCurrentRepository(): { owner: string; repo: string } | null {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    // SSH形式: git@github.com:owner/repo.git
    // HTTPS形式: https://github.com/owner/repo.git
    const sshMatch = remoteUrl.match(/git@github\.com:(.+?)\/(.+?)\.git$/);
    const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/(.+?)\/(.+?)\.git$/);

    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    } else if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 仕様書からPR本文を生成
 */
async function generatePullRequestBody(db: Kysely<Database>, specId: string): Promise<string> {
  const spec = await db.selectFrom('specs').where('id', '=', specId).selectAll().executeTakeFirst();

  if (!spec) {
    throw new Error(`Spec not found: ${specId}`);
  }

  // 仕様書ファイルから受け入れ基準を抽出
  let acceptanceCriteria = '仕様書ファイルを参照してください。';
  const specPath = join(process.cwd(), '.cc-craft-kit', 'specs', `${spec.id}.md`);

  if (existsSync(specPath)) {
    try {
      const content = readFileSync(specPath, 'utf-8');
      // 「## 3. 受け入れ基準」セクションを抽出（次の ## または --- まで）
      const match = content.match(/^## 3\. 受け入れ基準\s*\n([\s\S]*?)(?=\n## |\n---|$)/m);
      if (match && match[1]) {
        acceptanceCriteria = match[1].trim();
      }
    } catch {
      // ファイル読み込みエラーは無視してデフォルトメッセージを使用
      console.warn('Failed to extract acceptance criteria from spec file');
    }
  }

  const summary = spec.description || '仕様書の詳細を確認してください。';

  return `## Summary
${summary}

## 受け入れ基準
${acceptanceCriteria}

## Test plan
- [ ] 単体テスト実行（\`npm test\`）
- [ ] ESLint・型チェック実行（\`npm run lint\`）
- [ ] E2E テスト実行（該当する場合）

🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
}

/**
 * プルリクエストを自動作成
 */
export async function createPullRequest(
  db: Kysely<Database>,
  options: CreatePullRequestOptions
): Promise<CreatePullRequestResult> {
  try {
    // GitHub クライアント取得
    const client = getGitHubClient();

    // GitHub 設定取得
    const config = getGitHubConfig();

    // リポジトリ情報取得
    const repository = getCurrentRepository();
    const owner = options.owner || config.owner || repository?.owner;
    const repo = options.repo || config.repo || repository?.repo;

    if (!owner || !repo) {
      return {
        success: false,
        error: 'Repository owner or name not found',
      };
    }

    // 仕様書取得
    const spec = await db
      .selectFrom('specs')
      .where('id', '=', options.specId)
      .selectAll()
      .executeTakeFirst();

    if (!spec) {
      return {
        success: false,
        error: `Spec not found: ${options.specId}`,
      };
    }

    // ベースブランチ決定
    const baseBranch = options.baseBranch || config.defaultBaseBranch;

    // PR本文生成
    const body = await generatePullRequestBody(db, options.specId);

    // PR作成
    const { data } = await client.rest.pulls.create({
      owner,
      repo,
      title: spec.name,
      head: options.branchName,
      base: baseBranch,
      body,
    });

    return {
      success: true,
      pullRequestUrl: data.html_url,
      pullRequestNumber: data.number,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // エラーログを記録
    const errorHandler = getErrorHandler();
    const errorObj = error instanceof Error ? error : new Error(String(error));
    await errorHandler.handle(errorObj, {
      event: 'github.pr_create_failed',
      specId: options.specId,
      branchName: options.branchName,
      baseBranch: options.baseBranch || 'develop',
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * PR URLをGitHub Issueに記録
 */
export async function recordPullRequestToIssue(
  db: Kysely<Database>,
  specId: string,
  pullRequestUrl: string
): Promise<void> {
  try {
    // GitHub同期レコードを取得
    const syncRecord = await db
      .selectFrom('github_sync')
      .where('entity_id', '=', specId)
      .where('entity_type', '=', 'spec')
      .selectAll()
      .executeTakeFirst();

    if (!syncRecord || !syncRecord.issue_number) {
      // Issueが存在しない場合はスキップ
      return;
    }

    // リポジトリ情報取得
    const config = getGitHubConfig();
    const repository = getCurrentRepository();
    const owner = config.owner || repository?.owner;
    const repo = config.repo || repository?.repo;

    if (!owner || !repo) {
      return;
    }

    // GitHub クライアント取得
    const client = getGitHubClient();

    // IssueにPR URLをコメント
    await client.rest.issues.createComment({
      owner,
      repo,
      issue_number: syncRecord.issue_number,
      body: `プルリクエストが作成されました: ${pullRequestUrl}`,
    });
  } catch (error) {
    // エラーが発生してもPR作成は成功させる
    console.warn('Failed to record PR URL to issue:', error);
  }
}
