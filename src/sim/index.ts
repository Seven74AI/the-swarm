/** The headless simulated player (Story 3.7, AR15, D12). See `runner.ts`. */
export { SimRunner, runSim, type SimOptions, type SimResult } from './runner';
export { defaultPolicy, type PlayerPolicy, type PolicyTurn, type SimMove } from './policy';
export { Probes, decisionsAvailable, type CheckInRecord, type PhaseEntry, type ProbeReport } from './probes';
export { dailySchedule, repeatCheckIns, scheduleMs, type CheckIn, type CheckInSchedule, type DailyScheduleOptions } from './schedule';
