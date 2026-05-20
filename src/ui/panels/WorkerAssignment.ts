import type { Store } from '../../state/Store';
import type { EventBus } from '../../engine/EventBus';
import type { ResourceSystem } from '../../systems/ResourceSystem';
import type { GameState } from '../../state/GameState';

type Role = 'gather' | 'tend' | 'dig' | 'guard';

interface RoleDef {
  label: string;
  icon: string;
  desc: string;
}

const ROLE_DISPLAY: Record<Role, RoleDef> = {
  gather: { label: 'Gather', icon: '🌾', desc: '+2 food/tick' },
  tend:   { label: 'Tend',   icon: '🥚', desc: 'hatch eggs faster (−1 tick)' },
  dig:    { label: 'Dig',    icon: '⛏️', desc: 'expand nest capacity (WIP)' },
  guard:  { label: 'Guard',  icon: '🛡️', desc: 'defense + unlocks combat phase' },
};

const FOOD_PER_GATHER = 2;
const FOOD_PER_UNASSIGNED = 1;
const FOOD_CONSUMED_PER_WORKER = 0.5;

/**
 * Worker assignment panel with +/- buttons for each role
 * and a live food/tick summary.
 */
export class WorkerAssignment {
  private container: HTMLDivElement;
  private summaryEl: HTMLSpanElement;

  constructor(
    private store: Store,
    private bus: EventBus,
    private resourceSystem: ResourceSystem,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'worker-assignment';
    this.container.className = 'panel worker-assignment-panel';
    this.container.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Assign Workers';
    this.container.appendChild(title);

    // Hint line
    const hint = document.createElement('div');
    hint.className = 'worker-hint';
    hint.textContent = 'Each worker costs −0.5 food/tick';
    this.container.appendChild(hint);

    // Role rows
    const roles: Role[] = ['gather', 'tend', 'dig', 'guard'];
    for (const role of roles) {
      this.container.appendChild(this.createRoleRow(role));
    }

    // Food summary
    const summary = document.createElement('div');
    summary.className = 'worker-summary';
    const label = document.createElement('span');
    label.textContent = 'Net food: ';
    this.summaryEl = document.createElement('span');
    this.summaryEl.className = 'worker-summary-value';
    summary.appendChild(label);
    summary.appendChild(this.summaryEl);
    this.container.appendChild(summary);

    // Reveal on colony phase
    bus.subscribe('phase_changed', (payload: unknown) => {
      const phase = (payload as { phase: string }).phase;
      if (phase === 'colony') {
        this.container.style.display = '';
      }
    });

    // Refresh on any state change that affects workers
    store.subscribe('workersAssigned', () => this.refresh());
    store.subscribe('workers', () => this.refresh());
  }

  private createRoleRow(role: Role): HTMLDivElement {
    const display = ROLE_DISPLAY[role];
    const row = document.createElement('div');
    row.className = 'stat-row worker-role-row';

    // Left side: icon + label + description
    const info = document.createElement('div');
    info.className = 'worker-role-info';

    const label = document.createElement('span');
    label.className = 'worker-role-label';
    label.textContent = `${display.icon} ${display.label}`;
    info.appendChild(label);

    const desc = document.createElement('span');
    desc.className = 'worker-role-desc';
    desc.textContent = display.desc;
    info.appendChild(desc);

    row.appendChild(info);

    // Right side: − / count / +
    const controls = document.createElement('span');
    controls.className = 'role-controls';

    const minusBtn = document.createElement('button');
    minusBtn.className = 'btn btn-sm';
    minusBtn.textContent = '−';
    minusBtn.addEventListener('click', () => {
      const state = this.getState();
      const updated = this.resourceSystem.unassignWorker(state, role);
      this.setState(updated);
    });

    const countSpan = document.createElement('span');
    countSpan.className = 'stat-value role-count';
    countSpan.textContent = '0';

    const plusBtn = document.createElement('button');
    plusBtn.className = 'btn btn-sm';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => {
      const state = this.getState();
      const updated = this.resourceSystem.assignWorker(state, role);
      this.setState(updated);
    });

    controls.appendChild(minusBtn);
    controls.appendChild(countSpan);
    controls.appendChild(plusBtn);
    row.appendChild(controls);

    row.setAttribute('data-role', role);
    return row;
  }

  private refresh(): void {
    const state = this.getState();

    // Update role counts
    const rows = this.container.querySelectorAll('[data-role]');
    rows.forEach((row) => {
      const role = row.getAttribute('data-role') as Role;
      const countSpan = row.querySelector('.role-count');
      if (countSpan) {
        countSpan.textContent = String(state.workersAssigned[role] ?? 0);
      }
    });

    // Update food summary
    const w = state.resources.workers;
    const a = state.workersAssigned;
    const assigned = a.gather + a.tend + a.dig + a.guard;
    const unassigned = Math.max(0, w - assigned);
    const produced = a.gather * FOOD_PER_GATHER + unassigned * FOOD_PER_UNASSIGNED;
    const consumed = w * FOOD_CONSUMED_PER_WORKER;
    const net = produced - consumed;

    this.summaryEl.textContent = net >= 0 ? `+${net.toFixed(1)}/tick` : `${net.toFixed(1)}/tick`;
    this.summaryEl.className = net >= 0 ? 'worker-summary-value food-positive' : 'worker-summary-value food-negative';
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
