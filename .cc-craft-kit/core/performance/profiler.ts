/**
 * パフォーマンスプロファイラー
 * 関数実行時間を計測してボトルネックを特定
 */

import type { UnknownRecord } from '../types/common.js';

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: string;
  metadata?: UnknownRecord;
}

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: {
    totalDuration: number;
    averageDuration: number;
    slowestOperation: PerformanceMetric | null;
    fastestOperation: PerformanceMetric | null;
  };
}

/**
 * パフォーマンスプロファイラー
 */
export class Profiler {
  private metrics: PerformanceMetric[] = [];
  private enabled: boolean = true;

  /**
   * プロファイラーの有効/無効を設定
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 関数の実行時間を計測
   */
  async profile<T>(name: string, fn: () => Promise<T>, metadata?: UnknownRecord): Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    const startTime = performance.now();
    const timestamp = new Date().toISOString();

    try {
      const result = await fn();
      const duration = performance.now() - startTime;

      this.metrics.push({
        name,
        duration,
        timestamp,
        metadata,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      this.metrics.push({
        name,
        duration,
        timestamp,
        metadata: { ...metadata, error: error instanceof Error ? error.message : String(error) },
      });

      throw error;
    }
  }

  /**
   * 同期関数の実行時間を計測
   */
  profileSync<T>(name: string, fn: () => T, metadata?: UnknownRecord): T {
    if (!this.enabled) {
      return fn();
    }

    const startTime = performance.now();
    const timestamp = new Date().toISOString();

    try {
      const result = fn();
      const duration = performance.now() - startTime;

      this.metrics.push({
        name,
        duration,
        timestamp,
        metadata,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      this.metrics.push({
        name,
        duration,
        timestamp,
        metadata: { ...metadata, error: error instanceof Error ? error.message : String(error) },
      });

      throw error;
    }
  }

  /**
   * メトリクスをクリア
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * メトリクスを取得
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * パフォーマンスレポートを生成
   */
  getReport(): PerformanceReport {
    if (this.metrics.length === 0) {
      return {
        metrics: [],
        summary: {
          totalDuration: 0,
          averageDuration: 0,
          slowestOperation: null,
          fastestOperation: null,
        },
      };
    }

    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalDuration / this.metrics.length;

    const sortedMetrics = [...this.metrics].sort((a, b) => b.duration - a.duration);
    const slowestOperation = sortedMetrics[0];
    const fastestOperation = sortedMetrics[sortedMetrics.length - 1];

    return {
      metrics: this.metrics,
      summary: {
        totalDuration,
        averageDuration,
        slowestOperation,
        fastestOperation,
      },
    };
  }

  /**
   * パフォーマンスレポートをコンソールに出力
   */
  printReport(): void {
    const report = this.getReport();

    console.log('\n=== Performance Report ===');
    console.log(`Total Operations: ${report.metrics.length}`);
    console.log(`Total Duration: ${report.summary.totalDuration.toFixed(2)}ms`);
    console.log(`Average Duration: ${report.summary.averageDuration.toFixed(2)}ms`);

    if (report.summary.slowestOperation) {
      console.log(`\nSlowest Operation: ${report.summary.slowestOperation.name}`);
      console.log(`  Duration: ${report.summary.slowestOperation.duration.toFixed(2)}ms`);
    }

    if (report.summary.fastestOperation) {
      console.log(`\nFastest Operation: ${report.summary.fastestOperation.name}`);
      console.log(`  Duration: ${report.summary.fastestOperation.duration.toFixed(2)}ms`);
    }

    // Top 10遅い操作
    const top10Slowest = [...report.metrics].sort((a, b) => b.duration - a.duration).slice(0, 10);

    console.log('\nTop 10 Slowest Operations:');
    top10Slowest.forEach((metric, index) => {
      console.log(`  ${index + 1}. ${metric.name}: ${metric.duration.toFixed(2)}ms`);
    });

    console.log('========================\n');
  }

  /**
   * 特定操作のメトリクスを集計
   */
  getMetricsByName(name: string): {
    count: number;
    totalDuration: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
  } {
    const filtered = this.metrics.filter((m) => m.name === name);

    if (filtered.length === 0) {
      return {
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
      };
    }

    const durations = filtered.map((m) => m.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
      count: filtered.length,
      totalDuration,
      averageDuration: totalDuration / filtered.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
    };
  }
}

/**
 * グローバルプロファイラー
 */
const globalProfiler = new Profiler();

/**
 * グローバルプロファイラーを取得
 */
export function getGlobalProfiler(): Profiler {
  return globalProfiler;
}

/**
 * デコレーター: 関数の実行時間を自動計測
 */
export function Profile(name?: string) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const targetConstructor = target as { constructor: { name: string } };
    const methodName = name || `${targetConstructor.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: unknown[]) {
      return globalProfiler.profile(methodName, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
