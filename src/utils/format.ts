/**
 * Number formatting (Story 1.9, UX-DR3 / FR35).
 *
 * Every formatter floors: the shown value is never greater than
 * `Math.floor(input)` at the shown precision, so a player never sees
 * more than they can spend.
 *
 * - `formatInt`: the floored integer, every digit, no grouping.
 * - `formatStrip`: resource strip cells. Full digits up to 9 999, then
 *   short-scale suffixes, never more than 5 characters (`12.4K`, `124K`, `1.24M`).
 * - `formatFull`: everywhere else. Full digits with space grouping up to
 *   999 999, then the same suffixes.
 *
 * Neither uses scientific notation in the suffix range (up to 999 Dc, ~1e36);
 * only values beyond it, which belong to Transcendence and later, fall back
 * to a floored `1e36`-style exponent.
 */

/** Short-scale suffixes, one per power of 1 000. */
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'] as const;

/** Thousands separator: a no-break space, so grouped numbers never wrap and keep monospace width. */
const GROUP_SEPARATOR = ' ';

const STRIP_MAX_CHARS = 5;
const STRIP_FULL_DIGITS_MAX = 9_999;
const FULL_DIGITS_MAX = 999_999;

/**
 * Format caches keyed by the floored integer value.
 * #22: avoids re-formatting the same value every tick.
 */
const FORMAT_CACHE_MAX_SIZE = 1000;
const stripCache = new Map<number, string>();
const fullCache = new Map<number, string>();

function cached(cache: Map<number, string>, key: number, formatter: (n: number) => string): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const result = formatter(key);
  cache.set(key, result);
  if (cache.size > FORMAT_CACHE_MAX_SIZE) {
    const keys = cache.keys();
    for (let i = 0; i < 100; i++) {
      const k = keys.next();
      if (k.done) break;
      cache.delete(k.value);
    }
  }
  return result;
}

/** Clear the format caches (useful for testing) */
export function clearFormatCache(): void {
  stripCache.clear();
  fullCache.clear();
}

/** Split a value into its sign and floored magnitude; non-finite values become 0 or Infinity. */
function signAndFloor(n: number): { sign: string; abs: number } {
  if (Number.isNaN(n)) return { sign: '', abs: 0 };
  // Floor the value itself (not its magnitude), so a negative never reads as less owed.
  const floored = Math.floor(n);
  if (floored < 0) return { sign: '-', abs: -floored };
  return { sign: '', abs: floored };
}

/** Every digit of a non-negative integer, without exponent notation (`toFixed` stays positional below 1e21). */
function digits(abs: number): string {
  if (abs < 1e21) return abs.toFixed(0);
  return BigInt(abs).toString();
}

function group(abs: number): string {
  return digits(abs).replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
}

/**
 * Suffix form of a non-negative integer ≥ 1 000, at most 5 characters, floored
 * at the shown precision. Exact integer arithmetic via BigInt, so a float
 * division can never round the mantissa up.
 */
function suffixed(abs: number, maxChars: number = STRIP_MAX_CHARS): string {
  if (!Number.isFinite(abs)) return '∞';
  const value = BigInt(abs);
  const text = value.toString();
  const tier = Math.floor((text.length - 1) / 3);

  if (tier >= SUFFIXES.length) {
    // Beyond the suffix range: floored mantissa digit + exponent, e.g. "1e36".
    return `${text[0]}e${text.length - 1}`;
  }

  const suffix = SUFFIXES[tier];
  const intDigits = text.length - tier * 3; // 1..3 digits before the point
  const room = maxChars - suffix.length; // characters left for the number
  const decimals = Math.max(0, room - intDigits - 1); // -1 for the point
  const shown = text.slice(0, intDigits + decimals); // truncation = floor
  const int = shown.slice(0, intDigits);
  const frac = shown.slice(intDigits);
  const out = (frac ? `${int}.${frac}` : int) + suffix;
  // A two-letter suffix after three digits can overflow a narrow field: fall back to the exponent.
  return out.length <= maxChars ? out : `${text[0]}e${text.length - 1}`;
}

/** The floored integer, every digit, no grouping. */
export function formatInt(n: number): string {
  const { sign, abs } = signAndFloor(n);
  if (!Number.isFinite(abs)) return sign + '∞';
  return sign + digits(abs);
}

/**
 * Resource strip format: full digits up to 9 999, then 5-character suffixes
 * (`12.4K`, `124K`, `1.24M`). Never rounds up.
 */
export function formatStrip(n: number): string {
  const { sign, abs } = signAndFloor(n);
  if (abs <= STRIP_FULL_DIGITS_MAX) return sign + digits(abs);
  return sign + cached(stripCache, abs, suffixed);
}

/**
 * Cards, sheets and panels: full digits with space grouping up to 999 999,
 * then suffixes (`1.24M`). Never rounds up.
 */
export function formatFull(n: number): string {
  const { sign, abs } = signAndFloor(n);
  if (abs < 1000) return sign + digits(abs);
  return sign + cached(fullCache, abs, (v) => (v <= FULL_DIGITS_MAX ? group(v) : suffixed(v)));
}

/** A true minus sign (U+2212), so a loss never reads as a hyphen. */
const MINUS = '\u2212';

/** Sign of a delta (`+`, `−` or nothing for zero) and its magnitude, truncated toward zero. */
function deltaParts(n: number): { sign: string; abs: number } {
  const t = Number.isNaN(n) ? 0 : Math.trunc(n);
  if (t > 0) return { sign: '+', abs: t };
  if (t < 0) return { sign: MINUS, abs: -t };
  return { sign: '', abs: 0 };
}

/**
 * Resource strip delta (Story 1.16, UX-DR7): `+12`, `−3`, `0`, `+12K`.
 * At most 5 characters with the sign, no `/s` (the unit is stated in the
 * resource sheet). The magnitude never exceeds the integer part.
 */
export function formatDelta(n: number): string {
  const { sign, abs } = deltaParts(n);
  const room = STRIP_MAX_CHARS - sign.length;
  if (abs < 10 ** room) return sign + digits(abs);
  return sign + suffixed(abs, room);
}

/** Resource sheet rate: the signed `formatFull` of the magnitude (`+1 234`, `−12`, `0`). */
export function formatDeltaFull(n: number): string {
  const { sign, abs } = deltaParts(n);
  return sign + formatFull(abs);
}

/**
 * Format a small rate/decimal for display.
 * <1: 1 decimal (0.2, 0.8)
 * <10: 1 decimal (3.5)
 * >=10: integer (42)
 */
export function formatRate(n: number): string {
  if (n < 1) return n.toFixed(1);
  if (n < 10) return n.toFixed(1);
  return Math.round(n).toLocaleString('en-US');
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

/**
 * A duration for copy (#466, was the offline summary's `formatAway`): "45s",
 * "12m 30s", "3h 14m", "8h": a zero minor unit is dropped.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}

const SEC_PER_MIN = 60;

/**
 * The resource sheet's rate (Story 9.10, UX-DR8): from 1 a second, whole units
 * per second (`+3/S`, `−12/S`); under that, whole units per minute (`+36/M`),
 * rounded up so a rate that is not zero never reads as zero; `0` when flat.
 */
export function formatSheetRate(perSec: number): string {
  if (!Number.isFinite(perSec) || perSec === 0) return '0';
  const sign = perSec > 0 ? '+' : '−';
  const abs = Math.abs(perSec);
  if (abs >= 1) return `${sign}${formatFull(Math.floor(abs))}/S`;
  return `${sign}${formatFull(Math.max(1, Math.round(abs * SEC_PER_MIN)))}/M`;
}

const SPARK_CELLS = '▁▂▃▄▅▆▇█';

/** A text sparkline (Story 9.10): one cell per value, scaled from the lowest to the highest; flat when nothing moves. */
export function sparkline(values: readonly number[]): string {
  if (values.length === 0) return '';
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const top = SPARK_CELLS.length - 1;
  return values.map((v) => SPARK_CELLS[hi > lo ? Math.round(((v - lo) / (hi - lo)) * top) : 0]).join('');
}
