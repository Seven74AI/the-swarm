/**
 * Format a number for display with abbreviations.
 * <10000: raw with comma separators
 * 10K-999K: "X.XXK"
 * 1M-999M: "X.XXM"
 * 1B-999B: "X.XXB"
 * 1T+: scientific notation
 */
export function formatNumber(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.round(Math.abs(n));

  if (abs < 10000) {
    return sign + abs.toLocaleString('en-US');
  }
  if (abs < 1_000_000) {
    const val = (abs / 1000).toFixed(2);
    // If rounding pushes us to 1000.00K+, bump to M tier
    if (parseFloat(val) >= 1000) {
      return sign + (abs / 1_000_000).toFixed(2) + 'M';
    }
    return sign + val + 'K';
  }
  if (abs < 1_000_000_000) {
    const val = (abs / 1_000_000).toFixed(2);
    if (parseFloat(val) >= 1000) {
      return sign + (abs / 1_000_000_000).toFixed(2) + 'B';
    }
    return sign + val + 'M';
  }
  if (abs < 1_000_000_000_000) {
    const val = (abs / 1_000_000_000).toFixed(2);
    if (parseFloat(val) >= 1000) {
      // Scientific notation for 1T+
      const exp = 12;
      return sign + (abs / Math.pow(10, exp)).toFixed(2) + 'e' + exp;
    }
    return sign + val + 'B';
  }
  // Scientific notation for 1T+
  const exp = Math.floor(Math.log10(abs));
  return sign + (abs / Math.pow(10, exp)).toFixed(2) + 'e' + exp;
}

/**
 * Format milliseconds as a human-readable time string.
 * - <60s: "Xs"
 * - <1h: "Xm Ys"
 * - >=1h: "Xh Ym" (drops seconds)
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);

  if (totalSeconds === 0) return '0s';
  if (totalSeconds < 60) return totalSeconds + 's';

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (totalSeconds < 3600) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
