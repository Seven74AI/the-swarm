import { describe, expect, it } from 'vitest';
import { debugEnabled } from '../../../src/debug/enabled';

/** Story 1.34 (AR24): the overlay is on in dev builds, and in production only with `?debug=1`. */
describe('debugEnabled', () => {
  it('is on in a dev build, whatever the URL', () => {
    expect(debugEnabled({ dev: true, search: '' })).toBe(true);
  });

  it('is off in production unless the URL has debug=1', () => {
    expect(debugEnabled({ dev: false, search: '' })).toBe(false);
    expect(debugEnabled({ dev: false, search: '?debug=0' })).toBe(false);
    expect(debugEnabled({ dev: false, search: '?debugx=1' })).toBe(false);
    expect(debugEnabled({ dev: false, search: '?debug=1' })).toBe(true);
    expect(debugEnabled({ dev: false, search: '?a=b&debug=1' })).toBe(true);
  });
});
