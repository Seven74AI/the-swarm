import { runnerImport } from 'vite';
console.info = () => {};
const imp = (p) => runnerImport(p, { configFile: false, root: process.cwd(), logLevel: 'error' }).then((r) => r.module);
const { SimRunner } = await imp('/src/sim/runner.ts');
const { firstWeekSchedule } = await imp('/src/sim/schedule.ts');
const { createInitialState } = await imp('/src/state/GameState.ts');
const sched = firstWeekSchedule(1).slice(0, 1);
let last = '';
const r = new SimRunner({ state: createInitialState(), seed: 1, schedule: sched, stopWhen: (s) => {
  const k = `${s.phase} cap=${s.resources.nestCapacity} rooms=${s.dig.roomsDug} wh=${s.buildings.warehouse.level} w=${s.resources.workers} e=${s.resources.eggs} l=${s.resources.larvae} dig=${s.workersAssigned.dig}`;
  if (k.split(' w=')[0] !== last.split(' w=')[0]) console.log(k);
  last = k; return s.phase === 'combat'; } });
r.run();
