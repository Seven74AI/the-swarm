/**
 * `pnpm perf` harness (Story 8.6): the nest scene alone, with the real tokens
 * and styles (CRT in its default SCENE mode), for a colony given in the query string
 * (`?workers=5000&eggs=1200&larvae=500`), so its frame time is measured
 * without the rest of the game. As in the game, the view changes up to 4
 * times a second (`sceneBalance.viewRefreshMs`): one more worker each time.
 * Built only by tests/perf/nestScene.perf.ts.
 */
import '../../../src/ui/styles/tokens.css';
import '../../../src/ui/styles/typography.css';
import '../../../src/ui/styles/base.css';
import '../../../src/ui/styles/crt.css';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { NestScene } from '../../../src/ui/scenes/NestScene';
import { sceneBalance } from '../../../src/data/balance/scene';

const q = new URLSearchParams(location.search);
const n = (k: string) => Math.max(0, Math.floor(Number(q.get(k) ?? 0)));
const start = { workers: n('workers'), eggs: n('eggs'), larvae: n('larvae'), starving: false };

function Harness() {
  const [view, setView] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setView((v) => ({ ...v, workers: v.workers + 1 })), sceneBalance.viewRefreshMs);
    return () => clearInterval(id);
  }, []);
  return <NestScene view={view} onChamber={() => {}} />;
}

render(<Harness />, document.getElementById('harness')!);
