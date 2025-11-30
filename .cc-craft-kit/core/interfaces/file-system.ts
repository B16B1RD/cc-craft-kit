/**
 * ファイルシステム操作インターフェース
 *
 * テスト時にモック化可能にするための抽象化レイヤー
 */

import { type FSWatcher } from 'chokidar';

/**
 * ファイルウォッチャーイベントハンドラー
 */
export interface FileWatcherEventHandlers {
  onChange?: (path: string) => void;
  onAdd?: (path: string) => void;
  onUnlink?: (path: string) => void;
  onError?: (error: Error) => void;
  onReady?: () => void;
}

/**
 * ファイルウォッチャーオプション
 */
export interface FileWatcherOptions {
  persistent?: boolean;
  ignoreInitial?: boolean;
  awaitWriteFinish?: {
    stabilityThreshold: number;
    pollInterval: number;
  };
  ignored?: string[];
}

/**
 * ファイルウォッチャーインターフェース
 */
export interface IFileWatcher {
  /**
   * ファイルパターンを監視開始
   */
  watch(pattern: string, options?: FileWatcherOptions): IFileWatcherInstance;
}

/**
 * ファイルウォッチャーインスタンスインターフェース
 */
export interface IFileWatcherInstance {
  /**
   * イベントハンドラーを登録
   */
  on(event: 'change', handler: (path: string) => void): this;
  on(event: 'add', handler: (path: string) => void): this;
  on(event: 'unlink', handler: (path: string) => void): this;
  on(event: 'error', handler: (error: unknown) => void): this;
  on(event: 'ready', handler: () => void): this;

  /**
   * ウォッチャーを閉じる
   */
  close(): Promise<void>;
}

/**
 * ファイルシステム存在確認インターフェース
 */
export interface IFileSystem {
  /**
   * ファイル・ディレクトリが存在するか確認
   */
  exists(path: string): boolean;

  /**
   * ファイルウォッチャーを取得
   */
  getWatcher(): IFileWatcher;
}

/**
 * chokidar の FSWatcher を IFileWatcherInstance に適合させるアダプター
 */
export class ChokidarWatcherAdapter implements IFileWatcherInstance {
  constructor(private watcher: FSWatcher) {}

  on(event: 'change', handler: (path: string) => void): this;
  on(event: 'add', handler: (path: string) => void): this;
  on(event: 'unlink', handler: (path: string) => void): this;
  on(event: 'error', handler: (error: unknown) => void): this;
  on(event: 'ready', handler: () => void): this;
  on(
    event: 'change' | 'add' | 'unlink' | 'error' | 'ready',
    handler: ((path: string) => void) | ((error: unknown) => void) | (() => void)
  ): this {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.watcher.on(event, handler as any);
    return this;
  }

  async close(): Promise<void> {
    await this.watcher.close();
  }
}
