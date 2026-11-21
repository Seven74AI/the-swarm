import { effect, untracked, type ReadonlySignal } from '@preact/signals-core';
import { h, render as renderPreact } from 'preact';
import {
  selectResearch,
  selectResearchers,
  selectResources,
} from '../../state/selectors';
import type { EventBus } from '../../engine/EventBus';
import type { GameState, ResearchProjectId } from '../../state/GameState';
import {
  getProjects,
  getProjectStatus,
  canStartProject,
  getAssignedResearchers,
  type ResearchProjectDef,
} from '../../state/queries';
import type { Actions } from '../../actions';
import { explain } from '../components/refusal';
import { HoldToConfirm, type ConfirmSettings } from '../primitives/HoldToConfirm';

/** Game-time progress of a project, in ms (0 unless it is running). */
function progressMs(state: GameState, id: ResearchProjectId): number {
  const p = state.research.projects[id];
  return p?.status === 'running' ? p.progressMs : 0;
}

/**
 * ResearchPanel — UI for the tick-based Research system.
 * Lists projects with name, cost, progress bar, unlock description.
 * Shows researcher assignment pool and project action buttons.
 *
 * Cancel is irreversible (half the cost is lost), so it is a `HoldToConfirm`
 * (Story 1.13) in its own Preact root. Progress updates patch the bar and its
 * text in place; the panel is rebuilt only when what it offers changes, so a
 * running hold is never dropped by a tick.
 */
export class ResearchPanel {
  private container: HTMLDivElement;
  private researcherCountEl: HTMLSpanElement | null = null;
  private lastHash: string = '';
  private lastProgressHash: string = '';
  /** Preact roots of the cancel controls, unmounted on rebuild. */
  private confirmHosts: HTMLElement[] = [];

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private actions: Actions,
    /** Confirm style and hold duration from the platform settings, passed in from main. */
    private confirmSettings: ReadonlySignal<ConfirmSettings>,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'research-panel';
    this.container.className = 'panel research-panel';
    this.container.style.display = 'none';

    this.render();

    // Phase reveal on phase change
    bus.subscribe('phase_committed', ({ to: phase }) => {
      // Research available in space / transcendence phases
      if (phase === 'space' || phase === 'transcendence') {
        this.container.style.display = '';
      }
    });

    // Reactive: re-render on state changes
    effect(() => {
      void selectResearch.value;
      void selectResearchers.value;
      void selectResources.value;
      // Render reads through getState(); keep it from subscribing to the whole state.
      untracked(() => this.render());
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
    const state = this.getState();

    // Structure hash (what the panel offers) and progress hash (bars only).
    const projects = getProjects();
    const hashParts: string[] = [];
    const progressParts: string[] = [];
    hashParts.push(`researchers:${getAssignedResearchers(state)}`);
    for (const p of projects) {
      const status = getProjectStatus(state, p.id);
      hashParts.push(`${p.id}:${status}:${status === 'available' && canStartProject(state, p.id)}`);
      progressParts.push(`${p.id}:${progressMs(state, p.id)}`);
    }

    const hash = hashParts.join('|');
    const progressHash = progressParts.join('|');
    if (hash === this.lastHash) {
      if (progressHash !== this.lastProgressHash) {
        this.lastProgressHash = progressHash;
        for (const p of projects) this.patchProgress(p, state);
      }
      return;
    }
    this.lastHash = hash;
    this.lastProgressHash = progressHash;

    for (const host of this.confirmHosts) renderPreact(null, host);
    this.confirmHosts = [];
    this.container.innerHTML = '';

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
      explain(minusBtn, this.actions.unassignResearcher());
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
      explain(plusBtn, this.actions.assignResearcher());
    });
    researcherSection.appendChild(plusBtn);

    this.container.appendChild(researcherSection);

    // ── Project list ──
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
      reqEl.textContent = `Researchers: ${assigned}/${project.requiredResearchers} | Time: ${Math.round(project.durationMs / 1000)}s`;
      card.appendChild(reqEl);
    }

    // ── Progress bar (in_progress) ──
    if (status === 'in_progress') {
      const progressContainer = document.createElement('div');
      progressContainer.className = 'progress-bar';

      const progressFill = document.createElement('div');
      progressFill.className = 'progress-bar-fill';
      progressFill.setAttribute('role', 'progressbar');
      progressContainer.appendChild(progressFill);

      card.appendChild(progressContainer);

      const progressText = document.createElement('div');
      progressText.className = 'research-progress-text';
      card.appendChild(progressText);
      this.fillProgress(card, project, state);
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
        explain(startBtn, this.actions.startResearch(project.id));
      });
      actions.appendChild(startBtn);
    }

    if (status === 'in_progress') {
      // Irreversible (half the cost is lost): hold or two taps (Story 1.13).
      const host = document.createElement('div');
      host.className = 'research-cancel';
      actions.appendChild(host);
      this.confirmHosts.push(host);
      renderPreact(
        h(HoldToConfirm, {
          verb: 'Cancel',
          target: 'research',
          cost: '50% refund',
          onConfirm: () => explain(host.querySelector('button'), this.actions.cancelResearch(project.id)),
          settings: this.confirmSettings,
          class: 'btn-danger',
          'data-action': 'cancel-research',
        }),
        host,
      );
    }

    card.appendChild(actions);

    return card;
  }

  /** Update a running project's bar and text in place. */
  private patchProgress(project: ResearchProjectDef, state: GameState): void {
    const card = this.container.querySelector<HTMLElement>(`[data-research-project="${project.id}"]`);
    if (card) this.fillProgress(card, project, state);
  }

  private fillProgress(card: HTMLElement, project: ResearchProjectDef, state: GameState): void {
    const fill = card.querySelector<HTMLElement>('.progress-bar-fill');
    const text = card.querySelector<HTMLElement>('.research-progress-text');
    const done = progressMs(state, project.id);
    const pct = Math.min(100, Math.round((done / project.durationMs) * 100));
    if (fill) {
      fill.style.width = `${pct}%`;
      fill.setAttribute('aria-valuenow', String(pct));
    }
    if (text) text.textContent = `${Math.floor(done / 1000)}s / ${Math.round(project.durationMs / 1000)}s`;
  }
}
