/**
 * プラグイン実装で使用する共通型定義
 */

/**
 * Slack Attachment型定義
 */
export interface SlackAttachment {
  fallback?: string;
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

/**
 * Slackメッセージ送信パラメータ
 */
export interface SendSlackMessageParams {
  channel?: string;
  text: string;
  attachments?: SlackAttachment[];
}

/**
 * Slackメッセージ送信結果
 */
export interface SendSlackMessageResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 仕様書作成通知パラメータ
 */
export interface NotifySpecCreatedParams {
  specId: string;
  channel?: string;
}

/**
 * Backlog Issue同期パラメータ
 */
export interface SyncBacklogIssueParams {
  specId: string;
  projectKey: string;
  action: 'create' | 'update' | 'sync';
}

/**
 * Backlog Issue同期結果
 */
export interface SyncBacklogIssueResult {
  success: boolean;
  issueKey?: string;
  issueUrl?: string;
  error?: string;
}

/**
 * Backlog Wiki作成パラメータ
 */
export interface CreateBacklogWikiParams {
  projectKey: string;
  name: string;
  content: string;
}

/**
 * Backlog Wiki作成結果
 */
export interface CreateBacklogWikiResult {
  success: boolean;
  wikiId?: number;
  wikiUrl?: string;
  error?: string;
}

/**
 * Backlogプロジェクト一覧取得結果
 */
export interface ListBacklogProjectsResult {
  success: boolean;
  projects?: Array<{
    id: number;
    projectKey: string;
    name: string;
  }>;
  error?: string;
}
