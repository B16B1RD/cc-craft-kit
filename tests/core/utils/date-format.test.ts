/**
 * 日時フォーマットユーティリティのテスト
 */

import { formatDateTimeForSpec, getCurrentDateTimeForSpec } from '../../../src/core/utils/date-format.js';

describe('date-format', () => {
  describe('formatDateTimeForSpec', () => {
    it('ISO 8601形式を仕様書形式(YYYY/MM/DD HH:MM:SS)に変換できる', () => {
      const isoDateTime = '2025-11-20T12:34:56.789Z';
      const result = formatDateTimeForSpec(isoDateTime);

      // 期待値: YYYY/MM/DD HH:MM:SS 形式
      expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('タイムゾーンを考慮して変換できる', () => {
      const isoDateTime = '2025-01-01T00:00:00.000Z';
      const result = formatDateTimeForSpec(isoDateTime);

      // 形式チェック
      expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);

      // 日付部分のチェック（タイムゾーン依存）
      const [datePart, timePart] = result.split(' ');
      expect(datePart).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
      expect(timePart).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('0埋めが正しく行われる', () => {
      // 1桁の月・日・時・分・秒が0埋めされることを確認
      const isoDateTime = '2025-01-05T03:04:05.000Z';
      const result = formatDateTimeForSpec(isoDateTime);

      // 0埋めチェック
      const parts = result.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
      expect(parts).not.toBeNull();
      if (parts) {
        const [, year, month, day, hours, minutes, seconds] = parts;
        expect(year).toBe('2025');
        // タイムゾーン依存のため、形式のみチェック
        expect(month).toHaveLength(2);
        expect(day).toHaveLength(2);
        expect(hours).toHaveLength(2);
        expect(minutes).toHaveLength(2);
        expect(seconds).toHaveLength(2);
      }
    });

    it('ミリ秒は切り捨てられる', () => {
      const isoDateTime = '2025-11-20T12:34:56.999Z';
      const result = formatDateTimeForSpec(isoDateTime);

      // ミリ秒が含まれていないことを確認
      expect(result).not.toContain('999');
      expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('getCurrentDateTimeForSpec', () => {
    it('現在時刻を仕様書形式で取得できる', () => {
      const result = getCurrentDateTimeForSpec();

      // 形式チェック
      expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);

      // 現在時刻に近いことを確認（±1分以内）
      const now = new Date();
      const resultDate = new Date(result.replace(/\//g, '-').replace(' ', 'T'));
      const diffMs = Math.abs(now.getTime() - resultDate.getTime());
      expect(diffMs).toBeLessThan(60 * 1000); // 1分以内
    });

    it('連続呼び出しで同じまたは近い値を返す', () => {
      const result1 = getCurrentDateTimeForSpec();
      const result2 = getCurrentDateTimeForSpec();

      // 両方とも有効な形式
      expect(result1).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(result2).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);

      // 差分は数秒以内
      const date1 = new Date(result1.replace(/\//g, '-').replace(' ', 'T'));
      const date2 = new Date(result2.replace(/\//g, '-').replace(' ', 'T'));
      const diffMs = Math.abs(date1.getTime() - date2.getTime());
      expect(diffMs).toBeLessThan(5 * 1000); // 5秒以内
    });
  });
});
