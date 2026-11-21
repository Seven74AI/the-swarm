import { describe, expect, it, vi } from 'vitest';
import { createLifecycle, type LifecycleEnv } from '../../../src/platform/lifecycle';

/**
 * Story 2.3 (D1): the Lifecycle platform service turns the browser's page
 * events into two signals, hidden and returned. Every way back (tab visible,
 * bfcache pageshow, focus after sleep) is a `returned`.
 */

function fakeEnv() {
  const doc = new EventTarget() as EventTarget & { visibilityState: string };
  doc.visibilityState = 'visible';
  const win = new EventTarget();
  const env: LifecycleEnv = {
    document: doc,
    addEventListener: win.addEventListener.bind(win),
    removeEventListener: win.removeEventListener.bind(win),
  };
  return {
    env,
    hide: () => {
      doc.visibilityState = 'hidden';
      doc.dispatchEvent(new Event('visibilitychange'));
    },
    show: () => {
      doc.visibilityState = 'visible';
      doc.dispatchEvent(new Event('visibilitychange'));
    },
    win: (type: string) => win.dispatchEvent(new Event(type)),
    setVisibility: (v: string) => void (doc.visibilityState = v),
  };
}

function bound() {
  const f = fakeEnv();
  const hidden = vi.fn();
  const returned = vi.fn();
  const unbind = createLifecycle(f.env).bind({ hidden, returned });
  return { ...f, hidden, returned, unbind };
}

describe('createLifecycle (Story 2.3)', () => {
  it('visibilitychange to hidden is hidden; back to visible is returned', () => {
    const b = bound();
    b.hide();
    expect(b.hidden).toHaveBeenCalledTimes(1);
    b.show();
    expect(b.returned).toHaveBeenCalledTimes(1);
  });

  it('pagehide is hidden', () => {
    const b = bound();
    b.win('pagehide');
    expect(b.hidden).toHaveBeenCalledTimes(1);
  });

  it('pageshow (a bfcache return) is returned', () => {
    const b = bound();
    b.win('pageshow');
    expect(b.returned).toHaveBeenCalledTimes(1);
  });

  it('focus (after sleep) is returned', () => {
    const b = bound();
    b.win('focus');
    expect(b.returned).toHaveBeenCalledTimes(1);
  });

  it('a return signal while the document is still hidden is ignored', () => {
    const b = bound();
    b.setVisibility('hidden');
    b.win('focus');
    b.win('pageshow');
    expect(b.returned).not.toHaveBeenCalled();
  });

  it('unbinding stops every signal', () => {
    const b = bound();
    b.unbind();
    b.hide();
    b.show();
    b.win('pagehide');
    b.win('pageshow');
    b.win('focus');
    expect(b.hidden).not.toHaveBeenCalled();
    expect(b.returned).not.toHaveBeenCalled();
  });

  it('binds nothing (and does not throw) without a browser', () => {
    expect(() => createLifecycle({}).bind({ hidden: () => {}, returned: () => {} })()).not.toThrow();
  });
});
