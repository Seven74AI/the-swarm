import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { ResourceSystem } from '../../systems/ResourceSystem';
import { computeResourceRates } from '../../systems/ResourceSystem';
import type { GameState } from '../../state/GameState';

type Role = 'gather' | 'tend' | 'dig' | 'guard';

interface RoleDef {
  label: string;
  icon: string;
  desc: string;
}

const ROLE_DISPLAY: Record<Role, RoleDef> = {
  gather: { label: 'Gather', icon: '🌾', desc: '+2 food/sec' },
  tend:   { label: 'Tend',   icon: '🥚', desc: '+25% hatch rate each' },
  dig:    { label: 'Dig',    icon: '⛏️', desc: 'Each Dig worker adds +1 capacity per second.' },
  guard:  { label: 'Guard',  icon: '🛡️', desc: 'defense + unlocks combat phase' },
};

export class WorkerAssignment {
  private container: HTMLDivElement;
  private summaryEl: HTMLSpanElement;

  constructor(
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

    const hint = document.createElement('div');
    hint.className = 'worker-hint';
    hint.textContent = 'Each worker costs −0.5 food/sec';
    this.container.appendChild(hint);

    const roles: Role[] = ['gather', 'tend', 'dig', 'guard'];
    for (const role of roles) {
      this.container.appendChild(this.createRoleRow(role));
    }

    // Capacity display line
    const capacityLine = document.createElement('div');
    capacityLine.className = 'capacity-line';
    this.container.appendChild(capacityLine);

    // Reactive: update capacity display
    effect(() => {
      const s = gameState.value;
      const effectiveCap = this.resourceSystem.getEffectiveNestCapacity(s);
      const baseCap = s.resources.nestCapacity;
      const warehouseBonus = effectiveCap - baseCap;
      capacityLine.textContent = warehouseBonus > 0
        ? `Capacity: ${baseCap} (+Warehouse ${warehouseBonus}) — Workers: ${s.resources.workers}/${effectiveCap}`
        : `Capacity: ${baseCap} — Workers: ${s.resources.workers}/${effectiveCap}`;
    });

    const summary = document.createElement('div');
    summary.className = 'worker-summary';
    const label = document.createElement('span');
    label.textContent = 'Net food: ';
    this.summaryEl = document.createElement('span');
    this.summaryEl.className = 'worker-summary-value';
    summary.appendChild(label);
    summary.appendChild(this.summaryEl);
    this.container.appendChild(summary);

    // Phase reveal (event-driven — stays on bus)
    bus.subscribe('phase_changed', (payload: unknown) => {
      const phase = (payload as { phase: string }).phase;
      if (phase === 'colony') {
        this.container.style.display = '';
      }
    });

    // Reactive: refresh counts and food summary when state changes
    effect(() => {
      const s = gameState.value;
      this.refreshCounts(s);
      this.refreshSummary(s);
    });
  }

  private createRoleRow(role: Role): HTMLDivElement {
    const display = ROLE_DISPLAY[role];
    const row = document.createElement('div');
    row.className = 'stat-row worker-role-row';

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

    // Add tooltip for Dig role
    if (role === 'dig') {
      row.setAttribute('data-tooltip', 'Each Dig worker adds +1 capacity per second.');
    }

    return row;
  }

  private refreshCounts(state: GameState): void {
    const rows = this.container.querySelectorAll('[data-role]');
    rows.forEach((row) => {
      const role = row.getAttribute('data-role') as Role;
      const countSpan = row.querySelector('.role-count');
      if (countSpan) {
        const newValue = String(state.workersAssigned[role] ?? 0);
        // Dirty-check: only update DOM if value changed
        if (countSpan.textContent !== newValue) {
          countSpan.textContent = newValue;
        }
      }
    });
  }

  private refreshSummary(state: GameState): void {
    const rates = computeResourceRates(state);
    const net = rates.foodProducedPerSec - rates.foodConsumedPerSec;

    const netInt = Math.floor(net);
    const newText = netInt >= 0 ? `+${netInt}/sec` : `${netInt}/sec`;
    const newClass = netInt >= 0 ? 'worker-summary-value food-positive' : 'worker-summary-value food-negative';

    if (this.summaryEl.textContent !== newText) {
      this.summaryEl.textContent = newText;
    }
    if (this.summaryEl.className !== newClass) {
      this.summaryEl.className = newClass;
    }
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
