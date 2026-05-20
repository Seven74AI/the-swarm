import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import {
  getProjects,
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
  type ResearchProjectId,
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
    it('returns all 3 research projects', () => {
      const projects = getProjects();
      expect(projects).toHaveLength(3);
      expect(projects.map((p) => p.id).sort()).toEqual([
        'antimatterContainment',
        'darkMatterDetection',
        'voidCrystalSynthesis',
      ]);
    });

    it('each project has name, cost, requiredResearchers, totalTicks, and unlock', () => {
      for (const project of getProjects()) {
        expect(project.name).toBeTruthy();
        expect(project.requiredResearchers).toBeGreaterThan(0);
        expect(project.totalTicks).toBeGreaterThan(0);
        expect(project.unlock).toBeTruthy();
        expect(Object.keys(project.cost).length).toBeGreaterThan(0);
      }
    });

    it('voidCrystalSynthesis requires 500 stone, 200 nectar, 50 researchers, 120 ticks', () => {
      const vcs = getProjects().find((p) => p.id === 'voidCrystalSynthesis')!;
      expect(vcs.cost.stone).toBe(500);
      expect(vcs.cost.nectar).toBe(200);
      expect(vcs.requiredResearchers).toBe(50);
      expect(vcs.totalTicks).toBe(120);
    });

    it('antimatterContainment requires 5 voidCrystals, 30 researchers, 300 ticks', () => {
      const ac = getProjects().find((p) => p.id === 'antimatterContainment')!;
      expect(ac.cost.voidCrystals).toBe(5);
      expect(ac.requiredResearchers).toBe(30);
      expect(ac.totalTicks).toBe(300);
    });

    it('darkMatterDetection requires 0.1 antimatter, 20 researchers, 500 ticks', () => {
      const dmd = getProjects().find((p) => p.id === 'darkMatterDetection')!;
      expect(dmd.cost.antimatter).toBe(0.1);
      expect(dmd.requiredResearchers).toBe(20);
      expect(dmd.totalTicks).toBe(500);
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
          voidCrystalSynthesis: { state: 'completed', progress: 120 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      };
      const status = getProjectStatus(state, 'antimatterContainment');
      expect(status).toBe('available');
    });

    it('returns in_progress for active projects', () => {
      state.research = {
        projects: {
          voidCrystalSynthesis: { state: 'in_progress', progress: 50 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      };
      const status = getProjectStatus(state, 'voidCrystalSynthesis');
      expect(status).toBe('in_progress');
    });

    it('returns completed for finished projects', () => {
      state.research = {
        projects: {
          voidCrystalSynthesis: { state: 'completed', progress: 120 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
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
          voidCrystalSynthesis: { state: 'in_progress', progress: 0 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      };
      expect(canStartProject(state, 'voidCrystalSynthesis')).toBe(false);
    });

    it('cannot start completed project', () => {
      state.workersAssigned.researchers = 50;
      state.research = {
        projects: {
          voidCrystalSynthesis: { state: 'completed', progress: 120 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
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

      expect(result.research.projects.voidCrystalSynthesis.state).toBe('in_progress');
      expect(result.research.projects.voidCrystalSynthesis.progress).toBe(0);
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
          voidCrystalSynthesis: { state: 'completed', progress: 120 },
          antimatterContainment: { state: 'available', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
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

      expect(cancelled.research.projects.voidCrystalSynthesis.state).toBe('available');
      expect(cancelled.research.projects.voidCrystalSynthesis.progress).toBe(0);
    });

    it('returns unchanged state if project is not in_progress', () => {
      const result = cancelProject(state, 'voidCrystalSynthesis');
      expect(result).toBe(state);
    });
  });

  describe('tickResearch', () => {
    it('does nothing when no projects are in_progress', () => {
      const result = tickResearch(state);
      expect(result).toBe(state);
    });

    it('advances progress for in_progress project with enough researchers', () => {
      state.workersAssigned.researchers = 50;
      let working = startProject(state, 'voidCrystalSynthesis');

      working = tickResearch(working);
      expect(working.research.projects.voidCrystalSynthesis.progress).toBe(1);

      working = tickResearch(working);
      expect(working.research.projects.voidCrystalSynthesis.progress).toBe(2);
    });

    it('does NOT advance progress when not enough researchers assigned', () => {
      state.workersAssigned.researchers = 10;
      state.research = {
        projects: {
          voidCrystalSynthesis: { state: 'in_progress', progress: 0 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      };
      const result = tickResearch(state);
      expect(result.research.projects.voidCrystalSynthesis.progress).toBe(0);
    });

    it('completes project when progress reaches totalTicks', () => {
      state.workersAssigned.researchers = 50;
      let working = startProject(state, 'voidCrystalSynthesis');

      // Set progress just before completion (totalTicks = 120)
      working = {
        ...working,
        research: {
          ...working.research,
          projects: {
            ...working.research.projects,
            voidCrystalSynthesis: {
              state: 'in_progress' as const,
              progress: 119,
            },
          },
        },
      };

      working = tickResearch(working);
      expect(working.research.projects.voidCrystalSynthesis.state).toBe('completed');
      expect(working.research.projects.voidCrystalSynthesis.progress).toBe(120);
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
            voidCrystalSynthesis: {
              state: 'in_progress' as const,
              progress: 119,
            },
          },
        },
      };

      working = tickResearch(working);

      // After voidCrystalSynthesis completes, antimatterContainment should be available
      const status = getProjectStatus(working, 'antimatterContainment');
      expect(status).toBe('available');
    });

    it('advances multiple in-progress projects simultaneously', () => {
      state.workersAssigned.researchers = 80; // Enough for both VCS (50) + AC (30)
      state.research = {
        projects: {
          voidCrystalSynthesis: { state: 'in_progress', progress: 10 },
          antimatterContainment: { state: 'in_progress', progress: 50 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      };

      const result = tickResearch(state);
      expect(result.research.projects.voidCrystalSynthesis.progress).toBe(11);
      expect(result.research.projects.antimatterContainment.progress).toBe(51);
      expect(result.research.projects.darkMatterDetection.progress).toBe(0);
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
          voidCrystalSynthesis: { state: 'in_progress', progress: 100 },
          antimatterContainment: { state: 'in_progress', progress: 50 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      };
      expect(getTotalProgress(state)).toBe(150);
    });
  });

  describe('isProjectCompleted', () => {
    it('returns true for completed projects', () => {
      state.research = {
        projects: {
          voidCrystalSynthesis: { state: 'completed', progress: 120 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
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
