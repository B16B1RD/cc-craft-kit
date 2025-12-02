#!/usr/bin/env node
/**
 * GitHub API接続テストスクリプト
 */
import 'dotenv/config';
import { Octokit } from '@octokit/rest';

async function testGitHubConnection() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;

  if (!token) {
    console.error('❌ GITHUB_TOKEN が設定されていません');
    process.exit(1);
  }

  if (!owner) {
    console.error('❌ GITHUB_OWNER が設定されていません');
    process.exit(1);
  }

  console.log('🔌 GitHub API接続テスト中...\n');

  const octokit = new Octokit({ auth: token });

  try {
    // 認証ユーザー情報取得
    const { data: user } = await octokit.users.getAuthenticated();
    console.log('✅ 認証成功');
    console.log(`   ユーザー: ${user.login}`);
    console.log(`   名前: ${user.name || 'N/A'}`);
    console.log(`   タイプ: ${user.type}\n`);

    // リポジトリ情報取得
    const repo = 'cc-craft-kit';
    const { data: repository } = await octokit.repos.get({ owner, repo });
    console.log('✅ リポジトリアクセス成功');
    console.log(`   リポジトリ: ${repository.full_name}`);
    console.log(`   説明: ${repository.description || 'N/A'}`);
    console.log(`   デフォルトブランチ: ${repository.default_branch}`);
    console.log(`   Issues有効: ${repository.has_issues}`);
    console.log(`   Projects有効: ${repository.has_projects}\n`);

    // レート制限確認
    const { data: rateLimit } = await octokit.rateLimit.get();
    const core = rateLimit.resources.core;
    console.log('📊 APIレート制限:');
    console.log(`   残り: ${core.remaining} / ${core.limit}`);
    console.log(`   リセット: ${new Date(core.reset * 1000).toLocaleString()}\n`);

    console.log('🎉 GitHub連携の準備完了！');
  } catch (error: any) {
    console.error('❌ GitHub API接続エラー:', error.message);
    if (error.status === 401) {
      console.error('   → トークンが無効です。GITHUB_TOKENを確認してください。');
    } else if (error.status === 404) {
      console.error('   → リポジトリが見つかりません。GITHUB_OWNERを確認してください。');
    }
    process.exit(1);
  }
}

testGitHubConnection();
