/**
 * Whether the debug overlay is available (Story 1.34, AR24): always in a dev
 * build, and in production only when the page is opened with `?debug=1`.
 * Cheats are a separate, stricter rule: dev builds only (main checks
 * `import.meta.env.DEV` itself, so the bundler drops them).
 */
export function debugEnabled(env: { readonly dev: boolean; readonly search: string }): boolean {
  if (env.dev) return true;
  try {
    return new URLSearchParams(env.search).get('debug') === '1';
  } catch {
    return false;
  }
}
