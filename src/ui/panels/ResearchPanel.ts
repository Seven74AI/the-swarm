import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState, ResearchProjectId } from '../../state/GameState';
import {
  getProjects,
  getProjectStatus,
  canStartProject,
  startProject,
  cancelProject,
  assignResearcher,
  unassignResearcher,
  getAssignedResearchers,
  type ResearchProjectDef,
} from '../../systems/ResearchSystem';

/**
 * ResearchPanel — UI for the tick-based Research system.
 * Lists projects with name, cost, progress bar, unlock description.
 * Shows researcher assignment pool and project action buttons.
 */
export class ResearchPanel {
  private container: HTMLDivElement;
  private researcherCountEl: HTMLSpanElement | null = null;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'research-panel';
    this.container.className = 'panel research-panel';
    this.container.style.display = 'none';

    this.render();

    // Phase reveal on phase change
    bus.subscribe('phase_changed', (payload: unknown) => {
      const phase = (payload as { phase: string }).phase;
      // Research available in space / transcendence phases
      if (phase === 'space' || phase === 'transcendence') {
        this.container.style.display = '';
      }
    });

    // Reactive: re-render on state changes
    effect(() => {
      void gameState.value.research;
      void gameState.value.workersAssigned.researchers;
      void gameState.value.resources;
      this.render();
    });
  }

  /** Public refresh for tests. */
  refresh(): void {
    this.render();
  }

  getElement(): HTMLDivElement {
    return this.container;
  }

  private render(): void {
    this.container.innerHTML = '';
    const state = this.getState();

    // ── Title ──
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🔬 Research';
    this.container.appendChild(title);

    // ── Researcher assignment pool ──
    const researcherSection = document.createElement('div');
    researcherSection.className = 'research-researcher-pool';

    const poolLabel = document.createElement('span');
    poolLabel.className = 'research-pool-label';
    poolLabel.textContent = '👩‍🔬 Researchers: ';
    researcherSection.appendChild(poolLabel);

    const minusBtn = document.createElement('button');
    minusBtn.className = 'btn btn-sm';
    minusBtn.textContent = '−';
    minusBtn.addEventListener('click', () => {
      const s = this.getState();
      this.setState(unassignResearcher(s));
    });
    researcherSection.appendChild(minusBtn);

    this.researcherCountEl = document.createElement('span');
    this.researcherCountEl.className = 'research-pool-count';
    this.researcherCountEl.textContent = String(getAssignedResearchers(state));
    researcherSection.appendChild(this.researcherCountEl);

    const plusBtn = document.createElement('button');
    plusBtn.className = 'btn btn-sm';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => {
      const s = this.getState();
      this.setState(assignResearcher(s));
    });
    researcherSection.appendChild(plusBtn);

    this.container.appendChild(researcherSection);

    // ── Project list ──
    const projects = getProjects();
    for (const project of projects) {
      this.container.appendChild(this.renderProject(project, state));
    }
  }

  private renderProject(
    project: ResearchProjectDef,
    state: GameState,
  ): HTMLDivElement {
    const status = getProjectStatus(state, project.id);
    const assigned = getAssignedResearchers(state);

    const card = document.createElement('div');
    card.className = `research-project-card research-status-${status}`;
    card.setAttribute('data-research-project', project.id);

    // ── Header: name + status badge ──
    const header = document.createElement('div');
    header.className = 'research-project-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'research-project-name';
    nameEl.textContent = project.name;
    header.appendChild(nameEl);

    const statusBadge = document.createElement('span');
    statusBadge.className = `research-status-badge research-badge-${status}`;
    statusBadge.textContent = status === 'in_progress' ? 'In Progress'
      : status === 'completed' ? 'Completed'
      : status === 'locked' ? 'Locked'
      : 'Available';
    header.appendChild(statusBadge);

    card.appendChild(header);

    // ── Description ──
    if (status === 'completed') {
      const unlockEl = document.createElement('div');
      unlockEl.className = 'research-unlock-desc';
      unlockEl.textContent = `✅ Unlocked: ${project.unlock}`;
      card.appendChild(unlockEl);
    } else {
      const descEl = document.createElement('div');
      descEl.className = 'research-project-desc';
      descEl.textContent = project.description;
      card.appendChild(descEl);

      // ── Cost ──
      const costEl = document.createElement('div');
      costEl.className = 'research-cost';
      const costParts: string[] = [];
      for (const [resource, amount] of Object.entries(project.cost)) {
        costParts.push(`${amount} ${resource}`);
      }
      costEl.textContent = `Cost: ${costParts.join(', ')}`;
      card.appendChild(costEl);

      // ── Requirements ──
      const reqEl = document.createElement('div');
      reqEl.className = 'research-requirements';
      reqEl.textContent = `Researchers: ${assigned}/${project.requiredResearchers} | Ticks: ${project.totalTicks}`;
      card.appendChild(reqEl);
    }

    // ── Progress bar (in_progress) ──
    if (status === 'in_progress') {
      const progressContainer = document.createElement('div');
      progressContainer.className = 'progress-bar';

      const progressFill = document.createElement('div');
      progressFill.className = 'progress-bar-fill';
      const pct = Math.min(
        100,
        Math.round((state.research.projects[project.id].progress / project.totalTicks) * 100),
      );
      progressFill.style.width = `${pct}%`;
      progressFill.setAttribute('role', 'progressbar');
      progressFill.setAttribute('aria-valuenow', String(pct));
      progressContainer.appendChild(progressFill);

      card.appendChild(progressContainer);

      const progressText = document.createElement('div');
      progressText.className = 'research-progress-text';
      progressText.textContent = `${state.research.projects[project.id].progress} / ${project.totalTicks} ticks`;
      card.appendChild(progressText);
    }

    // ── Actions ──
    const actions = document.createElement('div');
    actions.className = 'research-actions';

    if (status === 'available') {
      const canStart = canStartProject(state, project.id);
      const startBtn = document.createElement('button');
      startBtn.className = 'btn btn-sm';
      startBtn.textContent = 'Start';
      startBtn.disabled = !canStart;
      startBtn.addEventListener('click', () => {
        const s = this.getState();
        this.setState(startProject(s, project.id));
      });
      actions.appendChild(startBtn);
    }

    if (status === 'in_progress') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-sm btn-danger';
      cancelBtn.textContent = 'Cancel (50% refund)';
      cancelBtn.addEventListener('click', () => {
        const s = this.getState();
        this.setState(cancelProject(s, project.id));
      });
      actions.appendChild(cancelBtn);
    }

    card.appendChild(actions);

    return card;
  }
}
