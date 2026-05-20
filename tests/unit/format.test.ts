import { describe, it, expect } from 'vitest';
import { formatNumber, formatTime } from '../../src/utils/format';

describe('formatNumber', () => {
  it('returns "0" for zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('returns raw numbers under 10000', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1247)).toBe('1,247');
    expect(formatNumber(9999)).toBe('9,999');
  });

  it('uses commas for 1K to 999K', () => {
    expect(formatNumber(10000)).toBe('10,000');
    expect(formatNumber(12345)).toBe('12,345');
    expect(formatNumber(999999)).toBe('999,999');
  });

  it('uses M suffix for 1M to 999M', () => {
    expect(formatNumber(1000000)).toBe('1.00M');
    expect(formatNumber(1234567)).toBe('1.23M');
    expect(formatNumber(999499999)).toBe('999M');
  });

  it('uses B suffix for 1B to 999B', () => {
    expect(formatNumber(1000000000)).toBe('1.00B');
    expect(formatNumber(5000000000)).toBe('5.00B');
  });

  it('uses scientific notation for 1T+', () => {
    expect(formatNumber(1000000000000)).toBe('1.00e12');
    expect(formatNumber(1e15)).toBe('1.00e15');
  });

  it('handles negative numbers', () => {
    expect(formatNumber(-1000)).toBe('-1,000');
    expect(formatNumber(-50000)).toBe('-50,000');
  });

  it('handles fractional inputs', () => {
    expect(formatNumber(1.5)).toBe('2');
    expect(formatNumber(1234.56)).toBe('1,235');
  });
});

describe('formatTime', () => {
  it('returns "0s" for zero', () => {
    expect(formatTime(0)).toBe('0s');
  });

  it('formats seconds only', () => {
    expect(formatTime(1000)).toBe('1s');
    expect(formatTime(45000)).toBe('45s');
    expect(formatTime(59000)).toBe('59s');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(60000)).toBe('1m 0s');
    expect(formatTime(90000)).toBe('1m 30s');
  });

  it('formats hours', () => {
    expect(formatTime(3600000)).toBe('1h 0m');
    expect(formatTime(3660000)).toBe('1h 1m');
    expect(formatTime(4980000)).toBe('1h 23m');
  });

  it('drops seconds when > 1 hour', () => {
    expect(formatTime(3600000)).toBe('1h 0m');
    expect(formatTime(7200000)).toBe('2h 0m');
  });
});
