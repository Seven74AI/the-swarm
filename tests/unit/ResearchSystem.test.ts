import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import {
  getProjects,
  getProjectsFor,
  getProjectStatus,
  canStartProject,
  startProject,
  cancelProject,
  tickResearch,
  assignResearcher,
  unassignResearcher,
  getAssignedResearchers,
  getTotalProgress,
  isProjectCompleted,
} from '../../src/systems/ResearchSystem';

/**
 * ResearchSystem tests — TDD: cost deduction, tick progress, completion unlock,
 * cancel refund 50%, chain validation.
 */
describe('ResearchSystem', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
    // Give enough resources to test with
    state.resources.stone = 1000;
    state.resources.nectar = 500;
    state.resources.voidCrystals = 10;
    state.resources.antimatter = 1;
    state.resources.workers = 100;
  });

  describe('getProjects', () => {
    it('returns the 3-step space chain plus the offline research (Story 2.8)', () => {
      expect(getProjectsFor('research_panel').map((p) => p.id).sort()).toEqual([
        'antimatterContainment',
        'darkMatterDetection',
        'voidCrystalSynthesis',
      ]);
      expect(getProjectsFor('offline_research_panel').map((p) => p.id)).toEqual(['dormantForaging']);
      expect(getProjects()).toHaveLength(4);
    });

    it('each project has name, cost, requiredResearchers, durationMs, and unlock', () => {
      for (const project of getProjectsFor('research_panel')) {
        expect(project.name).toBeTruthy();
        expect(project.requiredResearchers).toBeGreaterThan(0);
        expect(project.durationMs).toBeGreaterThan(0);
        expect(project.unlock).toBeTruthy();
        expect(Object.keys(project.cost).length).toBeGreaterThan(0);
      }
    });

    it('every space project costs something, needs researchers and takes time', () => {
      // Exact amounts are balance (data), not behaviour. Integer costs are Story 3.3 (#283).
      for (const project of getProjectsFor('research_panel')) {
        const amounts = Object.values(project.cost) as number[];
        expect(amounts.length, project.id).toBeGreaterThan(0);
        for (const amount of amounts) expect(amount, project.id).toBeGreaterThan(0);
        expect(Number.isInteger(project.requiredResearchers), project.id).toBe(true);
        expect(project.durationMs % 50, `${project.id}: whole ticks`).toBe(0);
      }
    });

    it('the space chain runs void crystals → antimatter → dark matter, each step paid with the last one\'s output', () => {
      const byId = new Map(getProjects().map((p) => [p.id, p]));
      expect(byId.get('voidCrystalSynthesis')!.prerequisite ?? null).toBeNull();
      expect(byId.get('antimatterContainment')!.prerequisite).toBe('voidCrystalSynthesis');
      expect(byId.get('darkMatterDetection')!.prerequisite).toBe('antimatterContainment');
      expect(Object.keys(byId.get('antimatterContainment')!.cost)).toContain('voidCrystals');
      expect(Object.keys(byId.get('darkMatterDetection')!.cost)).toContain('antimatter');
    });

    it('later steps of the chain take longer', () => {
      const ms = (id: string) => getProjects().find((p) => p.id === id)!.durationMs;
      expect(ms('antimatterContainment')).toBeGreaterThan(ms('voidCrystalSynthesis'));
      expect(ms('darkMatterDetection')).toBeGreaterThan(ms('antimatterContainment'));
    });
  });

  describe('getProjectStatus', () => {
    it('returns available for projects with no prerequisite and enough resources', () => {
      const status = getProjectStatus(state, 'voidCrystalSynthesis');
      expect(status).toBe('available');
    });

    it('returns locked for projects whose prerequisite is not completed', () => {
      const status = getProjectStatus(state, 'antimatterContainment');
      expect(status).toBe('locked');
    });

    it('returns available when prerequisite is completed', () => {
      state.research = {
        projects: {
          voidCrystalSynthesis: { status: 'done' },
          antimatterContainment: { status: 'idle' },
          darkMatterDetection: { status: 'idle' },
          dormantForaging: { status: 'idle' },
        },
      };
      const status = getProjectStatus(state, 'antimatterContainment');
      expect(status).toBe('available');
    });

    it('returns in_progress for active projects', () => {
      state.research = {
        projects: {
          voidCrystalSynthesis: { status: 'running' as const, progressMs: 2500, durationMs: 30_000 },
          antimatterContainment: { status: 'idle' },
          darkMatterDetection: { status: 'idle' },
          dormantForaging: { status: 'idle' },
        },
      };
      const status = getProjectStatus(state, 'voidCrystalSynthesis');
      expect(status).toBe('in_progress');
    });

    it('returns completed for finished projects', () => {
      state.research = {
        projects: {
          voidCrystalSynthesis: { status: 'done' },
          antimatterContainment: { status: 'idle' },
          darkMatterDetection: { status: 'idle' },
          dormantForaging: { status: 'idle' },
        },
      };
      const status = getProjectStatus(state, 'voidCrystalSynthesis');
      expect(status).toBe('completed');
    });
  });

  describe('canStartProject', () => {
    it('cannot start without enough resources', () => {
      state.resources.stone = 0;
      state.resources.nectar = 0;
      expect(canStartProject(state, 'voidCrystalSynthesis')).toBe(false);
    });

    it('cannot start without enough assigned researchers', () => {
      state.workersAssigned.researchers = 10;
      expect(canStartProject(state, 'voidCrystalSynthesis')).toBe(false);
    });

    it('can start with enough resources and researchers', () => {
      state.workersAssigned.researchers = 50;
      expect(canStartProject(state, 'voidCrystalSynthesis')).toBe(true);
    });

    it('cannot start already in-progress project', () => {
      state.workersAssigned.researchers = 50;
      state.research = {
        projects: {
          voidCrystalSynthesis: { status: 'running' as const, progressMs: 0, durationMs: 30_000 },
          antimatterContainment: { status: 'idle' },
          darkMatterDetection: { status: 'idle' },
          dormantForaging: { status: 'idle' },
        },
      };
      expect(canStartProject(state, 'voidCrystalSynthesis')).toBe(false);
    });

    it('cannot start completed project', () => {
      state.workersAssigned.researchers = 50;
      state.research = {
        projects: {
          voidCrystalSynthesis: { status: 'done' },
          antimatterContainment: { status: 'idle' },
          darkMatterDetection: { status: 'idle' },
          dormantForaging: { status: 'idle' },
        },
      };
      expect(canStartProject(state, 'voidCrystalSynthesis')).toBe(false);
    });
  });

  describe('startProject', () => {
    it('deducts resource costs on start', () => {
      state.workersAssigned.researchers = 50;
      const result = startProject(state, 'voidCrystalSynthesis');

      expect(result.resources.stone).toBeLessThan(state.resources.stone);
      expect(result.resources.nectar).toBeLessThan(state.resources.nectar);
    });

    it('sets project state to in_progress', () => {
      state.workersAssigned.researchers = 50;
      const result = startProject(state, 'voidCrystalSynthesis');

      expect(result.research.projects.voidCrystalSynthesis).toMatchObject({ status: 'running', progressMs: 0 });
    });

    it('returns unchanged state if cannot start', () => {
      state.resources.stone = 0;
      const result = startProject(state, 'voidCrystalSynthesis');
      expect(result).toBe(state);
    });

    it('deducts exactly the required costs for voidCrystalSynthesis', () => {
      state.workersAssigned.researchers = 50;
      const beforeStone = state.resources.stone;
      const beforeNectar = state.resources.nectar;
      const result = startProject(state, 'voidCrystalSynthesis');

      expect(result.resources.stone).toBe(beforeStone - 500);
      expect(result.resources.nectar).toBe(beforeNectar - 200);
    });

    it('deducts voidCrystals for antimatterContainment', () => {
      state.workersAssigned.researchers = 30;
      // Complete prerequisite
      state.research = {
        projects: {
          voidCrystalSynthesis: { status: 'done' },
          antimatterContainment: { status: 'idle' },
          darkMatterDetection: { status: 'idle' },
          dormantForaging: { status: 'idle' },
        },
      };
      const result = startProject(state, 'antimatterContainment');

      expect(result.resources.voidCrystals).toBe(5); // 10 - 5
    });
  });

  describe('cancelProject', () => {
    it('refunds 50% of resources', () => {
      state.workersAssigned.researchers = 50;
      const started = startProject(state, 'voidCrystalSynthesis');
      const cancelled = cancelProject(started, 'voidCrystalSynthesis');

      // 50% refund: 500 stone → 250, 200 nectar → 100
      expect(cancelled.resources.stone).toBe(state.resources.stone - 250);
      expect(cancelled.resources.nectar).toBe(state.resources.nectar - 100);
    });

    it('sets project back to available', () => {
      state.workersAssigned.researchers = 50;
      const started = startProject(state, 'voidCrystalSynthesis');
      const cancelled = cancelProject(started, 'voidCrystalSynthesis');

      expect(cancelled.research.projects.voidCrystalSynthesis).toEqual({ status: 'idle' });
    });

    it('returns unchanged state if project is not in_progress', () => {
      const result = cancelProject(state, 'voidCrystalSynthesis');
      expect(result).toBe(state);
    });
  });

  describe('tickResearch', () => {
    it('does nothing when no projects are in_progress', () => {
      const result = tickResearch(state, 0.05);
      expect(result).toBe(state);
    });

    it('advances progress for in_progress project with enough researchers', () => {
      state.workersAssigned.researchers = 50;
      let working = startProject(state, 'voidCrystalSynthesis');

      working = tickResearch(working, 0.05);
      expect(working.research.projects.voidCrystalSynthesis).toMatchObject({ progressMs: 50 });

      working = tickResearch(working, 0.05);
      expect(working.research.projects.voidCrystalSynthesis).toMatchObject({ progressMs: 100 });
    });

    it('does NOT advance progress when not enough researchers assigned', () => {
      state.workersAssigned.researchers = 10;
      state.research = {
        projects: {
          voidCrystalSynthesis: { status: 'running' as const, progressMs: 0, durationMs: 30_000 },
          antimatterContainment: { status: 'idle' },
          darkMatterDetection: { status: 'idle' },
          dormantForaging: { status: 'idle' },
        },
      };
      const result = tickResearch(state, 0.05);
      expect(result.research.projects.voidCrystalSynthesis).toMatchObject({ progressMs: 0 });
    });

    it('completes project when progress reaches totalTicks', () => {
      state.workersAssigned.researchers = 50;
      let working = startProject(state, 'voidCrystalSynthesis');

      // Set progress just before completion (totalTicks = 600)
      working = {
        ...working,
        research: {
          ...working.research,
          projects: {
            ...working.research.projects,
            voidCrystalSynthesis: { status: 'running' as const, progressMs: 599 * 50, durationMs: 600 * 50 },
          },
        },
      };

      working = tickResearch(working, 0.05);
      expect(working.research.projects.voidCrystalSynthesis).toEqual({ status: 'done' });
    });

    it('unlocks next project when prerequisite completes', () => {
      state.workersAssigned.researchers = 50;
      let working = startProject(state, 'voidCrystalSynthesis');

      // Fast-forward to just before completion
      working = {
        ...working,
        research: {
          ...working.research,
          projects: {
            ...working.research.projects,
            voidCrystalSynthesis: { status: 'running' as const, progressMs: 599 * 50, durationMs: 600 * 50 },
          },
        },
      };

      working = tickResearch(working, 0.05);

      // After voidCrystalSynthesis completes, antimatterContainment should be available
      const status = getProjectStatus(working, 'antimatterContainment');
      expect(status).toBe('available');
    });

    it('advances multiple in-progress projects simultaneously', () => {
      state.workersAssigned.researchers = 80; // Enough for both VCS (50) + AC (30)
      state.research = {
        projects: {
          voidCrystalSynthesis: { status: 'running' as const, progressMs: 500, durationMs: 30_000 },
          antimatterContainment: { status: 'running' as const, progressMs: 2500, durationMs: 30_000 },
          darkMatterDetection: { status: 'idle' },
          dormantForaging: { status: 'idle' },
        },
      };

      const result = tickResearch(state, 0.05);
      expect(result.research.projects.voidCrystalSynthesis).toMatchObject({ progressMs: 11 * 50 });
      expect(result.research.projects.antimatterContainment).toMatchObject({ progressMs: 51 * 50 });
      expect(result.research.projects.darkMatterDetection).toEqual({ status: 'idle' });
    });
  });

  describe('assignResearcher / unassignResearcher', () => {
    it('assignes one worker as researcher', () => {
      const result = assignResearcher(state);
      expect(result.workersAssigned.researchers).toBe(1);
      expect(result.resources.workers).toBe(state.resources.workers - 1);
    });

    it('returns unchanged state if no free workers', () => {
      state.resources.workers = 0;
      const result = assignResearcher(state);
      expect(result).toBe(state);
    });

    it('returns researcher to worker pool', () => {
      state.workersAssigned.researchers = 5;
      state.resources.workers = 95;
      const result = unassignResearcher(state);
      expect(result.workersAssigned.researchers).toBe(4);
      expect(result.resources.workers).toBe(96);
    });

    it('returns unchanged state if no researchers assigned', () => {
      state.workersAssigned.researchers = 0;
      const result = unassignResearcher(state);
      expect(result).toBe(state);
    });
  });

  describe('getAssignedResearchers', () => {
    it('returns the count of researchers assigned', () => {
      state.workersAssigned.researchers = 15;
      expect(getAssignedResearchers(state)).toBe(15);
    });
  });

  describe('getTotalProgress', () => {
    it('returns total progress across all projects', () => {
      state.research = {
        projects: {
          voidCrystalSynthesis: { status: 'running' as const, progressMs: 5000, durationMs: 30_000 },
          antimatterContainment: { status: 'running' as const, progressMs: 2500, durationMs: 30_000 },
          darkMatterDetection: { status: 'idle' },
          dormantForaging: { status: 'idle' },
        },
      };
      expect(getTotalProgress(state)).toBe(5000 + 2500);
    });
  });

  describe('isProjectCompleted', () => {
    it('returns true for completed projects', () => {
      state.research = {
        projects: {
          voidCrystalSynthesis: { status: 'done' },
          antimatterContainment: { status: 'idle' },
          darkMatterDetection: { status: 'idle' },
          dormantForaging: { status: 'idle' },
        },
      };
      expect(isProjectCompleted(state, 'voidCrystalSynthesis')).toBe(true);
      expect(isProjectCompleted(state, 'antimatterContainment')).toBe(false);
    });
  });

  describe('chain validation', () => {
    it('voidCrystalSynthesis has no prerequisite', () => {
      const projects = getProjects();
      const vcs = projects.find((p) => p.id === 'voidCrystalSynthesis')!;
      expect(vcs.prerequisite).toBeNull();
    });

    it('antimatterContainment requires voidCrystalSynthesis', () => {
      const projects = getProjects();
      const ac = projects.find((p) => p.id === 'antimatterContainment')!;
      expect(ac.prerequisite).toBe('voidCrystalSynthesis');
    });

    it('darkMatterDetection requires antimatterContainment', () => {
      const projects = getProjects();
      const dmd = projects.find((p) => p.id === 'darkMatterDetection')!;
      expect(dmd.prerequisite).toBe('antimatterContainment');
    });

    it('cannot start chained project without prerequisite complete', () => {
      state.workersAssigned.researchers = 30;
      expect(canStartProject(state, 'antimatterContainment')).toBe(false);
    });
  });
});
