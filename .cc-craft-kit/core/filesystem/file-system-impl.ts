/**
 * ファイルシステム実装
 *
 * 実際のファイルシステム操作を行う実装
 */

import chokidar from 'chokidar';
import { existsSync } from 'node:fs';
import {
  IFileSystem,
  IFileWatcher,
  IFileWatcherInstance,
  FileWatcherOptions,
  ChokidarWatcherAdapter,
} from '../interfaces/file-system.js';

/**
 * chokidar ベースのファイルウォッチャー実装
 */
export class ChokidarFileWatcher implements IFileWatcher {
  watch(pattern: string, options?: FileWatcherOptions): IFileWatcherInstance {
    const watcher = chokidar.watch(pattern, options);
    return new ChokidarWatcherAdapter(watcher);
  }
}

/**
 * Node.js 標準 fs モジュールベースのファイルシステム実装
 */
export class NodeFileSystem implements IFileSystem {
  private watcher: IFileWatcher;

  constructor(watcher?: IFileWatcher) {
    this.watcher = watcher || new ChokidarFileWatcher();
  }

  exists(path: string): boolean {
    return existsSync(path);
  }

  getWatcher(): IFileWatcher {
    return this.watcher;
  }
}
