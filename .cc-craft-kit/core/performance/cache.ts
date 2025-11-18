/**
 * キャッシュシステム
 * メモリベースの高速キャッシュとTTL管理
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

/**
 * キャッシュシステム
 */
export class Cache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  private defaultTTL: number;
  private maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl || 5 * 60 * 1000; // デフォルト5分
    this.maxSize = options.maxSize || 1000;
  }

  /**
   * キャッシュに値を保存
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    // サイズ制限チェック
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: now,
    });
  }

  /**
   * キャッシュから値を取得
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // 有効期限チェック
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value;
  }

  /**
   * キャッシュに値が存在するかチェック
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // 有効期限チェック
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * キャッシュから値を削除
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 期限切れエントリーを削除
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * 最も古いエントリーを削除 (LRU)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * キャッシュ統計を取得
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate,
    };
  }

  /**
   * キャッシュサイズを取得
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * キャッシュ統計をリセット
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 関数の結果をキャッシュ
   */
  async memoize<R>(key: string, fn: () => Promise<R>, ttl?: number): Promise<R> {
    const cached = this.get(key);

    if (cached !== undefined) {
      return cached as unknown as R;
    }

    const result = await fn();
    this.set(key, result as unknown as T, ttl);

    return result;
  }

  /**
   * 同期関数の結果をキャッシュ
   */
  memoizeSync<R>(key: string, fn: () => R, ttl?: number): R {
    const cached = this.get(key);

    if (cached !== undefined) {
      return cached as unknown as R;
    }

    const result = fn();
    this.set(key, result as unknown as T, ttl);

    return result;
  }
}

/**
 * グローバルキャッシュインスタンス
 */
const globalCache = new Cache({
  ttl: 10 * 60 * 1000, // 10分
  maxSize: 5000,
});

/**
 * グローバルキャッシュを取得
 */
export function getGlobalCache<T = unknown>(): Cache<T> {
  return globalCache as Cache<T>;
}

/**
 * 定期的なクリーンアップを開始
 */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startCacheCleanup(intervalMs = 60000): void {
  if (cleanupInterval) {
    return;
  }

  cleanupInterval = setInterval(() => {
    const removed = globalCache.cleanup();
    if (removed > 0) {
      console.log(`[Cache] Cleaned up ${removed} expired entries`);
    }
  }, intervalMs);
}

/**
 * クリーンアップを停止
 */
export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
