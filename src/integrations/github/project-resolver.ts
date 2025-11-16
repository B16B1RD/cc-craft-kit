/**
 * GitHub Project ID 解決ユーティリティ
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { GitHubClient } from './client.js';
import { GitHubProjects } from './projects.js';

/**
 * プロジェクト設定（キャッシュ）
 */
interface ProjectNameCache {
  name: string;
  resolved_number: number;
  cached_at: string;
}

/**
 * プロジェクト設定
 */
interface ProjectConfig {
  project: {
    name: string;
    initialized_at: string;
  };
  github?: {
    owner: string;
    repo: string;
    token?: string;
    project_id?: number;
    project_name_cache?: ProjectNameCache;
  };
}

/**
 * Project ID を解決
 * 1. 環境変数 GITHUB_PROJECT_NAME から検索
 * 2. キャッシュがあれば使用
 * 3. config.json の project_id にフォールバック
 */
export async function resolveProjectId(
  takumiDir: string,
  githubToken: string | null = null
): Promise<number | null> {
  const configPath = join(takumiDir, 'config.json');

  if (!existsSync(configPath)) {
    return null;
  }

  const config: ProjectConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

  if (!config.github) {
    return null;
  }

  const projectName = process.env.GITHUB_PROJECT_NAME;
  const token = githubToken || process.env.GITHUB_TOKEN;

  // 環境変数がない場合は config.json の値を返す
  if (!projectName) {
    return config.github.project_id || null;
  }

  // GitHub Token がない場合はキャッシュまたは config.json の値を返す
  if (!token) {
    return config.github.project_name_cache?.resolved_number || config.github.project_id || null;
  }

  // キャッシュチェック（プロジェクト名が一致していればキャッシュを使用）
  if (config.github.project_name_cache && config.github.project_name_cache.name === projectName) {
    return config.github.project_name_cache.resolved_number;
  }

  // GitHub API でプロジェクト名を検索
  try {
    const client = new GitHubClient({ token });
    const projects = new GitHubProjects(client);
    const project = await projects.searchByName(config.github.owner, projectName);

    if (project) {
      // キャッシュを更新
      const updatedConfig = { ...config };
      if (updatedConfig.github) {
        updatedConfig.github.project_name_cache = {
          name: projectName,
          resolved_number: project.number,
          cached_at: new Date().toISOString(),
        };
      }
      writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');
      return project.number;
    }

    // プロジェクトが見つからない場合はフォールバック
    return config.github.project_id || null;
  } catch {
    // API エラー時はキャッシュまたは config.json にフォールバック
    return config.github.project_name_cache?.resolved_number || config.github.project_id || null;
  }
}
