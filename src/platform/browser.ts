/**
 * Browser page services (Story 1.17): save a text file, reload the page.
 * Used by the tick-failure sheet's EXPORT SAVE and RELOAD. Missing APIs make
 * them do nothing rather than throw (platform/ can't import the logger: `download`
 * returns false and the caller logs).
 */
export interface Browser {
  /** Offer `text` to the player as a file named `filename`; false if the browser couldn't. */
  download(filename: string, text: string): boolean;
  reload(): void;
}

interface Anchor {
  href: string;
  download: string;
  click(): void;
}

export interface BrowserEnv {
  readonly document?: { createElement(tag: 'a'): Anchor };
  readonly URL?: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void };
  readonly location?: { reload(): void };
}

export function createWebBrowser(env: BrowserEnv = typeof window === 'undefined' ? {} : (window as unknown as BrowserEnv)): Browser {
  return {
    download(filename, text) {
      try {
        if (!env.document || !env.URL || typeof Blob === 'undefined') return false;
        const url = env.URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const a = env.document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        env.URL.revokeObjectURL(url);
        return true;
      } catch {
        return false;
      }
    },
    reload() {
      env.location?.reload();
    },
  };
}
