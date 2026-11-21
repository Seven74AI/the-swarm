/**
 * Browser page services (Story 1.17): save a text file, reload the page, and
 * (Story 2.11) read a text file the player picks. Used by the tick-failure
 * sheet's EXPORT SAVE and RELOAD and by the settings' EXPORT/IMPORT SAVE. Missing APIs make
 * them do nothing rather than throw (platform/ can't import the logger: `download`
 * returns false and the caller logs).
 */
export interface Browser {
  /** Offer `text` to the player as a file named `filename`; false if the browser couldn't. */
  download(filename: string, text: string): boolean;
  reload(): void;
  /**
   * Let the player pick one file (`accept`: the input's accept list) and give
   * its text; null if they cancel, or the browser can't.
   */
  pickFile(accept: string): Promise<string | null>;
}

interface Anchor {
  href: string;
  download: string;
  click(): void;
}

/** The file input `pickFile` puts in the page while the picker is open. */
interface FileInput {
  type: string;
  accept: string;
  hidden: boolean;
  readonly files: ArrayLike<{ text(): Promise<string> }> | null;
  addEventListener(type: 'change' | 'cancel', listener: () => void): void;
  click(): void;
  remove(): void;
}

export interface BrowserEnv {
  readonly document?: {
    /** An `<a>` (download) or `<input>` (file picker); typed loosely so tests can fake either. */
    createElement(tag: 'a' | 'input'): unknown;
    /** Where the picker's input is put while it is open (any DOM element with `append`). */
    readonly body?: unknown;
  };
  readonly URL?: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void };
  readonly location?: { reload(): void };
}

export function createWebBrowser(env: BrowserEnv = typeof window === 'undefined' ? {} : (window as unknown as BrowserEnv)): Browser {
  return {
    download(filename, text) {
      try {
        if (!env.document || !env.URL || typeof Blob === 'undefined') return false;
        const url = env.URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const a = env.document.createElement('a') as Anchor;
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
    pickFile(accept) {
      const doc = env.document;
      if (!doc) return Promise.resolve(null);
      return new Promise<string | null>((resolve) => {
        let input: FileInput;
        try {
          input = doc.createElement('input') as FileInput;
          input.type = 'file';
          input.accept = accept;
          input.hidden = true;
        } catch {
          resolve(null);
          return;
        }
        let settled = false;
        const finish = (text: string | null): void => {
          if (settled) return;
          settled = true;
          input.remove();
          resolve(text);
        };
        input.addEventListener('change', () => {
          const file = input.files?.[0];
          if (!file) return finish(null);
          file.text().then(finish, () => finish(null));
        });
        input.addEventListener('cancel', () => finish(null));
        try {
          // In the page, so the picker works in every browser and tests can find it.
          (doc.body as { append?: (node: unknown) => void } | null | undefined)?.append?.(input);
          input.click();
        } catch {
          finish(null);
        }
      });
    },
  };
}
