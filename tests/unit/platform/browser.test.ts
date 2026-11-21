import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebBrowser } from '../../../src/platform/browser';
import { createWebPlatform } from '../../../src/platform';

/** Story 1.17: the platform's file download and page reload (EXPORT SAVE / RELOAD). */
describe('web browser service', () => {
  it('download saves the text as a named file through a temporary link', () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    const clicked: { download: string; href: string }[] = [];
    const doc = {
      createElement: () => {
        const a = { href: '', download: '', click: () => clicked.push({ download: a.download, href: a.href }) };
        return a;
      },
    };
    const b = createWebBrowser({ document: doc, URL: { createObjectURL, revokeObjectURL } });
    expect(b.download('the-swarm-save.json', '{"a":1}')).toBe(true);
    expect(clicked).toEqual([{ download: 'the-swarm-save.json', href: 'blob:x' }]);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });

  it('reload reloads the page', () => {
    const reload = vi.fn();
    createWebBrowser({ location: { reload } }).reload();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing, without throwing, where the browser APIs are missing', () => {
    const b = createWebBrowser({});
    expect(b.download('f.json', 'x')).toBe(false);
    expect(() => b.reload()).not.toThrow();
  });

  it('is part of the web platform', () => {
    const p = createWebPlatform({});
    expect(typeof p.browser.download).toBe('function');
    expect(typeof p.browser.reload).toBe('function');
  });

  it('is part of the web platform with a file picker', () => {
    expect(typeof createWebPlatform({}).browser.pickFile).toBe('function');
  });
});

/** Story 2.11: IMPORT SAVE reads one file the player picks. */
describe('web browser file picker', () => {
  afterEach(() => document.body.replaceChildren());

  const input = () => document.querySelector<HTMLInputElement>('input[type="file"]');

  function pick(file: File | null) {
    const b = createWebBrowser({ document });
    const picked = b.pickFile('.json,application/json');
    const el = input()!;
    expect(el).not.toBeNull();
    expect(el.accept).toBe('.json,application/json');
    if (file) {
      Object.defineProperty(el, 'files', { value: [file] });
      el.dispatchEvent(new Event('change'));
    } else {
      el.dispatchEvent(new Event('cancel'));
    }
    return picked;
  }

  it('gives the picked file’s text and removes its input', async () => {
    await expect(pick(new File(['{"version":1}'], 'save.json'))).resolves.toBe('{"version":1}');
    expect(input()).toBeNull();
  });

  it('gives null when the player cancels', async () => {
    await expect(pick(null)).resolves.toBeNull();
    expect(input()).toBeNull();
  });

  it('gives null, without throwing, where there is no document', async () => {
    await expect(createWebBrowser({}).pickFile('.json')).resolves.toBeNull();
  });
});
