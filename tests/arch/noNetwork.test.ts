// @vitest-environment node
/**
 * NFR10 (Story 3.10): the game needs no network and calls no one. Nothing in
 * src/ names a browser API that talks to a server (fetch, XMLHttpRequest,
 * sendBeacon, WebSocket, EventSource, WebRTC). Telemetry and diagnostics leave
 * the device only as files the player downloads (`platform.browser.download`).
 * The service worker is generated at build time and checked by pwaBuild.test.ts.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findInCode, listSources, type SourceFile } from './scan';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

const NETWORK_API_PATTERN =
  /(?<![\w$])(?:fetch\s*\(|XMLHttpRequest\b|sendBeacon\b|WebSocket\b|EventSource\b|RTCPeerConnection\b|WebTransport\b)/g;

function networkApiUses(files: readonly SourceFile[]): string[] {
  return files.flatMap((f) =>
    findInCode(f.text, NETWORK_API_PATTERN).map((h) => `${f.rel}:${h.line} uses '${h.text.trim()}'; the game makes no network request`),
  );
}

describe('no network (NFR10, Story 3.10)', () => {
  it('nothing in src/ names a network API', () => {
    const files = listSources(SRC);
    expect(files.length).toBeGreaterThan(0);
    expect(networkApiUses(files)).toEqual([]);
  });

  it('catches a planted use, but not one in a comment or a string', () => {
    const fake = (rel: string, text: string): SourceFile => ({ rel, text });
    const hits = networkApiUses([
      fake('ui/A.ts', "void fetch('https://example.com/t');"),
      fake('state/B.ts', 'navigator.sendBeacon(url, body);'),
      fake('platform/C.ts', 'const ws = new WebSocket(url);'),
      fake('main.tsx', 'const x = new XMLHttpRequest();'),
      fake('ui/D.ts', "// fetch('x') is never called\nconst s = 'new WebSocket(url)';"),
      fake('ui/E.ts', 'const prefetch = (x: number) => x; prefetch(1);'),
    ]);
    expect(hits).toHaveLength(4);
  });
});
