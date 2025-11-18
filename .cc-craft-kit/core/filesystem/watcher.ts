/**
 * ファイルシステム監視サービス
 *
 * `.cc-craft-kit/specs/` ディレクトリの変更を監視し、
 * 仕様書ファイルが更新されたときにイベントを発火する
 */

import chokidar, { type FSWatcher } from 'chokidar';
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { Kysely } from 'kysely';
import { Database } from '../database/schema.js';
import { getEventBusAsync } from '../workflow/event-bus.js';

/**
 * ウォッチャーオプション
 */
export interface WatcherOptions {
  /**
   * デバウンス時間（ミリ秒）
   * 連続した変更を1回にまとめる
   */
  debounceMs?: number;

  /**
   * ログレベル
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * 無視するファイルパターン
   */
  ignored?: string[];
}

/**
 * ファイル変更イベント
 */
export interface FileChangeEvent {
  /**
   * ファイルパス
   */
  path: string;

  /**
   * 仕様書ID
   */
  specId: string;

  /**
   * 変更種別
   */
  type: 'change' | 'add' | 'unlink';

  /**
   * タイムスタンプ
   */
  timestamp: Date;
}

/**
 * ファイルシステムウォッチャー
 */
export class SpecFileWatcher {
  private watcher: FSWatcher | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private debounceTimers: Map<string, any> = new Map();
  private isRunning = false;

  constructor(
    private db: Kysely<Database>,
    private ccCraftKitDir: string,
    private options: WatcherOptions = {}
  ) {
    this.options = {
      debounceMs: 500,
      logLevel: 'info',
      ignored: [],
      ...options,
    };
  }

  /**
   * 監視を開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('warn', 'Watcher is already running');
      return;
    }

    const specsDir = join(this.ccCraftKitDir, 'specs');

    if (!existsSync(specsDir)) {
      throw new Error(`Specs directory not found: ${specsDir}`);
    }

    this.log('info', `Starting file watcher for: ${specsDir}`);

    return new Promise((resolve, reject) => {
      this.watcher = chokidar.watch(`${specsDir}/*.md`, {
        persistent: true,
        ignoreInitial: true, // 初回スキャンは無視
        awaitWriteFinish: {
          stabilityThreshold: 100, // ファイル書き込みが安定するまで待つ
          pollInterval: 50,
        },
        ignored: this.options.ignored,
      });

      this.watcher
        .on('change', (path: string) => this.handleFileChange(path, 'change'))
        .on('add', (path: string) => this.handleFileChange(path, 'add'))
        .on('unlink', (path: string) => this.handleFileChange(path, 'unlink'))
        .on('error', (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.log('error', `Watcher error: ${message}`);
          reject(new Error(message));
        })
        .on('ready', () => {
          this.isRunning = true;
          this.log('info', 'File watcher is ready');
          resolve();
        });
    });
  }

  /**
   * 監視を停止
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.log('info', 'Stopping file watcher...');

    // デバウンスタイマーをすべてクリア
    for (const timer of this.debounceTimers.values()) {
      // eslint-disable-next-line no-undef
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    this.isRunning = false;
    this.log('info', 'File watcher stopped');
  }

  /**
   * ファイル変更ハンドラー
   */
  private handleFileChange(filePath: string, type: 'change' | 'add' | 'unlink'): void {
    const specId = this.extractSpecId(filePath);

    if (!specId) {
      this.log('warn', `Could not extract spec ID from: ${filePath}`);
      return;
    }

    this.log('debug', `File ${type}: ${filePath} (spec: ${specId})`);

    // デバウンス処理
    this.debounceFileChange(filePath, specId, type);
  }

  /**
   * デバウンス処理
   */
  private debounceFileChange(
    filePath: string,
    specId: string,
    type: 'change' | 'add' | 'unlink'
  ): void {
    // 既存のタイマーをクリア
    const existingTimer = this.debounceTimers.get(specId);
    if (existingTimer) {
      // eslint-disable-next-line no-undef
      clearTimeout(existingTimer);
    }

    // 新しいタイマーを設定
    // eslint-disable-next-line no-undef
    const timer = setTimeout(() => {
      this.emitSpecUpdatedEvent(specId, filePath, type).catch((error) => {
        this.log('error', `Failed to emit spec.updated event: ${error.message}`);
      });
      this.debounceTimers.delete(specId);
    }, this.options.debounceMs);

    this.debounceTimers.set(specId, timer);
  }

  /**
   * spec.updated イベントを発火
   */
  private async emitSpecUpdatedEvent(
    specId: string,
    _filePath: string,
    type: 'change' | 'add' | 'unlink'
  ): Promise<void> {
    try {
      // 仕様書がデータベースに存在するか確認
      const spec = await this.db
        .selectFrom('specs')
        .where('id', '=', specId)
        .selectAll()
        .executeTakeFirst();

      if (!spec) {
        this.log('warn', `Spec not found in database: ${specId}`);
        return;
      }

      // unlink イベントは無視（削除は別途処理）
      if (type === 'unlink') {
        this.log('debug', `Ignoring unlink event for: ${specId}`);
        return;
      }

      // データベースの updated_at を更新
      const now = new Date().toISOString();
      await this.db
        .updateTable('specs')
        .set({ updated_at: now })
        .where('id', '=', specId)
        .execute();

      // spec.updated イベントを発火
      const eventBus = await getEventBusAsync();
      await eventBus.emit(
        eventBus.createEvent('spec.updated', specId, {
          name: spec.name,
          phase: spec.phase,
          updatedAt: now,
          source: 'file-watcher',
        })
      );

      this.log(
        'info',
        `✓ Spec updated event emitted for: ${spec.name} (${specId.substring(0, 8)})`
      );
    } catch (error) {
      this.log('error', `Failed to process file change: ${error}`);
      throw error;
    }
  }

  /**
   * ファイル名から仕様書IDを抽出
   */
  private extractSpecId(filePath: string): string | null {
    const filename = basename(filePath, '.md');

    // UUID形式のチェック（簡易版）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidRegex.test(filename)) {
      return filename;
    }

    return null;
  }

  /**
   * ログ出力
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const logLevels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = logLevels.indexOf(this.options.logLevel || 'info');
    const messageLevelIndex = logLevels.indexOf(level);

    if (messageLevelIndex < currentLevelIndex) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [SpecFileWatcher] [${level.toUpperCase()}]`;

    switch (level) {
      case 'debug':
        console.debug(`${prefix} ${message}`);
        break;
      case 'info':
        console.log(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
    }
  }

  /**
   * ウォッチャーが実行中かどうか
   */
  get running(): boolean {
    return this.isRunning;
  }
}
