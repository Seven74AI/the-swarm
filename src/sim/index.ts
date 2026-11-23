/** The headless simulated player (Story 3.7, AR15, D12). See `runner.ts`. */
export { SimRunner, runSim, type SimOptions, type SimResult } from './runner';
export { defaultPolicy, maxArmyPolicy, type PlayerPolicy, type PolicyTurn, type SimMove } from './policy';
export { Probes, decisionsAvailable, waitMs, type CheckInRecord, type EggSample, type Payoff, type PayoffKind, type PhaseEntry, type ProbeReport } from './probes';
export { dailySchedule, firstWeekSchedule, repeatCheckIns, scheduleMs, type CheckIn, type CheckInSchedule, type DailyScheduleOptions } from './schedule';
export { buildPacingReport, combatEntry, compareArmies, formatArmyComparison, onlyMaxArmyFoodCritical, runArmyComparison, type ArmyComparison, type ArmyRun, formatPacingReport, idleCheckIns, judgeSpan, median, phaseSpans, runPacingReport, tapShare, longestIdleGap, idleGapGate, phaseEndGate, postWeekGate, firstWeekGates, type GateLine, type GateVerdict, type PacingReport, type PacingRow, type PhaseSpan, type Verdict } from './report';
